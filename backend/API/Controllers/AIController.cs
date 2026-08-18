using System;
using System.IO;
using System.Security.Claims;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using BAL.Interface;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Model.ViewModel;

namespace API.Controllers
{
    [ApiController]
    [Route("api/v1/ai")]
    [Authorize] // was missing — flagged in the QA Security Test tab; the AI/MCP tools must not be reachable anonymously
    public class AIController : ControllerBase
    {
        private readonly IAIService _aiService;

        public AIController(IAIService aiService)
        {
            _aiService = aiService;
        }

        [HttpPost("chat")]
        public async Task<IActionResult> Chat([FromBody] AIRequestDto request)
        {
            int userId = GetCurrentUserId();
            var response = await _aiService.ProcessChatQueryAsync(userId, request);
            return Ok(response);
        }

        [HttpGet("chat/stream")]
        public async Task Stream([FromQuery] string q, [FromQuery] string? fy = "FY 2025-26", [FromQuery] string? provider = "Auto", CancellationToken cancellationToken = default)
        {
            Response.ContentType = "text/event-stream";
            Response.Headers.Append("Cache-Control", "no-cache");
            Response.Headers.Append("Connection", "keep-alive");

            int userId = GetCurrentUserId();
            var request = new AIRequestDto { UserQuery = q, FinancialYear = fy, PreferredProvider = provider };

            await foreach (var chunk in _aiService.StreamChatQueryAsync(userId, request, cancellationToken))
            {
                var bytes = Encoding.UTF8.GetBytes($"data: {chunk}\n\n");
                await Response.Body.WriteAsync(bytes, 0, bytes.Length, cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }
        }

        [HttpGet("rag/search")]
        public async Task<IActionResult> SearchRAG([FromQuery] string query, [FromQuery] string? category = "All", [FromQuery] int topK = 5)
        {
            var result = await _aiService.SearchDocumentsAsync(query, category ?? "All", topK);
            return Ok(result);
        }

        [HttpGet("mcp/tools")]
        public async Task<IActionResult> GetMcpTools()
        {
            int userId = GetCurrentUserId();
            var tools = await _aiService.GetMcpToolsAsync(userId);
            return Ok(tools);
        }

        [HttpPost("mcp/execute")]
        public async Task<IActionResult> ExecuteMcpTool([FromBody] MCPToolCallRequestDto toolRequest)
        {
            int userId = GetCurrentUserId();
            var result = await _aiService.ExecuteMcpToolAsync(userId, toolRequest);
            return Ok(result);
        }

        [HttpGet("analytics")]
        public async Task<IActionResult> GetAnalytics()
        {
            var analytics = await _aiService.GetAIAnalyticsAsync();
            return Ok(analytics);
        }

        [HttpPost("feedback")]
        public async Task<IActionResult> SubmitFeedback([FromQuery] long requestId, [FromQuery] int rating)
        {
            var success = await _aiService.SubmitFeedbackAsync(requestId, rating);
            return Ok(new { success, message = "Feedback logged successfully." });
        }

        private int GetCurrentUserId()
        {
            var claim = User?.FindFirst(ClaimTypes.NameIdentifier);
            if (claim != null && int.TryParse(claim.Value, out int id))
            {
                return id;
            }
            return 1; // Default fallback user for demo/unauthenticated access
        }
    }
}
