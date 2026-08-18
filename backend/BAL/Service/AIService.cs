using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using BAL.Interface;
using DAL;
using Model.ViewModel;

namespace BAL.Service
{
    public class AIService : IAIService
    {
        private readonly ILLMProviderService _llmProvider;
        private readonly IRAGService _ragService;
        private readonly IMCPToolService _mcpToolService;
        private readonly IUnifiedRAGService _unifiedRAGService;
        private readonly IDashboardMcpToolService _dashboardMcpToolService;
        private readonly IDetailRecordRetrievalService _detailRetrieval;
        private readonly DapperContext _db;

        // The 6 grounded, DB-backed dashboard tools (spec section 14) — routed to
        // IDashboardMcpToolService instead of the legacy IMCPToolService, which contains
        // hard-coded example figures and must never be presented to the LLM as live data.
        private static readonly HashSet<string> DashboardToolNames = new(StringComparer.OrdinalIgnoreCase)
        {
            "get_dashboard_count", "get_detail_data", "search_detail_records",
            "get_cached_data_status", "refresh_detail_data", "get_data_source"
        };

        public AIService(ILLMProviderService llmProvider, IRAGService ragService, IMCPToolService mcpToolService,
            IUnifiedRAGService unifiedRAGService, IDashboardMcpToolService dashboardMcpToolService,
            IDetailRecordRetrievalService detailRetrieval, DapperContext db)
        {
            _llmProvider = llmProvider;
            _ragService = ragService;
            _mcpToolService = mcpToolService;
            _unifiedRAGService = unifiedRAGService;
            _dashboardMcpToolService = dashboardMcpToolService;
            _detailRetrieval = detailRetrieval;
            _db = db;
        }

        public async Task<AIResponseDto> ProcessChatQueryAsync(int userId, AIRequestDto request)
        {
            var ragResults = await _ragService.SearchAsync(request.UserQuery, "All", topK: 3);
            var multiProjectRag = await _unifiedRAGService.QueryMultiProjectRAGAsync(new UnifiedRAGQueryRequestDto { Query = request.UserQuery, TopK = 5 });

            // Grounded retrieval over the click-driven DETAIL cache (spec sections 26/27) — this
            // is the ONLY place record-level dashboard numbers/districts/statuses are allowed to
            // enter the prompt. Everything the LLM says about a specific record must trace back
            // to something in this block or a get_dashboard_count/get_detail_data tool call —
            // never to the model's own guess.
            var detailRetrieval = await _detailRetrieval.RetrieveAsync(request.UserQuery, topK: 8);

            string ragContext = string.Empty;
            if (ragResults.Results.Count > 0)
            {
                ragContext = "\n\nRetrieved Official Guidelines & Context:\n" +
                             string.Join("\n", ragResults.Results.Select(r => $"[{r.Category}] {r.DocumentTitle}: {r.Excerpt}"));
            }

            if (!string.IsNullOrEmpty(multiProjectRag.AggregatedAnswer))
            {
                ragContext += "\n\nMulti-Project Real-Time Ingested RAG Knowledge Context:\n" + multiProjectRag.AggregatedAnswer;
            }

            ragContext += BuildDashboardGroundingBlock(detailRetrieval);

            string systemPrompt = "You are TAHDCO AI Assistant, an intelligent copilot for Tamil Nadu Adi Dravidar Housing and Development Corporation.\n" +
                                 "Provide precise, multi-lingual (English/Tamil) insights based on official dashboard figures and government guidelines.\n" +
                                 $"User Role: {request.Role ?? "Executive"}, Active Scope: {request.Scope ?? "All"}, Financial Year: {request.FinancialYear ?? "FY 2025-26"}.\n\n" +
                                 GroundingRules +
                                 ragContext;

            string userPrompt = request.UserQuery;

            var aiResponse = await _llmProvider.GenerateAsync(systemPrompt, userPrompt, request.PreferredProvider ?? "Auto");
            aiResponse.Citations = ragResults.Results;

            aiResponse.ActionSuggestions = GenerateActionSuggestions(request.UserQuery);

            await LogAIRequestAsync(userId, aiResponse, request.UserQuery);

            return aiResponse;
        }

        /// <summary>Non-negotiable grounding rules (spec: "never hallucinate data/counts/
        /// districts/statuses, always disclose stale data"). Prepended to every chat/stream
        /// system prompt, not just when dashboard records happen to be retrieved, so the model
        /// never treats an empty retrieval as license to invent numbers instead.</summary>
        private const string GroundingRules =
            "DATA GROUNDING RULES (must follow exactly):\n" +
            "1. Only state a specific count, district name, status, or record detail if it appears in the \"Live Dashboard Data\" block below or was returned by a get_dashboard_count / get_detail_data / search_detail_records tool call in this conversation.\n" +
            "2. Never invent, estimate, round, or infer a number, district, division, or status that is not explicitly present in that data.\n" +
            "3. If the Live Dashboard Data block says a record is STALE, you must say so in your answer (e.g. \"as of the last successful refresh on ...\") — never present stale data as current without saying so.\n" +
            "4. If no matching data was retrieved and no tool call returned data, say plainly that you don't have that data right now instead of guessing — offer to check a specific module/district instead.\n" +
            "5. General policy/guideline questions may be answered from the Retrieved Official Guidelines context; that context is separate from live dashboard figures and must not be blended into a numeric claim.\n";

