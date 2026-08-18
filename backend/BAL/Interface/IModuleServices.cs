using Model.ViewModel;

namespace BAL.Interface;

public interface ITenderService
{
    Task<TenderSummaryVm> GetSummaryAsync(int fyId);
    Task<IEnumerable<TenderDivisionVm>> GetDivisionCountsAsync(int fyId);
    Task<IEnumerable<TenderDistrictVm>> GetDistrictsAsync(int fyId, string? division, string? search);
}

public interface IHousingService
{
    Task<HousingOverallVm> GetOverallAsync(int fyId);
    /// <summary>Phase-level rows (real THMS API grain) with division/district/phase/search filters.</summary>
    Task<IEnumerable<HousingDistrictVm>> GetRowsAsync(int fyId, string? division, string? district, string? phase, string? search);
    /// <summary>District-level aggregate (phases summed) — used by drill/overview.</summary>
    Task<IEnumerable<HousingDistrictVm>> GetDistrictsAsync(int fyId, string? division);
    Task<IEnumerable<HousingDivisionVm>> GetDivisionSummaryAsync(int fyId);
    Task<HousingMilestonesVm> GetMilestonesAsync(int fyId);
    Task<HousingInfraVm> GetInfrastructureAsync(int fyId);
}

/// <summary>Fetches live phase-level rows from the THMS QA API (onedashboard/count).</summary>
public interface IThmsLiveService
{
    Task<IReadOnlyList<HousingDistrictVm>?> TryGetLiveRowsAsync();
    Task<object?> GetBenListAsync(string district, string status, string groupMilestone);
}

/// <summary>Fetches live trainee detail rows from the TAMS API (onedashboard/count-ben).</summary>
public interface ITamsLiveService
{
    Task<object?> GetBenListAsync(string district, string status);
}

/// <summary>
/// Fetches live district-level TIPS / TIME / Patrol360 rows from
/// http://testtime.tahdco.com:8080/api/Dashboard/Get_Mbook_Tender_Status
/// Returns null on any failure so DashboardService can fall back to DB data.
/// </summary>
public interface ITipsTimeLiveService
{
    Task<TipsTimeLiveResult?> TryFetchAsync();
    Task<object?> GetOneDashboardWorkAsync(string type, string[] divisionNames, string[] districtNames, string[] statusNames, string[] years, string cameraStatus);
    Task<object?> GetMbookTenderStatusAsync(string[]? divisionIds, string[]? districtIds, string contractorId, string[]? departmentIds, string[]? years, string selectionType, string costOrCount);
}

public interface ITelpLiveService
{
    /// <summary>Calls qatelp.pixous.info's DistrictWise_ApplicationSummary. fromYear/toYear/
    /// schemeIds/districtIds default to the values confirmed working against the real API
    /// (Postman-verified) — previously this call sent an empty "{}" body, which is why the
    /// count tile silently failed even though the API worked fine in Postman.</summary>
    Task<object?> GetDistrictSummaryAsync(int? fromYear = null, int? toYear = null, string[]? schemeIds = null, string[]? districtIds = null);

    /// <summary>Calls DistrictWise_ApplicationDetail. categoryType must be the real field name
    /// from the summary response for the column that was clicked (e.g. "statusSavedCount" for
    /// Applied) — never a placeholder like "TotalApplications", which the live API doesn't
    /// recognize and silently returns nothing for.</summary>
    Task<object?> GetApplicationDetailAsync(string district, string categoryType, int? fromYear = null, int? toYear = null);
}

public interface IEnrollmentService
{
    Task<EnrollSummaryVm> GetSummaryAsync(int fyId);
    Task<IEnumerable<EnrollInstituteVm>> GetInstitutesAsync(int fyId, string? division, string? search);
    Task<IEnumerable<EnrollDistrictVm>> GetDistrictDataAsync(int fyId);
    Task<IEnumerable<EnrollDivisionVm>> GetDivisionSummaryAsync(int fyId);
    Task<GradeDistributionVm> GetGradeDistributionAsync(int fyId);
    Task<IEnumerable<MonthlyCompletionVm>> GetMonthlyCompletionAsync(int fyId);
}

public interface ISchemeService
{
    Task<IEnumerable<SchemeVm>> GetSchemesAsync(int fyId, string? project, string? search);
    Task<SchemeSummaryVm> GetOnoSchemeSummaryAsync(int fyId);
    Task<object> GetTelpAsync(int fyId);                      // { summary, agencies }
    Task<MemberSummaryVm> GetMemberSummaryAsync(int fyId);
    Task<IEnumerable<MemberDistrictVm>> GetMemberDistrictsAsync(int fyId, string? division, string? search);
}

public interface ITodService
{
    Task<TodSummaryVm> GetSummaryAsync(int fyId);
    Task<IEnumerable<TodDistrictVm>> GetDistrictsAsync(int fyId);
}

public interface IPatrolService
{
    Task<PatrolSummaryVm> GetSummaryAsync(int fyId);
    Task<IEnumerable<PatrolDistrictVm>> GetDistrictsAsync(int fyId);
    Task<OfflineDurationVm> GetOfflineDurationAsync(int fyId);
}

public class AiSummaryReq
{
    public string Language { get; set; } = "en"; // "en" or "ta"
    public string ProgramId { get; set; } = "all";
    public string District { get; set; } = "All Districts";
}

public class AiSummaryResponse
{
    public string Status { get; set; } = "SUCCESS";
    public string Language { get; set; } = "en";
    public string TextSummary { get; set; } = "";
    public string AudioBase64 { get; set; } = "";
    public string Speaker { get; set; } = "anushka";
    public string Model { get; set; } = "bulbul:v2";
}

public interface ISarvamVoiceService
{
    Task<AiSummaryResponse> GenerateVoiceoverSummaryAsync(AiSummaryReq req);
}
