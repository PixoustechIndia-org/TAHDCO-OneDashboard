using Model.ViewModel;

namespace BAL.Interface;

/// <summary>
/// Implements the exact stale-while-revalidate + never-destroy-old-data algorithm from
/// spec section 9, for the DETAIL side of the pipeline. This is the ONLY place that
/// algorithm is implemented — the controller, the MCP tools, and the AI/RAG layer all
/// go through here rather than re-implementing fallback logic themselves.
/// </summary>
public interface IDetailCacheService
{
    Task<CacheResultDto<IReadOnlyList<NormalizedDetailRecordDto>>> GetDetailDataAsync(
        IDashboardModuleAdapter adapter, ClickContextDto clickContext, CancellationToken ct = default);

    Task<RefreshResultDto> RefreshDetailDataAsync(
        IDashboardModuleAdapter adapter, ClickContextDto clickContext, CancellationToken ct = default);

    Task<DataStatusDto> GetDataStatusAsync(IDashboardModuleAdapter adapter, ClickContextDto clickContext);

    /// <summary>API / CACHE / STALE / NONE — see spec section 14 (get_data_source MCP tool).</summary>
    Task<string> GetDataSourceAsync(IDashboardModuleAdapter adapter, ClickContextDto clickContext);
}

/// <summary>Same algorithm, applied to the COUNT side (spec section 18) — count API failures
/// fall back to the previous count snapshot per module, independently of every other module.</summary>
public interface ICountCacheService
{
    Task<CacheResultDto<IReadOnlyList<NormalizedCountDto>>> GetCountDataAsync(
        IDashboardModuleAdapter adapter, Dictionary<string, object?> filters, CancellationToken ct = default);
}