        /// <summary>Renders IDetailRecordRetrievalService's result as prompt text. Empty on purpose
        /// (not "No data found: ...") when there are zero records — GroundingRules rule 4 tells
        /// the model what to do with an empty block, so this method doesn't need to duplicate it.</summary>
        private static string BuildDashboardGroundingBlock(DetailRetrievalResultDto retrieval)
        {
            if (retrieval.Records.Count == 0)
            {
                return "\n\nLive Dashboard Data: (no matching records were found in the dashboard cache for this question)";
            }

            var lines = retrieval.Records.Select(r =>
            {
                var freshness = r.Stale
                    ? $"STALE (last confirmed {r.LastSuccessAt?.ToString("yyyy-MM-dd HH:mm") ?? "unknown"} UTC)"
                    : "current";
                var fields = string.Join(", ", r.Data.Select(kv => $"{kv.Key}={kv.Value}"));
                return $"- [{r.Module}] District={r.District ?? "-"} Division={r.Division ?? "-"} Metric={r.Metric ?? "-"} ({freshness}): {fields}";
            });

            var staleNotice = retrieval.AnyStale
                ? "\nNote: some of the records below are STALE — disclose this explicitly per rule 3."
                : "";

            return $"\n\nLive Dashboard Data ({retrieval.Mode} match, {retrieval.TotalMatches} record(s)):{staleNotice}\n" + string.Join("\n", lines);
        }

        public async IAsyncEnumerable<string> StreamChatQueryAsync(int userId, AIRequestDto request,
            [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            // Same grounding contract as the non-streaming path — a streaming answer is no less
            // able to hallucinate a count/district than a synchronous one, so it gets the same
            // retrieval + rules rather than a shortened prompt.
            var detailRetrieval = await _detailRetrieval.RetrieveAsync(request.UserQuery, topK: 8);
            string systemPrompt = "You are TAHDCO AI Assistant copilot. Provide streaming analysis for TAHDCO UDP.\n\n" +
                                   GroundingRules + BuildDashboardGroundingBlock(detailRetrieval);

            await foreach (var chunk in _llmProvider.StreamAsync(systemPrompt, request.UserQuery, request.PreferredProvider ?? "Auto", cancellationToken))
                yield return chunk;
        }

        public Task<RAGSearchResultDto> SearchDocumentsAsync(string query, string category, int topK = 5)
        {
            return _ragService.SearchAsync(query, category, topK);
        }

        public async Task<List<MCPToolDescriptorDto>> GetMcpToolsAsync(int userId)
        {
            var legacy = await _mcpToolService.GetToolsCatalogAsync();
            var dashboard = _dashboardMcpToolService.GetToolCatalog();
            return legacy.Concat(dashboard).ToList();
        }

        public Task<MCPToolCallResultDto> ExecuteMcpToolAsync(int userId, MCPToolCallRequestDto toolRequest)
        {
            if (DashboardToolNames.Contains(toolRequest.ToolName))
                return ExecuteDashboardMcpToolAsync(userId, toolRequest);

            return _mcpToolService.ExecuteToolAsync(toolRequest.ToolName, toolRequest.ArgumentsJson, userId);
        }

        /// <summary>Routes the 6 dashboard tool names to IDashboardMcpToolService, translating
        /// its already-authenticated/rate-limited/validated DashboardMcpToolResultDto back into
        /// the shared MCPToolCallResultDto envelope the AI chat pipeline expects. This is the
        /// only place that bridges the LLM tool-calling contract to the grounded data layer —
        /// argument parsing here is JSON-shape-only (no SQL, no URL construction).</summary>
        private async Task<MCPToolCallResultDto> ExecuteDashboardMcpToolAsync(int userId, MCPToolCallRequestDto toolRequest)
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            try
            {
                using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(toolRequest.ArgumentsJson) ? "{}" : toolRequest.ArgumentsJson);
                var root = doc.RootElement;

                string module = root.TryGetProperty("module", out var m) ? (m.GetString() ?? "") : "";
                var clickContext = root.TryGetProperty("clickContext", out var cc)
                    ? JsonSerializer.Deserialize<ClickContextDto>(cc.GetRawText(), JsonOpts) ?? new ClickContextDto()
                    : new ClickContextDto();

                DashboardMcpToolResultDto result = toolRequest.ToolName.ToLowerInvariant() switch
                {
                    "get_dashboard_count" => await _dashboardMcpToolService.GetDashboardCountAsync(
                        module, ReadFilters(root), userId),

                    "get_detail_data" => await _dashboardMcpToolService.GetDetailDataAsync(module, clickContext, userId),

                    "search_detail_records" => await _dashboardMcpToolService.SearchDetailRecordsAsync(
                        module,
                        root.TryGetProperty("district", out var d) ? d.GetString() : null,
                        root.TryGetProperty("division", out var dv) ? dv.GetString() : null,
                        root.TryGetProperty("metric", out var mt) ? mt.GetString() : null,
                        root.TryGetProperty("query", out var q) ? q.GetString() : null,
                        userId),

                    "get_cached_data_status" => await _dashboardMcpToolService.GetCachedDataStatusAsync(module, clickContext, userId),
                    "refresh_detail_data" => await _dashboardMcpToolService.RefreshDetailDataAsync(module, clickContext, userId),
                    "get_data_source" => await _dashboardMcpToolService.GetDataSourceAsync(module, clickContext, userId),
                    _ => new DashboardMcpToolResultDto { Success = false, Error = $"Tool '{toolRequest.ToolName}' is not a registered dashboard tool." }
                };

                sw.Stop();
                return new MCPToolCallResultDto
                {
                    ToolName = toolRequest.ToolName,
                    Success = result.Success,
                    OutputJson = JsonSerializer.Serialize(result.Output),
                    Error = result.Error,
                    ExecutionTimeMs = sw.ElapsedMilliseconds
                };
            }
            catch (Exception ex)
            {
                sw.Stop();
                return new MCPToolCallResultDto
                {
                    ToolName = toolRequest.ToolName,
                    Success = false,
                    Error = "Invalid tool arguments.",
                    ExecutionTimeMs = sw.ElapsedMilliseconds
                };
            }
        }

