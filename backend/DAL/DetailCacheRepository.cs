using global::Dapper;

namespace DAL;

/// <summary>Row shapes for the migration-06 tables (detail_api_cache / detail_api_records /
/// api_fetch_log). Kept in DAL, not Model, since these are raw persistence rows — BAL maps
/// them into the normalized DTOs in Model.ViewModel before anything above it sees them.</summary>
public class CacheRow
{
    public long Id { get; set; }
    public string Module { get; set; } = "";
    public string Operation { get; set; } = "";
    public string CacheKey { get; set; } = "";
    public string RequestHash { get; set; } = "";
    public string? RequestPayload { get; set; }
    public string? ResponseData { get; set; }
    public string? NormalizedData { get; set; }
    public int RecordCount { get; set; }
    public DateTime? FetchedAt { get; set; }
    public DateTime? LastSuccessAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public string Status { get; set; } = "EMPTY";
    public bool IsStale { get; set; }
    public string? ApiVersion { get; set; }
}

public class DetailRecordRow
{
    public long Id { get; set; }
    public long CacheId { get; set; }
    public string Module { get; set; } = "";
    public string? District { get; set; }
    public string? Division { get; set; }
    public string? Metric { get; set; }
    public string RecordData { get; set; } = "{}";
    public string? SearchText { get; set; }
    public DateTime? SourceTimestamp { get; set; }

    /// <summary>Joined in from the parent detail_api_cache row (see SearchRecordsAsync) so any
    /// caller reading records — the MCP search tool, the RAG retrieval service — can disclose
    /// staleness rather than presenting every stored record as if it were live (spec section 27,
    /// "always disclose stale data").</summary>
    public bool IsStale { get; set; }
    public string? CacheStatus { get; set; }
    public DateTime? LastSuccessAt { get; set; }
}

public class FetchLogEntry
{
    public string CorrelationId { get; set; } = "";
    public string Module { get; set; } = "";
    public string Operation { get; set; } = "";
    public string? CacheKey { get; set; }
    public string? RequestPayload { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int? HttpStatus { get; set; }
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public int? ResponseTimeMs { get; set; }
    public bool FallbackUsed { get; set; }
    public int RetryCount { get; set; }
}

public interface IDetailCacheRepository
{
    Task<CacheRow?> GetByCacheKeyAsync(string cacheKey);

    /// <summary>Insert-or-update the cache row for a SUCCESSFUL fetch. Always writes fresh
    /// response_data/normalized_data — this is the only path allowed to overwrite them.</summary>
    Task<long> UpsertSuccessAsync(string module, string operation, string cacheKey, string requestHash,
        string? requestPayloadJson, string responseData, string normalizedDataJson, int recordCount,
        DateTime fetchedAt, DateTime expiresAt, string apiVersion = "v1");

    /// <summary>Record a FAILED fetch attempt. Deliberately touches only fetched_at/status/is_stale —
    /// response_data and normalized_data are left exactly as they were, which is what makes the
    /// "never destroy previously-stored data on API failure" guarantee hold at the SQL layer, not
    /// just in application code.</summary>
    Task MarkFailedAsync(string cacheKey, DateTime fetchedAt);

    /// <summary>Create an empty EMPTY-status placeholder row so a subsequent MarkFailedAsync has
    /// something to update even on the very first (failed) attempt for a cache key.</summary>
    Task<long> EnsurePlaceholderAsync(string module, string operation, string cacheKey, string requestHash, string? requestPayloadJson);

    Task ReplaceDetailRecordsAsync(long cacheId, string module, IEnumerable<DetailRecordRow> records);

    Task<IEnumerable<DetailRecordRow>> SearchRecordsAsync(string? module, string? district, string? division, string? metric, string? keyword, int limit = 50);

    Task LogFetchAsync(FetchLogEntry entry);

