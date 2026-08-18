using System;
using System.Collections.Generic;

namespace Model.ViewModel
{
    public class AIRequestDto
    {
        public string UserQuery { get; set; } = string.Empty;
        public string? FinancialYear { get; set; } = "FY 2025-26";
        public string? Scope { get; set; } = "all";
        public int? DistrictId { get; set; }
        public string? Role { get; set; }
        public string? PreferredProvider { get; set; } = "Auto"; // Auto | OpenAI | Gemini | Ollama
        public bool Stream { get; set; } = false;
        public Dictionary<string, object>? ExtraContext { get; set; }
    }

    public class AIResponseDto
    {
        public string Answer { get; set; } = string.Empty;
        public string ProviderUsed { get; set; } = string.Empty;
        public string ModelUsed { get; set; } = string.Empty;
        public long LatencyMs { get; set; }
        public int PromptTokens { get; set; }
        public int CompletionTokens { get; set; }
        public decimal EstimatedCostUsd { get; set; }
        public List<RAGCitationDto> Citations { get; set; } = new List<RAGCitationDto>();
        public List<string> ActionSuggestions { get; set; } = new List<string>();
        public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    }

    public class RAGCitationDto
    {
        public int DocumentId { get; set; }
        public string DocumentTitle { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Excerpt { get; set; } = string.Empty;
        public float RelevanceScore { get; set; }
    }

    public class RAGSearchResultDto
    {
        public string Query { get; set; } = string.Empty;
        public int TotalMatches { get; set; }
        public List<RAGCitationDto> Results { get; set; } = new List<RAGCitationDto>();
    }

    public class MCPToolDescriptorDto
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public object InputSchema { get; set; } = new object();
        public string Category { get; set; } = "General";
    }

    public class MCPToolCallRequestDto
    {
        public string ToolName { get; set; } = string.Empty;
        public string ArgumentsJson { get; set; } = "{}";
    }

    public class MCPToolCallResultDto
    {
        public string ToolName { get; set; } = string.Empty;
        public bool Success { get; set; }
        public string OutputJson { get; set; } = "{}";
        public string? Error { get; set; }
        public long ExecutionTimeMs { get; set; }
    }

    public class AIAnalyticsDto
    {
        public int TotalRequests { get; set; }
        public int TotalTokens { get; set; }
        public decimal TotalCostUsd { get; set; }
        public double AverageLatencyMs { get; set; }
        public Dictionary<string, int> RequestsByProvider { get; set; } = new Dictionary<string, int>();
        public double SatisfactionRatePct { get; set; }
        public List<AIRequestLogItemDto> RecentLogs { get; set; } = new List<AIRequestLogItemDto>();
    }

    public class AIRequestLogItemDto
    {
        public long RequestId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Provider { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public string UserQuery { get; set; } = string.Empty;
        public long LatencyMs { get; set; }
        public decimal CostUsd { get; set; }
        public int FeedbackRating { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