        private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

        private static Dictionary<string, object?> ReadFilters(JsonElement root)
        {
            if (!root.TryGetProperty("filters", out var f) || f.ValueKind != JsonValueKind.Object)
                return new Dictionary<string, object?>();
            return JsonSerializer.Deserialize<Dictionary<string, object?>>(f.GetRawText(), JsonOpts) ?? new Dictionary<string, object?>();
        }

        public Task<AIAnalyticsDto> GetAIAnalyticsAsync()
        {
            var analytics = new AIAnalyticsDto
            {
                TotalRequests = 142,
                TotalTokens = 84250,
                TotalCostUsd = 0.0412m,
                AverageLatencyMs = 640.5,
                SatisfactionRatePct = 96.4,
                RequestsByProvider = new Dictionary<string, int>
                {
                    { "OpenAI (GPT-4o)", 85 },
                    { "Google Gemini 1.5", 35 },
                    { "Ollama Local Engine", 22 }
                },
                RecentLogs = new List<AIRequestLogItemDto>
                {
                    new AIRequestLogItemDto { RequestId = 1, FullName = "Managing Director", Provider = "OpenAI", Model = "gpt-4o", UserQuery = "Executive summary for TIPS tender works FY 2025-26", LatencyMs = 520, CostUsd = 0.00045m, FeedbackRating = 1, CreatedAt = DateTime.UtcNow.AddMinutes(-12) },
                    new AIRequestLogItemDto { RequestId = 2, FullName = "District Manager (Coimbatore)", Provider = "Gemini", Model = "gemini-1.5-flash", UserQuery = "Check housing phase completion in Coimbatore district", LatencyMs = 410, CostUsd = 0.00012m, FeedbackRating = 1, CreatedAt = DateTime.UtcNow.AddMinutes(-35) },
                    new AIRequestLogItemDto { RequestId = 3, FullName = "Executive Engineer", Provider = "TAHDCO-Native-AI", Model = "tahdco-llm-v1", UserQuery = "Pending M-Books older than 15 days", LatencyMs = 180, CostUsd = 0.00000m, FeedbackRating = 1, CreatedAt = DateTime.UtcNow.AddHours(-1) }
                }
            };

            return Task.FromResult(analytics);
        }

        public Task<bool> SubmitFeedbackAsync(long requestId, int rating)
        {
            return Task.FromResult(true);
        }

        private async Task LogAIRequestAsync(int userId, AIResponseDto response, string userQuery)
        {
            try
            {
                using var conn = _db.CreateConnection();
                await Task.CompletedTask;
            }
            catch
            {
                // Graceful fallback
            }
        }

        private List<string> GenerateActionSuggestions(string query)
        {
            string q = query.ToLowerInvariant();
            if (q.Contains("tender") || q.Contains("mbook"))
            {
                return new List<string>
                {
                    "Generate TIPS PDF Report",
                    "Export M-Book Pending List to Excel",
                    "Notify Executive Engineer for Coimbatore"
                };
            }
            if (q.Contains("housing") || q.Contains("thms"))
            {
                return new List<string>
                {
                    "View THMS Construction Stage Chart",
                    "Filter Phase-wise Housing Progress",
                    "Check Hill Area Infra Allocations"
                };
            }
            return new List<string>
            {
                "Run Full Executive Briefing",
                "Search Policy Documents (RAG)",
                "Launch MCP Tools Catalog"
            };
        }
    }
}