    Task<IEnumerable<CacheRow>> GetStatusSummaryAsync(string? module = null);
}

public class DetailCacheRepository : IDetailCacheRepository
{
    private readonly IDapperRepository _db;
    public DetailCacheRepository(IDapperRepository db) => _db = db;

    public Task<CacheRow?> GetByCacheKeyAsync(string cacheKey) =>
        _db.QueryFirstOrDefaultAsync<CacheRow>(@"
            SELECT id AS Id, module AS Module, operation AS Operation, cache_key AS CacheKey,
                   request_hash AS RequestHash, request_payload AS RequestPayload,
                   response_data AS ResponseData, normalized_data AS NormalizedData,
                   record_count AS RecordCount, fetched_at AS FetchedAt, last_success_at AS LastSuccessAt,
                   expires_at AS ExpiresAt, status AS Status, is_stale AS IsStale, api_version AS ApiVersion
            FROM detail_api_cache WHERE cache_key = @CacheKey",
            new { CacheKey = cacheKey });

    public async Task<long> UpsertSuccessAsync(string module, string operation, string cacheKey, string requestHash,
        string? requestPayloadJson, string responseData, string normalizedDataJson, int recordCount,
        DateTime fetchedAt, DateTime expiresAt, string apiVersion = "v1")
    {
        await _db.ExecuteAsync(@"
            INSERT INTO detail_api_cache
                (module, operation, cache_key, request_hash, request_payload, response_data,
                 normalized_data, record_count, fetched_at, last_success_at, expires_at, status, is_stale, api_version)
            VALUES
                (@Module, @Operation, @CacheKey, @RequestHash, @RequestPayload, @ResponseData,
                 @NormalizedData, @RecordCount, @FetchedAt, @FetchedAt, @ExpiresAt, 'FRESH', 0, @ApiVersion)
            ON DUPLICATE KEY UPDATE
                request_hash = VALUES(request_hash),
                request_payload = VALUES(request_payload),
                response_data = VALUES(response_data),
                normalized_data = VALUES(normalized_data),
                record_count = VALUES(record_count),
                fetched_at = VALUES(fetched_at),
                last_success_at = VALUES(fetched_at),
                expires_at = VALUES(expires_at),
                status = 'FRESH',
                is_stale = 0,
                api_version = VALUES(api_version)",
            new
            {
                Module = module,
                Operation = operation,
                CacheKey = cacheKey,
                RequestHash = requestHash,
                RequestPayload = requestPayloadJson,
                ResponseData = responseData,
                NormalizedData = normalizedDataJson,
                RecordCount = recordCount,
                FetchedAt = fetchedAt,
                ExpiresAt = expiresAt,
                ApiVersion = apiVersion
            });

        var row = await GetByCacheKeyAsync(cacheKey);
        return row?.Id ?? 0;
    }

    public Task MarkFailedAsync(string cacheKey, DateTime fetchedAt) =>
        _db.ExecuteAsync(@"
            UPDATE detail_api_cache
            SET fetched_at = @FetchedAt,
                status = CASE WHEN record_count > 0 THEN 'STALE' ELSE 'API_FAILED' END,
                is_stale = CASE WHEN record_count > 0 THEN 1 ELSE 0 END
            WHERE cache_key = @CacheKey",
            new { CacheKey = cacheKey, FetchedAt = fetchedAt });

    public async Task<long> EnsurePlaceholderAsync(string module, string operation, string cacheKey, string requestHash, string? requestPayloadJson)
    {
        var existing = await GetByCacheKeyAsync(cacheKey);
        if (existing is not null) return existing.Id;

        await _db.ExecuteAsync(@"
            INSERT IGNORE INTO detail_api_cache (module, operation, cache_key, request_hash, request_payload, status, is_stale)
            VALUES (@Module, @Operation, @CacheKey, @RequestHash, @RequestPayload, 'EMPTY', 0)",
            new { Module = module, Operation = operation, CacheKey = cacheKey, RequestHash = requestHash, RequestPayload = requestPayloadJson });

        var row = await GetByCacheKeyAsync(cacheKey);
        return row?.Id ?? 0;
    }

