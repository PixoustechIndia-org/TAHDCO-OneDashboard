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

        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, byte[]> _ttsCache = new();
        private static readonly System.Net.Http.HttpClient _ttsClient = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(15) };

        /// <summary>High-definition Tamil (தமிழ்) and Indian English Executive Speech Synthesis Stream</summary>
        [HttpGet("tts")]
        [AllowAnonymous]
        public async Task<IActionResult> GetTtsAudio([FromQuery] string text, [FromQuery] string? lang = "en")
        {
            if (string.IsNullOrWhiteSpace(text))
                return BadRequest(new { message = "Text parameter is required." });

            var targetLang = (lang?.ToLowerInvariant() == "ta" || lang?.ToLowerInvariant() == "tamil") ? "ta" : "en-IN";
            var cacheKey = $"{targetLang}_{text.Trim()}";

            if (_ttsCache.TryGetValue(cacheKey, out var cachedBytes))
            {
                return File(cachedBytes, "audio/mpeg", enableRangeProcessing: true);
            }

            try
            {
                var sentences = SplitIntoChunks(text, 160);
                var audioList = new List<byte[]>();

                foreach (var s in sentences)
                {
                    if (string.IsNullOrWhiteSpace(s)) continue;
                    var encoded = Uri.EscapeDataString(s.Trim());
                    var url = $"https://translate.google.com/translate_tts?ie=UTF-8&tl={targetLang}&client=tw-ob&q={encoded}";

                    var req = new System.Net.Http.HttpRequestMessage(System.Net.Http.HttpMethod.Get, url);
                    req.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
                    req.Headers.Add("Referer", "https://translate.google.com/");

                    var resp = await _ttsClient.SendAsync(req);
                    if (resp.IsSuccessStatusCode)
                    {
                        var bytes = await resp.Content.ReadAsByteArrayAsync();
                        if (bytes.Length > 0)
                            audioList.Add(bytes);
                    }
                }

                if (audioList.Count > 0)
                {
                    var totalLength = audioList.Sum(b => b.Length);
                    var combined = new byte[totalLength];
                    var offset = 0;
                    foreach (var b in audioList)
                    {
                        Buffer.BlockCopy(b, 0, combined, offset, b.Length);
                        offset += b.Length;
                    }

                    _ttsCache[cacheKey] = combined;
                    return File(combined, "audio/mpeg", enableRangeProcessing: true);
                }
            }
            catch
            {
                // Fallback handled by client
            }

            return StatusCode(503, new { message = "TTS audio synthesis unavailable." });
        }

        private static List<string> SplitIntoChunks(string text, int maxLen)
        {
            var result = new List<string>();
            var current = new StringBuilder();

            var words = text.Split(' ');
            foreach (var w in words)
            {
                if (current.Length + w.Length + 1 > maxLen)
                {
                    if (current.Length > 0)
                    {
                        result.Add(current.ToString());
                        current.Clear();
                    }
                }
                if (current.Length > 0) current.Append(' ');
                current.Append(w);
            }
            if (current.Length > 0)
                result.Add(current.ToString());

            return result;
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
