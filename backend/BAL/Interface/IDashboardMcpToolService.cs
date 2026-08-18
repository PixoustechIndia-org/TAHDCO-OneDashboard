using Model.ViewModel;

namespace BAL.Interface;

/// <summary>
/// The controlled interface between the LLM and application data (spec section 14). The LLM
/// never gets a database connection, a raw SQL string, or an arbitrary URL — it can only call
/// one of these six named, schema-validated tools, each of which does exactly one thing via
/// the same IModuleAdapterRegistry / IDetailCacheService / ICountCacheService the REST API
/// uses. "No arbitrary SQL" and "no arbitrary API URL execution" are enforced structurally
/// here: every tool takes a `module` string that is validated against DashboardModule.All
/// before anything else happens, so there is no code path from an LLM-supplied string to a
/// SQL fragment or a URL.
/// </summary>
public interface IDashboardMcpToolService
{
    Task<DashboardMcpToolResultDto> GetDashboardCountAsync(string module, Dictionary<string, object?>? filters, int userId);
    Task<DashboardMcpToolResultDto> GetDetailDataAsync(string module, ClickContextDto clickContext, int userId);
    Task<DashboardMcpToolResultDto> SearchDetailRecordsAsync(string module, string? district, string? division, string? metric, string? query, int userId);
    Task<DashboardMcpToolResultDto> GetCachedDataStatusAsync(string module, ClickContextDto clickContext, int userId);
    Task<DashboardMcpToolResultDto> RefreshDetailDataAsync(string module, ClickContextDto clickContext, int userId);
    Task<DashboardMcpToolResultDto> GetDataSourceAsync(string module, ClickContextDto clickContext, int userId);

    /// <summary>Tool catalog entries for these 6 tools, merged into the AI assistant's
    /// existing MCP tools list (MCPToolService.GetToolsCatalogAsync) by AIService.</summary>
    List<MCPToolDescriptorDto> GetToolCatalog();
}
