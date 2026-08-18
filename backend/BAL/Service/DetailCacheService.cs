using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BAL.Interface;
using DAL;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Model.ViewModel;

namespace BAL.Service;

/// <summary>
/// See <see cref="IDetailCacheService"/>. This class is the literal implementation of the
/// pseudocode in spec section 9 — every branch below is commented with the section-9 step
/// it corresponds to so the mapping from requirement to code stays obvious.
/// </summary>
public class DetailCacheService : IDetailCacheService
{
    private readonly IDetailCacheRepository _repo;
    private readonly ISingleFlightRegistry _singleFlight;
    private readonly DataFreshnessPolicyOptions _freshness;
    private readonly ILogger<DetailCacheService> _log;

    public DetailCacheService(
        IDetailCacheRepository repo,
        ISingleFlightRegistry singleFlight,
        IOptions<DataFreshnessPolicyOptions> freshness,
        ILogger<DetailCacheService> log)
    {
        _repo = repo;
        _singleFlight = singleFlight;
        _freshness = freshness.Value;
        _log = log;
    }

    public async Task<CacheResultDto<IReadOnlyList<NormalizedDetailRecordDto>>> GetDetailDataAsync(
        IDashboardModuleAdapter adapter, ClickContextDto clickContext, CancellationToken ct = default)
    {
        var cacheKey = adapter.GetDetailCacheKey(clickContext);
        var now = DateTime.UtcNow;
        var row = await _repo.GetByCacheKeyAsync(cacheKey);

        // STEP 2 (spec 9): fresh cache exists -> return immediately, no network call at all.
        if (row is not null && row.Status == CacheStatus.Fresh && row.NormalizedData is not null
            && row.ExpiresAt.HasValue && row.ExpiresAt.Value > now)
        {
            return new CacheResultDto<IReadOnlyList<NormalizedDetailRecordDto>>
            {
                Data = Deserialize(row.NormalizedData),
                Source = DataSource.Cache,
                Stale = false,
                LastSuccessfulFetch = row.LastSuccessAt,
                CacheStatus = CacheStatus.Fresh
            };
        }

        // STEP 3 (spec 9): stale cache exists (expired TTL, or a previous refresh attempt
        // failed and left status=STALE) but we still have real prior data -> serve it
        // immediately and kick a de-duplicated background refresh. NEVER await the refresh
        // here — that would turn "stale-while-revalidate" back into "block on every click".
        if (row is not null && row.NormalizedData is not null && row.RecordCount > 0)
        {
            _ = _singleFlight.RunOnceAsync(cacheKey, () => RefreshInBackgroundAsync(adapter, clickContext, cacheKey, ct));

            return new CacheResultDto<IReadOnlyList<NormalizedDetailRecordDto>>
            {
                Data = Deserialize(row.NormalizedData),
                Source = DataSource.Cache,
                Stale = true,
                LastSuccessfulFetch = row.LastSuccessAt,
                CacheStatus = CacheStatus.Stale,
                Message = "Showing previously available data. Refreshing..."
            };
        }

        // STEP 4 (spec 9): no usable cache at all -> must call the live API. Single-flighted
        // so N simultaneous first-time clicks on the same cell produce exactly one upstream call.
        try
        {
            var data = await _singleFlight.RunOnceAsync(cacheKey, () => FetchAndStoreAsync(adapter, clickContext, cacheKey, ct));
            return new CacheResultDto<IReadOnlyList<NormalizedDetailRecordDto>>
            {
                Data = data,
                Source = DataSource.Api,
                Stale = false,
                LastSuccessfulFetch = DateTime.UtcNow,
                CacheStatus = CacheStatus.Fresh
            };
        }
        catch (Exception ex)
        {
            // No prior data AND the live call failed -> honest empty/unavailable state.
            // Never a stack trace, never the raw exception message, to the caller.
            _log.LogError(ex, "DetailCacheService: no-cache fetch failed for {CacheKey}", cacheKey);
            return new CacheResultDto<IReadOnlyList<NormalizedDetailRecordDto>>
            {
                Data = Array.Empty<NormalizedDetailRecordDto>(),
                Source = DataSource.None,
                Stale = false,
                Unavailable = true,
                CacheStatus = CacheStatus.ApiFailed,
                Message = "This data is currently unavailable. Please try again shortly."
            };
        }
    }

