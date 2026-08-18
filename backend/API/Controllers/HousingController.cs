using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using API.Infrastructure;
using BAL.Interface;

namespace API.Controllers;

[ApiController]
[Route("api/v1/housing")]
[Authorize]
[RequireApp("THMS")]
public class HousingController : ControllerBase
{
    private readonly IHousingService _svc;
    private readonly ILookupService _lookup;
    public HousingController(IHousingService svc, ILookupService lookup) { _svc = svc; _lookup = lookup; }

    [HttpGet("overall")]
    public async Task<IActionResult> Overall([FromQuery] string? fy) =>
        Ok(await _svc.GetOverallAsync(await _lookup.GetFyIdAsync(fy)));

    [HttpGet("districts")]
    public async Task<IActionResult> Districts([FromQuery] string? fy, [FromQuery] string? division) =>
        Ok(await _svc.GetDistrictsAsync(await _lookup.GetFyIdAsync(fy), division));

    /// <summary>Phase-level THMS rows (real API grain, live-first) with all filters.</summary>
    [HttpGet("rows")]
    public async Task<IActionResult> Rows([FromQuery] string? fy, [FromQuery] string? division,
        [FromQuery] string? district, [FromQuery] string? phase, [FromQuery] string? search) =>
        Ok(await _svc.GetRowsAsync(await _lookup.GetFyIdAsync(fy), division, district, phase, search));

    [HttpGet("milestones")]
    public async Task<IActionResult> Milestones([FromQuery] string? fy) =>
        Ok(await _svc.GetMilestonesAsync(await _lookup.GetFyIdAsync(fy)));

    [HttpGet("infrastructure")]
    public async Task<IActionResult> Infrastructure([FromQuery] string? fy) =>
        Ok(await _svc.GetInfrastructureAsync(await _lookup.GetFyIdAsync(fy)));

    [HttpGet("division-summary")]
    public async Task<IActionResult> DivisionSummary([FromQuery] string? fy) =>
        Ok(await _svc.GetDivisionSummaryAsync(await _lookup.GetFyIdAsync(fy)));
}
