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
/// COUNT-side mirror of <see cref="DetailCacheService"/> (spec section 18): if a module's
/// COUNT API fails, show its previous count snapshot marked stale rather than an error, and
/// never let that failure touch any other module's data. Deliberately a separate, smaller
/// class rather than a shared generic — COUNT has no per-record table (detail_api_records is
/// DETAIL-only) and no request-context beyond filters, so folding both into one generic
/// class would obscure more than it would save.
/// </summary>
public class CountCacheService : ICountCacheService
{
    private readonly IDetailCacheRepository _repo;
    private readonly ISingleFlightRegistry _singleFlight;
    private readonly DataFreshnessPolicyOptions _freshness;
    private readonly ILogger<CountCacheService> _log;

    public CountCacheService(
        IDetailCacheRepository repo,
        ISingleFlightRegistry singleFlight,
        IOptions<DataFreshnessPolicyOptions> freshness,
        ILogger<CountCacheService> log)
    {
        _repo = repo;
        _singleFlight = singleFlight;
        _freshness = freshness.Value;
        _log = log;
    }

    public async Task<CacheResultDto<IReadOnlyList<NormalizedCountDto>>> GetCountDataAsync(
        IDashboardModuleAdapter adapter, Dictionary<string, object?> filters, CancellationToken ct = default)
    {
        var cacheKey = adapter.GetCountCacheKey(filters);
        var now = DateTime.UtcNow;
        var row = await _repo.GetByCacheKeyAsync(cacheKey);

        if (row is not null && row.Status == CacheStatus.Fresh && row.NormalizedData is not null
            && row.ExpiresAt.HasValue && row.ExpiresAt.Value > now)
        {
            return Result(row, DataSource.Cache, false, CacheStatus.Fresh);
        }

        if (row is not null && row.NormalizedData is not null && row.RecordCount > 0)
        {
            _ = _singleFlight.RunOnceAsync(cacheKey, () => RefreshAsync(adapter, filters, cacheKey, ct, fallbackUsed: true));
            return Result(row, DataSource.Cache, true, CacheStatus.Stale, "Showing the last known counts. Refreshing...");
        }

        try
        {
            var data = await _singleFlight.RunOnceAsync(cacheKey, () => RefreshAsync(adapter, filters, cacheKey, ct, fallbackUsed: false));
            return new CacheResultDto<IReadOnlyList<NormalizedCountDto>>
            {
                Data = data, Source = DataSource.Api, Stale = false, LastSuccessfulFetch = DateTime.UtcNow, CacheStatus = CacheStatus.Fresh
            };
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "CountCacheService: no-cache fetch failed for {Module} {CacheKey}", adapter.Module, cacheKey);
            return new CacheResultDto<IReadOnlyList<NormalizedCountDto>>
            {
                Data = Array.Empty<NormalizedCountDto>(), Source = DataSource.None, Stale = false, Unavailable = true,
                CacheStatus = CacheStatus.ApiFailed, Message = $"{adapter.Module} counts are currently unavailable."
            };
        }
    }

    private async Task<IReadOnlyList<NormalizedCountDto>> RefreshAsync(
        IDashboardModuleAdapter adapter, Dictionary<string, object?> filters, string cacheKey, CancellationToken ct, bool fallbackUsed)
    {
        var correlationId = Guid.NewGuid().ToString();
        var startedAt = DateTime.UtcNow;
        var requestJson = JsonSerializer.Serialize(adapter.BuildCountRequest(filters));
        var requestHash = Sha256(requestJson);

        try
        {
            var raw = await adapter.GetCountDataAsync(filters, ct);
            var normalized = adapter.NormalizeCountResponse(raw, filters);
            var ttl = _freshness.For(adapter.Module).CountTTLSeconds;
            var fetchedAt = DateTime.UtcNow;

            await _repo.UpsertSuccessAsync(adapter.Module, ApiOperation.Count, cacheKey, requestHash, requestJson,
                raw, JsonSerializer.Serialize(normalized), normalized.Count, fetchedAt, fetchedAt.AddSeconds(ttl));

            await _repo.LogFetchAsync(new FetchLogEntry
            {
                CorrelationId = correlationId, Module = adapter.Module, Operation = ApiOperation.Count, CacheKey = cacheKey,
                RequestPayload = requestJson, StartedAt = startedAt, CompletedAt = DateTime.UtcNow, HttpStatus = 200,
                Success = true, ResponseTimeMs = (int)(DateTime.UtcNow - startedAt).TotalMilliseconds, FallbackUsed = fallbackUsed
            });

            return normalized;
        }
        catch (Exception ex)
        {
            await _repo.EnsurePlaceholderAsync(adapter.Module, ApiOperation.Count, cacheKey, requestHash, requestJson);
            await _repo.MarkFailedAsync(cacheKey, DateTime.UtcNow);
            await _repo.LogFetchAsync(new FetchLogEntry
            {
                CorrelationId = correlationId, Module = adapter.Module, Operation = ApiOperation.Count, CacheKey = cacheKey,
                RequestPayload = requestJson, StartedAt = startedAt, CompletedAt = DateTime.UtcNow,
                HttpStatus = (ex as ExternalApiException)?.HttpStatus, Success = false,
                ErrorMessage = ex is ExternalApiException apiEx ? apiEx.Message : "Upstream API call failed.",
                ResponseTimeMs = (int)(DateTime.UtcNow - startedAt).TotalMilliseconds, FallbackUsed = fallbackUsed
            });
            throw;
        }
    }

    private static CacheResultDto<IReadOnlyList<NormalizedCountDto>> Result(CacheRow row, string source, bool stale, string status, string? message = null) =>
        new()
        {
            Data = JsonSerializer.Deserialize<List<NormalizedCountDto>>(row.NormalizedData!) ?? new List<NormalizedCountDto>(),
            Source = source,
            Stale = stale,
            LastSuccessfulFetch = row.LastSuccessAt,
            CacheStatus = status,
            Message = message
        };

    private static string Sha256(string input) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(input))).ToLowerInvariant();
}
