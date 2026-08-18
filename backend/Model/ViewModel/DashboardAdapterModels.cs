using System.Text.Json.Serialization;

namespace Model.ViewModel;

/// <summary>
/// The 7 modules wired into the click-driven COUNT/DETAIL cache. String constants
/// (not an enum) so they serialize/deserialize/log/cache-key identically everywhere
/// without a converter, and so a new module can be added without a breaking API change.
/// </summary>
public static class DashboardModule
{
    public const string Telp = "TELP";
    public const string TahdcoScheme = "TAHDCO_SCHEME";
    public const string TimePatrol360 = "TIME_PATROL360";
    public const string Thms = "THMS";
    public const string Tams = "TAMS";
    public const string OnePortalMember = "ONE_PORTAL_MEMBER";
    public const string OnePortalScheme = "ONE_PORTAL_SCHEME";

    public static readonly string[] All =
    {
        Telp, TahdcoScheme, TimePatrol360, Thms, Tams, OnePortalMember, OnePortalScheme
    };

    public static bool IsValid(string? module) => !string.IsNullOrWhiteSpace(module) && Array.IndexOf(All, module) >= 0;
}

public static class ApiOperation
{
    public const string Count = "COUNT";
    public const string Detail = "DETAIL";
}

/// <summary>FRESH | STALE | API_FAILED | EMPTY — mirrors detail_api_cache.status.</summary>
public static class CacheStatus
{
    public const string Fresh = "FRESH";
    public const string Stale = "STALE";
    public const string ApiFailed = "API_FAILED";
    public const string Empty = "EMPTY";
}

public static class DataSource
{
    public const string Cache = "CACHE";
    public const string Api = "API";
    public const string None = "NONE";
}

/// <summary>
/// The complete, machine-readable description of what a user clicked. Per spec, the UI
/// must NEVER submit a bare count value — every click must resolve to one of these before
/// any DETAIL API call or cache lookup happens (module + district/division + metric are
/// what disambiguate two rows that show the same numeric count).
/// </summary>
public class ClickContextDto
{
    public string Module { get; set; } = "";
    public string? District { get; set; }
    public string? Division { get; set; }
    /// <summary>The clicked column's category, in the module's own vocabulary
    /// (e.g. "IN_PROGRESS" for TIME, "statusSavedCount" for TELP, "HqPending" for One Portal).</summary>
    public string Metric { get; set; } = "";
    /// <summary>The count value that was clicked — informational only, never used to identify the record.</summary>
    public long Count { get; set; }
    /// <summary>Every other active dashboard filter at click time (year, scheme, camera status, ...).</summary>
    public Dictionary<string, object?> Filters { get; set; } = new();
    public int? Page { get; set; }
    public int? PageSize { get; set; }
    /// <summary>Free-text search/question, used by search_detail_records and the AI assistant — not part of the cache key.</summary>
    public string? Query { get; set; }
}

/// <summary>Normalized COUNT model every module adapter must produce, regardless of the shape
/// its upstream API actually returns.</summary>
public class NormalizedCountDto
{
    public string Module { get; set; } = "";
    public string? District { get; set; }
    public string? Division { get; set; }
    public string Metric { get; set; } = "";
    public long Value { get; set; }
    public Dictionary<string, object?> Filters { get; set; } = new();
    public string Source { get; set; } = DataSource.Api;
    public DateTime FetchedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Normalized DETAIL row every module adapter must produce.</summary>
public class NormalizedDetailRecordDto
{
    public string Module { get; set; } = "";
    public string? RecordId { get; set; }
    public string? District { get; set; }
    public string? Division { get; set; }
    public string? Metric { get; set; }
    /// <summary>The original field set for this record, module-specific — kept as a dictionary
    /// rather than a rigid class so each module's real payload shape passes through untouched.</summary>
    public Dictionary<string, object?> Data { get; set; } = new();
    public string Source { get; set; } = DataSource.Api;
    public DateTime FetchedAt { get; set; } = DateTime.UtcNow;
    public bool Stale { get; set; }
}

/// <summary>What DetailCacheService hands back to the controller/MCP tool — the exact
/// {data, source, stale, unavailable} contract from spec section 9.</summary>
public class CacheResultDto<T>
{
    public T? Data { get; set; }
    public string Source { get; set; } = DataSource.None; // CACHE | API | NONE
    public bool Stale { get; set; }
    public bool Unavailable { get; set; }
    public DateTime? LastSuccessfulFetch { get; set; }
    public string CacheStatus { get; set; } = Model.ViewModel.CacheStatus.Empty;
    public string? Message { get; set; } // user-safe, non-technical status message for the UI banner
}

public class DataStatusDto
{
    public bool Exists { get; set; }
    public bool Fresh { get; set; }
    public bool Stale { get; set; }
    public DateTime? LastSuccessfulFetch { get; set; }
    public int RecordCount { get; set; }
}

public class RefreshResultDto
{
    public bool Triggered { get; set; }
    public bool Success { get; set; }
    public string? Message { get; set; }
}

/// <summary>Per-module TTLs, bound from the "DataFreshnessPolicy" section of appsettings.json —
/// see DataFreshnessPolicyOptions. Never hard-code a TTL in a service; read it from here.</summary>
public class ModuleFreshnessOptions
{
    public int CountTTLSeconds { get; set; } = 300;
    public int DetailTTLSeconds { get; set; } = 600;
}

public class DataFreshnessPolicyOptions
{
    public Dictionary<string, ModuleFreshnessOptions> Modules { get; set; } = new();

