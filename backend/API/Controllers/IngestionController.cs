using System.Threading.Tasks;
using BAL.Interface;
using Microsoft.AspNetCore.Mvc;
using Model.ViewModel;

namespace API.Controllers
{
    [ApiController]
    [Route("api/v1/ingestion")]
    public class IngestionController : ControllerBase
    {
        private readonly IUnifiedIngestionService _ingestionService;
        private readonly IUnifiedRAGService _ragService;

        public IngestionController(IUnifiedIngestionService ingestionService, IUnifiedRAGService ragService)
        {
            _ingestionService = ingestionService;
            _ragService = ragService;
        }

        [HttpPost("sync")]
        public async Task<IActionResult> TriggerSync()
        {
            var result = await _ingestionService.SyncAllProjectApisAsync();
            return Ok(result);
        }

        [HttpGet("status")]
        public async Task<IActionResult> GetStatus()
        {
            var status = await _ingestionService.GetIngestionStatusAsync();
            return Ok(status);
        }

        [HttpGet("records")]
        public async Task<IActionResult> GetRecords([FromQuery] string? project = null, [FromQuery] string? district = null, [FromQuery] string? status = null, [FromQuery] int limit = 100)
        {
            var records = await _ingestionService.GetRecordsAsync(project, district, status, limit);
            return Ok(records);
        }

        [HttpGet("counts")]
        public async Task<IActionResult> GetCounts()
        {
            var counts = await _ingestionService.GetUnifiedDashboardCountsAsync();
            return Ok(counts);
        }

        [HttpPost("rag-query")]
        public async Task<IActionResult> QueryRAG([FromBody] UnifiedRAGQueryRequestDto request)
        {
            var result = await _ragService.QueryMultiProjectRAGAsync(request);
            return Ok(result);
        }
    }
}
