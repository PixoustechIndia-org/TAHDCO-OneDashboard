using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Model.ViewModel;

namespace BAL.Interface
{
    public interface IAIService
    {
        Task<AIResponseDto> ProcessChatQueryAsync(int userId, AIRequestDto request);
        IAsyncEnumerable<string> StreamChatQueryAsync(int userId, AIRequestDto request, CancellationToken cancellationToken = default);
        Task<RAGSearchResultDto> SearchDocumentsAsync(string query, string category, int topK = 5);
        Task<List<MCPToolDescriptorDto>> GetMcpToolsAsync(int userId);
        Task<MCPToolCallResultDto> ExecuteMcpToolAsync(int userId, MCPToolCallRequestDto toolRequest);
        Task<AIAnalyticsDto> GetAIAnalyticsAsync();
        Task<bool> SubmitFeedbackAsync(long requestId, int rating);
    }
}
