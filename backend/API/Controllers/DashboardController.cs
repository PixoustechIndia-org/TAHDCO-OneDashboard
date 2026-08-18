using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json.Serialization;
using System.Text.Json.Nodes;
using BAL.Interface;

namespace API.Controllers;

[ApiController]
[Route("api/v1/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboard;
    public DashboardController(IDashboardService dashboard) => _dashboard = dashboard;

    /// <summary>
    /// Full dashboard document — identical shape to the Angular app's
    /// assets/data/dashboard-data.json. ?fy=FY 2025-26 | FY 2024-25
    /// </summary>
    [HttpGet("full")]
    [AllowAnonymous]           // the Angular shell loads this before login redirects settle
    public async Task<IActionResult> GetFull([FromQuery] string? fy, [FromQuery] bool clearCache = false) =>
        Ok(await _dashboard.GetFullAsync(fy, clearCache));

    /// <summary>Live THMS BenList proxy endpoint (https://thms.tahdco.com/api/onedashboard/count-ben).</summary>
    [HttpPost("housing/benlist")]
    [AllowAnonymous]
    public async Task<IActionResult> BenList([FromBody] BenListReq req, [FromServices] IThmsLiveService liveSvc)
    {
        try
        {
            var dist = req?.District ?? "";
            var status = req?.Status ?? "";
            var gms = req?.GroupMilestone ?? "";
            var res = await liveSvc.GetBenListAsync(dist, status, gms);
            return Ok(res ?? (object)new { status = true, data = Array.Empty<object>() });
        }
        catch
        {
            return Ok(new { status = true, data = Array.Empty<object>() });
        }
    }

    /// <summary>Live TAMS BenList proxy endpoint (https://tams.tahdco.com/api/onedashboard/count-ben).</summary>
    [HttpPost("tams/benlist")]
    [AllowAnonymous]
    public async Task<IActionResult> TamsBenList([FromBody] TamsBenListReq req, [FromServices] ITamsLiveService liveSvc)
    {
        try
        {
            var dist = req?.District ?? "";
            var status = req?.Status ?? "";
            var res = await liveSvc.GetBenListAsync(dist, status);
            return Ok(res ?? (object)new { status = true, data = Array.Empty<object>() });
        }
        catch
        {
            return Ok(new { status = true, data = Array.Empty<object>() });
        }
    }

    [HttpPost("tips-time/worklist")]
    [AllowAnonymous]
    public async Task<IActionResult> WorkList([FromBody] WorkListReq req, [FromServices] ITipsTimeLiveService liveSvc)
    {
        try
        {
            var result = await liveSvc.GetOneDashboardWorkAsync(
                req.Type ?? "work",
                req.DivisionName ?? Array.Empty<string>(),
                req.DistrictNames ?? Array.Empty<string>(),
                req.StatusNames ?? Array.Empty<string>(),
                req.Years ?? Array.Empty<string>(),
                req.CameraStatus ?? ""
            );
            return Ok(result ?? (object)new { status = "SUCCESS", data = Array.Empty<object>() });
        }
        catch
        {
            return Ok(new { status = "SUCCESS", data = Array.Empty<object>() });
        }
    }

    [HttpPost("patrol/camera-status")]
    [AllowAnonymous]
    public async Task<IActionResult> GetMbookTenderStatus([FromBody] GetMbookTenderStatusReq req, [FromServices] ITipsTimeLiveService liveSvc)
    {
        try
        {
            var result = await liveSvc.GetMbookTenderStatusAsync(
                req.DivisionIds ?? Array.Empty<string>(),
                req.DistrictIds ?? Array.Empty<string>(),
                req.ContractorId ?? "",
                req.DepartmentIds ?? Array.Empty<string>(),
                req.Years ?? Array.Empty<string>(),
                req.SelectionType ?? "",
                req.CostOrCount ?? ""
            );
            return Ok(result ?? (object)new { status = "SUCCESS", data = Array.Empty<object>() });
        }
        catch
        {
            return Ok(new { status = "SUCCESS", data = Array.Empty<object>() });
        }
    }

    [HttpPost("tahdco-scheme/detail")]
    [AllowAnonymous]
    public async Task<IActionResult> GetTahdcoSchemeDetail([FromBody] TahdcoSchemeDetailReq req, [FromServices] IHttpClientFactory factory, [FromServices] Microsoft.Extensions.Options.IOptions<Model.ViewModel.ModuleApiConfigOptions> cfg)
    {
        try
        {
            var url = cfg.Value.Modules.TryGetValue("TAHDCO_SCHEME", out var c) && !string.IsNullOrEmpty(c.DetailUrl) ? c.DetailUrl : "https://scst.pixous.info/Report/GetApplicationDetails";
            var client = factory.CreateClient("external");
            
            var payload = new {
                draw = 1,
                start = 0,
                length = 1000,
                search = new { value = "" },
                reportFilterModel = new {
                    districtId = req.DistrictId ?? "",
                    statusFilter = req.StatusFilter ?? "totalApplications"
                }
            };
            
            var content = new StringContent(System.Text.Json.JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");
            using var resp = await client.PostAsync(url, content);
            if (!resp.IsSuccessStatusCode)
            {
                return Ok(new { status = "SUCCESS", data = Array.Empty<object>(), draw = 1, recordsTotal = 0, recordsFiltered = 0 });
            }
            var json = await resp.Content.ReadAsStringAsync();
            return Ok(System.Text.Json.Nodes.JsonNode.Parse(json));
        }
        catch
        {
            return Ok(new { status = "SUCCESS", data = Array.Empty<object>(), draw = 1, recordsTotal = 0, recordsFiltered = 0 });
        }
    }

    [HttpPost("telp/summary")]
    [AllowAnonymous]
    public async Task<IActionResult> GetTelpSummary([FromBody] TelpSummaryReq? req, [FromServices] ITelpLiveService telpSvc)
    {
        try
        {
            var result = await telpSvc.GetDistrictSummaryAsync(req?.FromYear, req?.ToYear, req?.SchemeIds, req?.DistrictIds);
            return Ok(result ?? (object)new { status = "SUCCESS", data = Array.Empty<object>() });
        }
        catch
        {
            return Ok(new { status = "SUCCESS", data = Array.Empty<object>() });
        }
    }

    [HttpPost("telp/detail")]
    [AllowAnonymous]
    public async Task<IActionResult> GetTelpDetail([FromBody] TelpDetailReq req, [FromServices] ITelpLiveService telpSvc)
    {
        try
        {
            var result = await telpSvc.GetApplicationDetailAsync(req.District ?? "", req.CategoryType ?? "statusSavedCount", req.FromYear, req.ToYear);
            return Ok(result ?? (object)new { status = "SUCCESS", data = Array.Empty<object>() });
        }
        catch
        {
            return Ok(new { status = "SUCCESS", data = Array.Empty<object>() });
        }
    }

    [HttpGet("tncwwb/general")]
    [AllowAnonymous]
    public async Task<IActionResult> GetTncwwbGeneral([FromQuery] string? type, [FromQuery] string? mode, [FromQuery] string? status, [FromQuery] string? year, [FromServices] IHttpClientFactory factory)
    {
        try
        {
            var client = factory.CreateClient("external");
            client.Timeout = TimeSpan.FromSeconds(15);
            var queryType = string.IsNullOrWhiteSpace(type) ? "MEMBER" : type;
            var queryMode = string.IsNullOrWhiteSpace(mode) ? "LIST" : mode;
            var queryYear = string.IsNullOrWhiteSpace(year) ? "2026" : year;
            var queryStatus = status ?? "";

            var url = $"https://testtncwwbv2-qa.pixoustech.app/api/OneDashboard/General?Type={Uri.EscapeDataString(queryType)}&Mode={Uri.EscapeDataString(queryMode)}&Status={Uri.EscapeDataString(queryStatus)}&year={Uri.EscapeDataString(queryYear)}";

            using var resp = await client.GetAsync(url);
            if (!resp.IsSuccessStatusCode)
            {
                return Ok(new { status = "SUCCESS", data = Array.Empty<object>() });
            }
            var json = await resp.Content.ReadAsStringAsync();
            return Ok(JsonNode.Parse(json));
        }
        catch
        {
            return Ok(new { status = "SUCCESS", data = Array.Empty<object>() });
        }
    }

    [HttpPost("ai-summary")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAiSummary([FromBody] AiSummaryReq req, [FromServices] ISarvamVoiceService voiceSvc)
    {
        var result = await voiceSvc.GenerateVoiceoverSummaryAsync(req ?? new AiSummaryReq());
        return Ok(result);
    }
}

public class TelpDetailReq
{
    [JsonPropertyName("district")]
    public string? District { get; set; }

    [JsonPropertyName("categoryType")]
    public string? CategoryType { get; set; }

    [JsonPropertyName("fromYear")]
    public int? FromYear { get; set; }

    [JsonPropertyName("toYear")]
    public int? ToYear { get; set; }
}

public class TelpSummaryReq
{
    [JsonPropertyName("fromYear")]
    public int? FromYear { get; set; }

    [JsonPropertyName("toYear")]
    public int? ToYear { get; set; }

    [JsonPropertyName("schemeIds")]
    public string[]? SchemeIds { get; set; }

    [JsonPropertyName("districtIds")]
    public string[]? DistrictIds { get; set; }
}

public class BenListReq
{
    [JsonPropertyName("district")]
    public string? District { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("groupmilestone")]
    public string? GroupMilestone { get; set; }
}

public class TamsBenListReq
{
    [JsonPropertyName("district")]
    public string? District { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }
}

public class WorkListReq
{
    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("divisionName")]
    public string[]? DivisionName { get; set; }

    [JsonPropertyName("districtNameList")]
    public string[]? DistrictNames { get; set; }

    [JsonPropertyName("statusNameList")]
    public string[]? StatusNames { get; set; }

    [JsonPropertyName("year")]
    public string[]? Years { get; set; }

    [JsonPropertyName("camerastatusList")]
    public string? CameraStatus { get; set; }
}

public class GetMbookTenderStatusReq
{
    [JsonPropertyName("divisionIds")]
    public string[]? DivisionIds { get; set; }

    [JsonPropertyName("districtIds")]
    public string[]? DistrictIds { get; set; }

    [JsonPropertyName("contractorId")]
    public string? ContractorId { get; set; }

    [JsonPropertyName("departmentIds")]
    public string[]? DepartmentIds { get; set; }

    [JsonPropertyName("year")]
    public string[]? Years { get; set; }

    [JsonPropertyName("selectionType")]
    public string? SelectionType { get; set; }

    [JsonPropertyName("costOrCount")]
    public string? CostOrCount { get; set; }
}

public class TahdcoSchemeDetailReq
{
    [System.Text.Json.Serialization.JsonPropertyName("districtId")]
    public string? DistrictId { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("statusFilter")]
    public string? StatusFilter { get; set; }
}
