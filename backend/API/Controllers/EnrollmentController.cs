using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using API.Infrastructure;
using BAL.Interface;

namespace API.Controllers;

[ApiController]
[Route("api/v1/enrollment")]
[Authorize]
[RequireApp("TAMS")]
public class EnrollmentController : ControllerBase
{
    private readonly IEnrollmentService _svc;
    private readonly ILookupService _lookup;
    public EnrollmentController(IEnrollmentService svc, ILookupService lookup) { _svc = svc; _lookup = lookup; }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary([FromQuery] string? fy) =>
        Ok(await _svc.GetSummaryAsync(await _lookup.GetFyIdAsync(fy)));

    [HttpGet("institutes")]
    public async Task<IActionResult> Institutes([FromQuery] string? fy,
        [FromQuery] string? division, [FromQuery] string? search) =>
        Ok(await _svc.GetInstitutesAsync(await _lookup.GetFyIdAsync(fy), division, search));

    [HttpGet("districts")]
    public async Task<IActionResult> Districts([FromQuery] string? fy) =>
        Ok(await _svc.GetDistrictDataAsync(await _lookup.GetFyIdAsync(fy)));

    [HttpGet("division-summary")]
    public async Task<IActionResult> DivisionSummary([FromQuery] string? fy) =>
        Ok(await _svc.GetDivisionSummaryAsync(await _lookup.GetFyIdAsync(fy)));

    [HttpGet("grade-distribution")]
    public async Task<IActionResult> Grades([FromQuery] string? fy) =>
        Ok(await _svc.GetGradeDistributionAsync(await _lookup.GetFyIdAsync(fy)));

    [HttpGet("monthly-completion")]
    public async Task<IActionResult> Monthly([FromQuery] string? fy) =>
        Ok(await _svc.GetMonthlyCompletionAsync(await _lookup.GetFyIdAsync(fy)));
}
