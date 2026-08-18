using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using API.Infrastructure;
using BAL.Interface;

namespace API.Controllers;

[ApiController]
[Route("api/v1/patrol360")]
[Authorize]
[RequireApp("Patrol360")]
public class Patrol360Controller : ControllerBase
{
    private readonly IPatrolService _svc;
    private readonly ILookupService _lookup;
    public Patrol360Controller(IPatrolService svc, ILookupService lookup) { _svc = svc; _lookup = lookup; }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary([FromQuery] string? fy) =>
        Ok(await _svc.GetSummaryAsync(await _lookup.GetFyIdAsync(fy)));

    [HttpGet("districts")]
    public async Task<IActionResult> Districts([FromQuery] string? fy) =>
        Ok(await _svc.GetDistrictsAsync(await _lookup.GetFyIdAsync(fy)));

    [HttpGet("offline-duration")]
    public async Task<IActionResult> Offline([FromQuery] string? fy) =>
        Ok(await _svc.GetOfflineDurationAsync(await _lookup.GetFyIdAsync(fy)));
}
