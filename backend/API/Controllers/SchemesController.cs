using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using API.Infrastructure;
using BAL.Interface;

namespace API.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class SchemesController : ControllerBase
{
    private readonly ISchemeService _svc;
    private readonly ILookupService _lookup;
    public SchemesController(ISchemeService svc, ILookupService lookup) { _svc = svc; _lookup = lookup; }

    [HttpGet("schemes")]
    [RequireApp("Scheme", "TELP", "OnePortal")]
    public async Task<IActionResult> Schemes([FromQuery] string? fy,
        [FromQuery] string? project, [FromQuery] string? search) =>
        Ok(await _svc.GetSchemesAsync(await _lookup.GetFyIdAsync(fy), project, search));

    [HttpGet("telp")]
    [RequireApp("TELP")]
    public async Task<IActionResult> Telp([FromQuery] string? fy) =>
        Ok(await _svc.GetTelpAsync(await _lookup.GetFyIdAsync(fy)));

    [HttpGet("one-portal/scheme-summary")]
    [RequireApp("OnePortal")]
    public async Task<IActionResult> SchemeSummary([FromQuery] string? fy) =>
        Ok(await _svc.GetOnoSchemeSummaryAsync(await _lookup.GetFyIdAsync(fy)));

    [HttpGet("one-portal/member-summary")]
    [RequireApp("OnePortal")]
    public async Task<IActionResult> MemberSummary([FromQuery] string? fy) =>
        Ok(await _svc.GetMemberSummaryAsync(await _lookup.GetFyIdAsync(fy)));

    [HttpGet("one-portal/member-districts")]
    [RequireApp("OnePortal")]
    public async Task<IActionResult> MemberDistricts([FromQuery] string? fy,
        [FromQuery] string? division, [FromQuery] string? search) =>
        Ok(await _svc.GetMemberDistrictsAsync(await _lookup.GetFyIdAsync(fy), division, search));
}
