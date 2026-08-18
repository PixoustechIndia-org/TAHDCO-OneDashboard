using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using API.Infrastructure;
using BAL.Interface;

namespace API.Controllers;

[ApiController]
[Route("api/v1/tod")]
[Authorize]
[RequireApp("TOD")]
public class TodController : ControllerBase
{
    private readonly ITodService _svc;
    private readonly ILookupService _lookup;
    public TodController(ITodService svc, ILookupService lookup) { _svc = svc; _lookup = lookup; }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary([FromQuery] string? fy) =>
        Ok(await _svc.GetSummaryAsync(await _lookup.GetFyIdAsync(fy)));

    [HttpGet("districts")]
    public async Task<IActionResult> Districts([FromQuery] string? fy) =>
        Ok(await _svc.GetDistrictsAsync(await _lookup.GetFyIdAsync(fy)));
}
