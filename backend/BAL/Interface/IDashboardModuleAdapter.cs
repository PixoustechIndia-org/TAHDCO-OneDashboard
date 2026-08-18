using Model.ViewModel;

namespace BAL.Interface;

/// <summary>
/// Common contract every module (TELP, TAHDCO Scheme, TIME+Patrol360, THMS, TAMS,
/// One Portal Member, One Portal Scheme) implements so the dashboard engine
/// (<see cref="IDetailCacheService"/>, <see cref="ICountCacheService"/>, MCP tools) can
/// drive all 7 modules through one code path instead of branching on module name
/// throughout the codebase.
///
/// An adapter's only job is to know how to talk to ONE upstream API: build the
/// right request for a given filter/clickContext, and normalize whatever comes back
/// into the shared <see cref="NormalizedCountDto"/> / <see cref="NormalizedDetailRecordDto"/>
/// shape. It must never touch the database directly — caching, fallback, and
/// persistence all live in the cache services, not here. That separation is what
/// keeps one module's failure (or a bad adapter implementation) from being able to
/// affect any other module.
/// </summary>
public interface IDashboardModuleAdapter
{
    /// <summary>One of the DashboardModule.* constants.</summary>
    string Module { get; }

    /// <summary>Build the exact request (JSON body or query string) for the COUNT API,
    /// derived only from the supplied filters — never a hard-coded example value.</summary>
    object BuildCountRequest(Dictionary<string, object?> filters);

    /// <summary>Build the exact request for the DETAIL API. Per spec, this must derive
    /// categoryType/districtId/statusFilter/etc. dynamically from clickContext — the
    /// clicked column decides the category, not a constant.</summary>
    object BuildDetailRequest(ClickContextDto clickContext);

    /// <summary>Call the upstream COUNT endpoint and return the raw response body.
    /// Throws on failure — callers (ICountCacheService) are responsible for fallback.</summary>
    Task<string> GetCountDataAsync(Dictionary<string, object?> filters, CancellationToken ct = default);

    /// <summary>Call the upstream DETAIL endpoint and return the raw response body.
    /// Throws on failure — callers (IDetailCacheService) are responsible for fallback.</summary>
    Task<string> GetDetailDataAsync(ClickContextDto clickContext, CancellationToken ct = default);

    /// <summary>Convert a raw COUNT response into the shared normalized shape.</summary>
    IReadOnlyList<NormalizedCountDto> NormalizeCountResponse(string rawResponse, Dictionary<string, object?> filters);

    /// <summary>Convert a raw DETAIL response into the shared normalized shape.</summary>
    IReadOnlyList<NormalizedDetailRecordDto> NormalizeDetailResponse(string rawResponse, ClickContextDto clickContext);

    /// <summary>Deterministic cache key for a DETAIL clickContext — see spec section 7.
    /// Must include module + operation + every dimension that can distinguish two
    /// rows with the same numeric count (district, division, metric, filters) —
    /// never just the district, and never just the count.</summary>
    string GetDetailCacheKey(ClickContextDto clickContext);

    /// <summary>Deterministic cache key for a COUNT request (module + operation + normalized filters).</summary>
    string GetCountCacheKey(Dictionary<string, object?> filters);
}
