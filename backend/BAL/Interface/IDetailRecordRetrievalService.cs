using Model.ViewModel;

namespace BAL.Interface;

/// <summary>
/// Retrieval over detail_api_records for the AI assistant (spec section 26/section on
/// "Question about meaning/content of records" vs "Exact count / numeric question"):
///   - a STRUCTURED question ("how many X in district Y", an exact filter match) should be
///     answered from get_dashboard_count / get_detail_data (MCP tools), not from here — this
///     service's structured mode is for "list/show me the Y records in district X", not counts.
///   - a free-text/narrative question ("which applications are still pending review") runs a
///     KEYWORD search over the flattened search_text column.
/// There is no embedding/vector store in this stack (no embeddings provider is configured
/// anywhere in the codebase), so "semantic retrieval" here means keyword/full-text matching,
/// not vector similarity — documented explicitly so it is never assumed to be more than it is.
/// </summary>
public interface IDetailRecordRetrievalService
{
    Task<DetailRetrievalResultDto> RetrieveAsync(string query, string? module = null, string? district = null,
        string? division = null, string? metric = null, int topK = 8);
}
