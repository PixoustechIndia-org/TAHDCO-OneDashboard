using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using API.Infrastructure;
using BAL.Interface;

namespace API.Controllers;

[ApiController]
[Route("api/v1/tender")]
[Authorize]
[RequireApp("TIPS", "TIME")]
public class TenderController : ControllerBase
{
    private readonly ITenderService _svc;
    private readonly ILookupService _lookup;
    public TenderController(ITenderService svc, ILookupService lookup) { _svc = svc; _lookup = lookup; }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary([FromQuery] string? fy) =>
        Ok(await _svc.GetSummaryAsync(await _lookup.GetFyIdAsync(fy)));

    [HttpGet("division-counts")]
    public async Task<IActionResult> DivisionCounts([FromQuery] string? fy) =>
        Ok(await _svc.GetDivisionCountsAsync(await _lookup.GetFyIdAsync(fy)));

    [HttpGet("districts")]
    public async Task<IActionResult> Districts([FromQuery] string? fy,
        [FromQuery] string? division, [FromQuery] string? search) =>
        Ok(await _svc.GetDistrictsAsync(await _lookup.GetFyIdAsync(fy), division, search));
}