    public async Task<RefreshResultDto> RefreshDetailDataAsync(IDashboardModuleAdapter adapter, ClickContextDto clickContext, CancellationToken ct = default)
    {
        var cacheKey = adapter.GetDetailCacheKey(clickContext);
        try
        {
            var success = await _singleFlight.RunOnceAsync(cacheKey, () => RefreshInBackgroundAsync(adapter, clickContext, cacheKey, ct));
            if (success)
            {
                return new RefreshResultDto { Triggered = true, Success = true, Message = "Refreshed from the live API." };
            }
            else
            {
                return new RefreshResultDto { Triggered = true, Success = false, Message = "Live refresh failed; previously stored data (if any) was kept." };
            }
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "RefreshDetailDataAsync failed for {CacheKey}; previous data (if any) was kept.", cacheKey);
            return new RefreshResultDto { Triggered = true, Success = false, Message = "Live refresh failed; previously stored data (if any) was kept." };
        }
    }

    public async Task<DataStatusDto> GetDataStatusAsync(IDashboardModuleAdapter adapter, ClickContextDto clickContext)
    {
        var cacheKey = adapter.GetDetailCacheKey(clickContext);
        var row = await _repo.GetByCacheKeyAsync(cacheKey);
        if (row is null || row.NormalizedData is null)
            return new DataStatusDto { Exists = false, Fresh = false, Stale = false, RecordCount = 0 };

        var fresh = row.Status == CacheStatus.Fresh && row.ExpiresAt.HasValue && row.ExpiresAt.Value > DateTime.UtcNow;
        return new DataStatusDto
        {
            Exists = true,
            Fresh = fresh,
            Stale = !fresh,
            LastSuccessfulFetch = row.LastSuccessAt,
            RecordCount = row.RecordCount
        };
    }

    public async Task<string> GetDataSourceAsync(IDashboardModuleAdapter adapter, ClickContextDto clickContext)
    {
        var status = await GetDataStatusAsync(adapter, clickContext);
        if (!status.Exists) return DataSource.None;
        return status.Fresh ? DataSource.Cache : "STALE";
    }

    // ── internal fetch/store helpers ─────────────────────────────────────────────

    private async Task<IReadOnlyList<NormalizedDetailRecordDto>> FetchAndStoreAsync(
        IDashboardModuleAdapter adapter, ClickContextDto clickContext, string cacheKey, CancellationToken ct)
    {
        var correlationId = Guid.NewGuid().ToString();
        var startedAt = DateTime.UtcNow;
        var requestObj = adapter.BuildDetailRequest(clickContext);
        var requestJson = JsonSerializer.Serialize(requestObj);
        var requestHash = Sha256(requestJson);

        try
        {
            var raw = await adapter.GetDetailDataAsync(clickContext, ct);
            var normalized = adapter.NormalizeDetailResponse(raw, clickContext);
            await StoreSuccessAsync(adapter.Module, cacheKey, requestHash, requestJson, raw, normalized);

            await _repo.LogFetchAsync(new FetchLogEntry
            {
                CorrelationId = correlationId,
                Module = adapter.Module,
                Operation = ApiOperation.Detail,
                CacheKey = cacheKey,
                RequestPayload = requestJson,
                StartedAt = startedAt,
                CompletedAt = DateTime.UtcNow,
                HttpStatus = 200,
                Success = true,
                ResponseTimeMs = (int)(DateTime.UtcNow - startedAt).TotalMilliseconds,
                FallbackUsed = false
            });

            return normalized;
        }
        catch (Exception ex)
        {
            await _repo.EnsurePlaceholderAsync(adapter.Module, ApiOperation.Detail, cacheKey, requestHash, requestJson);
            await _repo.MarkFailedAsync(cacheKey, DateTime.UtcNow);
            await _repo.LogFetchAsync(new FetchLogEntry
            {
                CorrelationId = correlationId,
                Module = adapter.Module,
                Operation = ApiOperation.Detail,
                CacheKey = cacheKey,
                RequestPayload = requestJson,
                StartedAt = startedAt,
                CompletedAt = DateTime.UtcNow,
                HttpStatus = (ex as ExternalApiException)?.HttpStatus,
                Success = false,
                ErrorMessage = SafeMessage(ex),
                ResponseTimeMs = (int)(DateTime.UtcNow - startedAt).TotalMilliseconds,
                FallbackUsed = false
            });
            throw;
        }
    }

    /// <summary>Used for the STALE path's background refresh. On failure this deliberately
    /// swallows the exception after logging — the stale data the user already sees on screen
    /// must be left exactly as-is, per spec section 9 ("keep existing cached data").</summary>
    private async Task<bool> RefreshInBackgroundAsync(IDashboardModuleAdapter adapter, ClickContextDto clickContext, string cacheKey, CancellationToken ct)
    {
        var correlationId = Guid.NewGuid().ToString();
        var startedAt = DateTime.UtcNow;
        var requestObj = adapter.BuildDetailRequest(clickContext);
        var requestJson = JsonSerializer.Serialize(requestObj);
        var requestHash = Sha256(requestJson);

        try
        {
            var raw = await adapter.GetDetailDataAsync(clickContext, ct);
            var normalized = adapter.NormalizeDetailResponse(raw, clickContext);
            await StoreSuccessAsync(adapter.Module, cacheKey, requestHash, requestJson, raw, normalized);

            await _repo.LogFetchAsync(new FetchLogEntry
            {
                CorrelationId = correlationId, Module = adapter.Module, Operation = ApiOperation.Detail, CacheKey = cacheKey,
                RequestPayload = requestJson, StartedAt = startedAt, CompletedAt = DateTime.UtcNow, HttpStatus = 200,
                Success = true, ResponseTimeMs = (int)(DateTime.UtcNow - startedAt).TotalMilliseconds, FallbackUsed = true
            });
            return true;
        }
        catch (Exception ex)
        {
            // Keep old database data — do NOT call MarkFailedAsync's status-flip logic in a way
            // that could ever clear normalized_data; MarkFailedAsync only ever touches
            // fetched_at/status/is_stale by design (see DetailCacheRepository).
            await _repo.MarkFailedAsync(cacheKey, DateTime.UtcNow);
            await _repo.LogFetchAsync(new FetchLogEntry
            {
                CorrelationId = correlationId, Module = adapter.Module, Operation = ApiOperation.Detail, CacheKey = cacheKey,
                RequestPayload = requestJson, StartedAt = startedAt, CompletedAt = DateTime.UtcNow,
                HttpStatus = (ex as ExternalApiException)?.HttpStatus, Success = false, ErrorMessage = SafeMessage(ex),
                ResponseTimeMs = (int)(DateTime.UtcNow - startedAt).TotalMilliseconds, FallbackUsed = true
            });
            _log.LogWarning(ex, "Background DETAIL refresh failed for {CacheKey}; previous data kept untouched.", cacheKey);
            return false;
        }
    }

    private async Task StoreSuccessAsync(string module, string cacheKey, string requestHash, string requestJson,
        string rawResponse, IReadOnlyList<NormalizedDetailRecordDto> normalized)
    {
        var ttlSeconds = _freshness.For(module).DetailTTLSeconds;
        var fetchedAt = DateTime.UtcNow;
        var expiresAt = fetchedAt.AddSeconds(ttlSeconds);
        var normalizedJson = JsonSerializer.Serialize(normalized);

        var cacheId = await _repo.UpsertSuccessAsync(
            module, ApiOperation.Detail, cacheKey, requestHash, requestJson,
            rawResponse, normalizedJson, normalized.Count, fetchedAt, expiresAt);

        var recordRows = normalized.Select(r => new DetailRecordRow
        {
            CacheId = cacheId,
            Module = module,
            District = r.District,
            Division = r.Division,
            Metric = r.Metric,
            RecordData = JsonSerializer.Serialize(r.Data),
            SearchText = FlattenForSearch(r),
            SourceTimestamp = r.FetchedAt
        }).ToList();

        await _repo.ReplaceDetailRecordsAsync(cacheId, module, recordRows);
    }

    private static string FlattenForSearch(NormalizedDetailRecordDto r)
    {
        var parts = new List<string?> { r.Module, r.District, r.Division, r.Metric };
        parts.AddRange(r.Data.Values.Select(v => v?.ToString()));
        return string.Join(" ", parts.Where(p => !string.IsNullOrWhiteSpace(p)));
    }

    private static IReadOnlyList<NormalizedDetailRecordDto> Deserialize(string normalizedJson) =>
        JsonSerializer.Deserialize<List<NormalizedDetailRecordDto>>(normalizedJson) ?? new List<NormalizedDetailRecordDto>();

    private static string Sha256(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    /// <summary>Never let a raw exception/stack-trace string reach a log column an
    /// operator dashboard might render straight to a browser — one more belt-and-braces
    /// layer beyond "the UI never shows this" (spec sections 10/24).</summary>
    private static string SafeMessage(Exception ex) =>
        ex is ExternalApiException apiEx ? apiEx.Message : "Upstream API call failed.";
}
