using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BAL.Interface;

namespace API.Controllers;

[ApiController]
[Route("api/v1/reports")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reports;
    public ReportsController(IReportService reports) => _reports = reports;

    /// <summary>District-wise tender report as PDF (QuestPDF).</summary>
    [HttpGet("tender.pdf")]
    public async Task<IActionResult> TenderPdf([FromQuery] string? fy)
    {
        var bytes = await _reports.BuildTenderPdfAsync(fy);
        return File(bytes, "application/pdf", $"tender-report-{DateTime.Now:yyyyMMdd}.pdf");
    }

    /// <summary>Statewide TNCWWB Member Registration & Scheme Assistance PDF Report (QuestPDF).</summary>
    [HttpGet("tncwwb.pdf")]
    [AllowAnonymous]
    public async Task<IActionResult> TncwwbPdf([FromQuery] string? fy)
    {
        var bytes = await _reports.BuildTncwwbPdfAsync(fy);
        return File(bytes, "application/pdf", $"tncwwb-report-{DateTime.Now:yyyyMMdd}.pdf");
    }
}
