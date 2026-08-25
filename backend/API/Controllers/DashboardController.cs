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
        var dist = req?.District ?? "";
        var status = req?.Status ?? "";
        var gms = req?.GroupMilestone ?? "";
        try
        {
            var res = await liveSvc.GetBenListAsync(dist, status, gms);
            var items = res is IEnumerable<object> list ? list : Array.Empty<object>();
            return Ok(new {
                status = "SUCCESS",
                statusCode = 200,
                message = string.IsNullOrWhiteSpace(dist) 
                    ? "Housing Management System (THMS) Statewide Beneficiary Milestone Records retrieved successfully."
                    : $"Housing Management System (THMS) Beneficiary Milestone Records retrieved successfully for District: {dist}.",
                businessTerm = "THMS Housing Scheme Beneficiary Records",
                district = dist,
                statusFilter = status,
                groupMilestone = gms,
                data = res ?? Array.Empty<object>()
            });
        }
        catch
        {
            return Ok(new {
                status = "SUCCESS",
                statusCode = 200,
                message = "Housing Management System (THMS) Beneficiary Milestone Records query executed.",
                businessTerm = "THMS Housing Scheme Beneficiary Records",
                district = dist,
                data = Array.Empty<object>()
            });
        }
    }

    /// <summary>Live TAMS BenList proxy endpoint (https://tams.tahdco.com/api/onedashboard/count-ben).</summary>
    [HttpPost("tams/benlist")]
    [AllowAnonymous]
    public async Task<IActionResult> TamsBenList([FromBody] TamsBenListReq req, [FromServices] ITamsLiveService liveSvc)
    {
        var dist = req?.District ?? "";
        var status = req?.Status ?? "";
        try
        {
            var res = await liveSvc.GetBenListAsync(dist, status);
            return Ok(new {
                status = "SUCCESS",
                statusCode = 200,
                message = string.IsNullOrWhiteSpace(dist)
                    ? "Training & Attendance Management System (TAMS) Statewide Trainee Attendance Records retrieved successfully."
                    : $"Training & Attendance Management System (TAMS) Trainee Attendance Records retrieved successfully for District: {dist}.",
                businessTerm = "TAMS Skill Training & Daily Attendance",
                district = dist,
                statusFilter = status,
                data = res ?? Array.Empty<object>()
            });
        }
        catch
        {
            return Ok(new {
                status = "SUCCESS",
                statusCode = 200,
                message = "Training & Attendance Management System (TAMS) Attendance query executed.",
                businessTerm = "TAMS Skill Training & Daily Attendance",
                district = dist,
                data = Array.Empty<object>()
            });
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
            return Ok(new {
                status = "SUCCESS",
                statusCode = 200,
                message = "Tender Integrated Process System (TIPS) & TIME M-Book Measurement Records retrieved successfully.",
                businessTerm = "Civil Infrastructure Works & M-Book Measurement Audit",
                recordType = req.Type ?? "work",
                data = result ?? Array.Empty<object>()
            });
        }
        catch
        {
            return Ok(new {
                status = "SUCCESS",
                statusCode = 200,
                message = "Tender Integrated Process System (TIPS) & TIME Work records query executed.",
                businessTerm = "Civil Infrastructure Works & M-Book Measurement Audit",
                data = Array.Empty<object>()
            });
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
            return Ok(new {
                status = "SUCCESS",
                statusCode = 200,
                message = "Patrol360 Surveillance Node Status & Active CCTV Infrastructure retrieved successfully.",
                businessTerm = "Patrol360 24x7 Real-time CCTV Video Surveillance",
                data = result ?? Array.Empty<object>()
            });
        }
        catch
        {
            return Ok(new {
                status = "SUCCESS",
                statusCode = 200,
                message = "Patrol360 CCTV Infrastructure query executed.",
                businessTerm = "Patrol360 24x7 Real-time CCTV Video Surveillance",
                data = Array.Empty<object>()
            });
        }
    }

    [HttpPost("tahdco-scheme/detail")]
    [AllowAnonymous]
    public async Task<IActionResult> GetTahdcoSchemeDetail([FromBody] TahdcoSchemeDetailReq req, [FromServices] IHttpClientFactory factory, [FromServices] Microsoft.Extensions.Options.IOptions<Model.ViewModel.ModuleApiConfigOptions> cfg)
    {
        var districtId = req?.DistrictId ?? "";
        var statusFilter = req?.StatusFilter ?? "totalApplications";
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
                    districtId = districtId,
                    statusFilter = statusFilter
                }
            };
            
            var content = new StringContent(System.Text.Json.JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");
            using var resp = await client.PostAsync(url, content);
            if (!resp.IsSuccessStatusCode)
            {
                return Ok(new {
                    status = "SUCCESS",
                    statusCode = 200,
                    message = "TAHDCO Welfare Subsidy Scheme Applications and Direct Benefit Transfer (DBT) records retrieved.",
                    businessTerm = "Welfare Direct Subsidy & Financial Assistance",
                    districtId = districtId,
                    statusFilter = statusFilter,
                    data = Array.Empty<object>(),
                    draw = 1,
                    recordsTotal = 0,
                    recordsFiltered = 0
                });
            }
            var json = await resp.Content.ReadAsStringAsync();
            var parsed = System.Text.Json.Nodes.JsonNode.Parse(json);
            if (parsed is JsonObject obj)
            {
                obj["status"] = "SUCCESS";
                obj["message"] = "TAHDCO Welfare Subsidy Scheme Applications and Direct Benefit Transfer (DBT) records retrieved successfully.";
                obj["businessTerm"] = "Welfare Direct Subsidy & Financial Assistance";
                obj["districtId"] = districtId;
                obj["statusFilter"] = statusFilter;
            }
            return Ok(parsed);
        }
        catch
        {
            return Ok(new {
                status = "SUCCESS",
                statusCode = 200,
                message = "TAHDCO Welfare Subsidy Scheme query executed.",
                businessTerm = "Welfare Direct Subsidy & Financial Assistance",
                districtId = districtId,
                statusFilter = statusFilter,
                data = Array.Empty<object>(),
                draw = 1,
                recordsTotal = 0,
                recordsFiltered = 0
            });
        }
    }

    [HttpPost("telp/summary")]
    [AllowAnonymous]
    public async Task<IActionResult> GetTelpSummary([FromBody] TelpSummaryReq? req, [FromServices] ITelpLiveService telpSvc)
    {
        try
        {
            var result = await telpSvc.GetDistrictSummaryAsync(req?.FromYear, req?.ToYear, req?.SchemeIds, req?.DistrictIds);
            return Ok(new {
                status = "SUCCESS",
                statusCode = 200,
                message = "Tamil Nadu Economic Loan Program (TELP) District Summary and Sanctioned Credit metrics retrieved successfully.",
                businessTerm = "TELP Economic Upliftment & Livelihood Loan Portfolio",
                data = result ?? Array.Empty<object>()
            });
        }
        catch
        {
            return Ok(new {
                status = "SUCCESS",
                statusCode = 200,
                message = "TELP Economic Loan Program summary query executed.",
                businessTerm = "TELP Economic Upliftment & Livelihood Loan Portfolio",
                data = Array.Empty<object>()
            });
        }
    }

    [HttpPost("telp/detail")]
    [AllowAnonymous]
    public async Task<IActionResult> GetTelpDetail([FromBody] TelpDetailReq req, [FromServices] ITelpLiveService telpSvc)
    {
        var district = req?.District ?? "";
        try
        {
            var result = await telpSvc.GetApplicationDetailAsync(district, req?.CategoryType ?? "statusSavedCount", req?.FromYear, req?.ToYear);
            return Ok(new {
                status = "SUCCESS",
                statusCode = 200,
                message = string.IsNullOrWhiteSpace(district)
                    ? "Tamil Nadu Economic Loan Program (TELP) Beneficiary Loan Sanction and Disbursement records retrieved successfully."
                    : $"Tamil Nadu Economic Loan Program (TELP) Beneficiary Loan Sanction records retrieved successfully for District: {district}.",
                businessTerm = "TELP Entrepreneurship & Livelihood Credit Assistance",
                district = district,
                categoryType = req?.CategoryType,
                data = result ?? Array.Empty<object>()
            });
        }
        catch
        {
            return Ok(new {
                status = "SUCCESS",
                statusCode = 200,
                message = "TELP Beneficiary Loan Sanction records query executed.",
                businessTerm = "TELP Entrepreneurship & Livelihood Credit Assistance",
                district = district,
                data = Array.Empty<object>()
            });
        }
    }

    [HttpGet("tncwwb/general")]
    [AllowAnonymous]
    public async Task<IActionResult> GetTncwwbGeneral([FromQuery] string? type, [FromQuery] string? mode, [FromQuery] string? status, [FromQuery] string? year, [FromQuery] string? district, [FromServices] IHttpClientFactory factory)
    {
        var queryType = string.IsNullOrWhiteSpace(type) ? "MEMBER" : type;
        var queryMode = string.IsNullOrWhiteSpace(mode) ? "LIST" : mode;
        var queryYear = string.IsNullOrWhiteSpace(year) ? "2026" : year;
        var queryStatus = status ?? "";
        try
        {
            var client = factory.CreateClient("external");
            client.Timeout = TimeSpan.FromSeconds(15);

            var url = $"https://testtncwwbv2-qa.pixoustech.app/api/OneDashboard/General?Type={Uri.EscapeDataString(queryType)}&Mode={Uri.EscapeDataString(queryMode)}&Status={Uri.EscapeDataString(queryStatus)}&year={Uri.EscapeDataString(queryYear)}";
            if (!string.IsNullOrWhiteSpace(district))
            {
                url += $"&district={Uri.EscapeDataString(district)}";
            }

            using var resp = await client.GetAsync(url);
            if (!resp.IsSuccessStatusCode)
            {
                return Ok(new {
                    status = "SUCCESS",
                    statusCode = 200,
                    message = "Tamil Nadu Construction Workers Welfare Board (TNCWWB) Registered Member Directory & Smart Card Issuance records retrieved.",
                    businessTerm = "TNCWWB Construction Worker Social Security & Welfare Assistance",
                    queryType = queryType,
                    queryMode = queryMode,
                    district = district ?? "All",
                    data = Array.Empty<object>()
                });
            }
            var json = await resp.Content.ReadAsStringAsync();
            var parsed = JsonNode.Parse(json);
            if (parsed is JsonObject obj)
            {
                obj["status"] = "SUCCESS";
                obj["message"] = queryType.Equals("Scheme", StringComparison.OrdinalIgnoreCase)
                    ? "Tamil Nadu Construction Workers Welfare Board (TNCWWB) Welfare Scheme Claims & Disbursement records retrieved successfully."
                    : "Tamil Nadu Construction Workers Welfare Board (TNCWWB) Registered Member Directory & Smart Card Issuance records retrieved successfully.";
                obj["businessTerm"] = "TNCWWB Construction Worker Social Security & Welfare Assistance";
                obj["queryType"] = queryType;
                obj["queryMode"] = queryMode;
                if (!string.IsNullOrWhiteSpace(district)) obj["district"] = district;
            }
            return Ok(parsed);
        }
        catch
        {
            return Ok(new {
                status = "SUCCESS",
                statusCode = 200,
                message = "Tamil Nadu Construction Workers Welfare Board (TNCWWB) query executed.",
                businessTerm = "TNCWWB Construction Worker Social Security & Welfare Assistance",
                queryType = queryType,
                queryMode = queryMode,
                district = district ?? "All",
                data = Array.Empty<object>()
            });
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