    public ModuleFreshnessOptions For(string module) =>
        Modules.TryGetValue(module, out var opt) ? opt : new ModuleFreshnessOptions();
}

/// <summary>Per-module upstream endpoint configuration, bound from the "ModuleApiConfig"
/// section of appsettings.json — centralizes URLs so they are never hard-coded inside an
/// adapter or (worse) a UI component.</summary>
public class ModuleApiEndpointOptions
{
    public string CountUrl { get; set; } = "";
    public string DetailUrl { get; set; } = "";
    public int TimeoutSeconds { get; set; } = 15;
    public int MaxRetries { get; set; } = 2;
}

public class ModuleApiConfigOptions
{
    public Dictionary<string, ModuleApiEndpointOptions> Modules { get; set; } = new();

    public ModuleApiEndpointOptions For(string module) =>
        Modules.TryGetValue(module, out var opt) ? opt : new ModuleApiEndpointOptions();
}

/// <summary>detail_api_cache row shape as read back via Dapper.</summary>
public class DetailApiCacheRow
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
    public string Status { get; set; } = Model.ViewModel.CacheStatus.Empty;
    public bool IsStale { get; set; }
    public string? ApiVersion { get; set; }
}

/// <summary>MCP tool call envelope shared by every tool in DashboardMcpToolService.</summary>
public class DashboardMcpToolResultDto
{
    public bool Success { get; set; }
    public object? Output { get; set; }
    public string? Error { get; set; }
    public long ExecutionTimeMs { get; set; }
}

/// <summary>One retrieved dashboard record, shaped for the LLM prompt — carries its own
/// freshness so AIService can force a "this is stale, last confirmed <date>" disclosure
/// instead of ever letting stale rows look identical to live ones (spec section 27).</summary>
public class RetrievedDetailRecordDto
{
    public string Module { get; set; } = "";
    public string? District { get; set; }
    public string? Division { get; set; }
    public string? Metric { get; set; }
    public Dictionary<string, object?> Data { get; set; } = new();
    public bool Stale { get; set; }
    public DateTime? LastSuccessAt { get; set; }
}

/// <summary>Output of <see cref="BAL.Interface.IDetailRecordRetrievalService"/> — the "which
/// records / tell me about" retrieval path the AI assistant uses (as distinct from the
/// get_dashboard_count MCP tool, which is for exact numeric questions).</summary>
public class DetailRetrievalResultDto
{
    public string Query { get; set; } = "";
    /// <summary>STRUCTURED (filters matched, no free-text ranking) or KEYWORD (free-text search
    /// over search_text). Purely informational — tells the LLM/UI which retrieval path ran.</summary>
    public string Mode { get; set; } = "KEYWORD";
    public int TotalMatches { get; set; }
    public List<RetrievedDetailRecordDto> Records { get; set; } = new();
    /// <summary>True if any returned record is stale — AIService must surface this in the answer.</summary>
    public bool AnyStale { get; set; }
}