    public async Task ReplaceDetailRecordsAsync(long cacheId, string module, IEnumerable<DetailRecordRow> records)
    {
        // Delete-then-insert is scoped to this one cache_id only (FK cascade also covers cache-row deletes),
        // so refreshing TELP|Chennai|statusSavedCount can never touch TIME|Chengalpattu|IN_PROGRESS rows —
        // module isolation is enforced at the data layer, not just in the adapter code.
        await _db.ExecuteAsync("DELETE FROM detail_api_records WHERE cache_id = @CacheId", new { CacheId = cacheId });

        foreach (var r in records)
        {
            await _db.ExecuteAsync(@"
                INSERT INTO detail_api_records (cache_id, module, district, division, metric, record_data, search_text, source_timestamp)
                VALUES (@CacheId, @Module, @District, @Division, @Metric, @RecordData, @SearchText, @SourceTimestamp)",
                new { CacheId = cacheId, Module = module, r.District, r.Division, r.Metric, r.RecordData, r.SearchText, r.SourceTimestamp });
        }
    }

    public Task<IEnumerable<DetailRecordRow>> SearchRecordsAsync(string? module, string? district, string? division, string? metric, string? keyword, int limit = 50)
    {
        // Joined to detail_api_cache so every returned record carries its parent cache row's
        // freshness — callers (MCP search_detail_records, DetailRecordRetrievalService) can then
        // disclose "this is stale data from <LastSuccessAt>" instead of presenting it as live.
        var sql = @"
            SELECT r.id AS Id, r.cache_id AS CacheId, r.module AS Module, r.district AS District, r.division AS Division,
                   r.metric AS Metric, r.record_data AS RecordData, r.search_text AS SearchText, r.source_timestamp AS SourceTimestamp,
                   c.is_stale AS IsStale, c.status AS CacheStatus, c.last_success_at AS LastSuccessAt
            FROM detail_api_records r
            LEFT JOIN detail_api_cache c ON c.id = r.cache_id
            WHERE (@Module IS NULL OR r.module = @Module)
              AND (@District IS NULL OR r.district = @District)
              AND (@Division IS NULL OR r.division = @Division)
              AND (@Metric IS NULL OR r.metric = @Metric)
              AND (@Keyword IS NULL OR r.search_text LIKE CONCAT('%', @Keyword, '%'))
            ORDER BY r.updated_at DESC
            LIMIT @Limit";
        return _db.QueryAsync<DetailRecordRow>(sql, new { Module = module, District = district, Division = division, Metric = metric, Keyword = keyword, Limit = limit });
    }

    public Task LogFetchAsync(FetchLogEntry entry) =>
        _db.ExecuteAsync(@"
            INSERT INTO api_fetch_log
                (correlation_id, module, operation, cache_key, request_payload, started_at, completed_at,
                 http_status, success, error_message, response_time_ms, fallback_used, retry_count)
            VALUES
                (@CorrelationId, @Module, @Operation, @CacheKey, @RequestPayload, @StartedAt, @CompletedAt,
                 @HttpStatus, @Success, @ErrorMessage, @ResponseTimeMs, @FallbackUsed, @RetryCount)",
            entry);

    public Task<IEnumerable<CacheRow>> GetStatusSummaryAsync(string? module = null) =>
        _db.QueryAsync<CacheRow>(@"
            SELECT id AS Id, module AS Module, operation AS Operation, cache_key AS CacheKey,
                   request_hash AS RequestHash, record_count AS RecordCount, fetched_at AS FetchedAt,
                   last_success_at AS LastSuccessAt, expires_at AS ExpiresAt, status AS Status, is_stale AS IsStale
            FROM detail_api_cache
            WHERE (@Module IS NULL OR module = @Module)
            ORDER BY module, operation, cache_key",
            new { Module = module });
}
