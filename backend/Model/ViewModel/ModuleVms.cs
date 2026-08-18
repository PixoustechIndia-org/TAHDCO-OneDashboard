namespace Model.ViewModel;

// Property names serialize to camelCase, matching src/assets/data/dashboard-data.json
// exactly so the Angular DataService needs no shape changes.

// ── Tender ───────────────────────────────────────────────────────────────────
public class TenderSummaryVm
{
    public int TotalWorks { get; set; } public int Started { get; set; } public int NotStarted { get; set; }
    public int InProgress { get; set; } public int Completed { get; set; } public int SlowProgress { get; set; }
    public int MBookTotal { get; set; } public int MBookUploaded { get; set; } public int MBookPending { get; set; }
    public int NoAction { get; set; } public int PaymentPending { get; set; }
}
public class TenderDivisionVm
{
    public string Division { get; set; } = "";
    public int TotalWorks { get; set; } public int InProgress { get; set; } public int NotStarted { get; set; }
    public int Completed { get; set; } public int SlowProgress { get; set; } public int MBooks { get; set; }
}
public class TenderDistrictVm
{
    public int Sno { get; set; }
    public string Division { get; set; } = ""; public string District { get; set; } = "";
    public int TotalWorks { get; set; } public int Started { get; set; } public int NotStarted { get; set; }
    public int InProgress { get; set; } public int Completed { get; set; } public int SlowProgress { get; set; }
    public int MBookUploaded { get; set; } public int MBookPending { get; set; }
    public int NoAction { get; set; } public int PaymentPending { get; set; }

    // Additional live-API fields — use explicit camelCase JSON names that differ from existing PascalCase ones
    [System.Text.Json.Serialization.JsonPropertyName("mbookCount")]
    public int MbookCount { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("mbookUploadedLive")]
    public int MbookUploadedLive { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("mbookNotUploadedLive")]
    public int MbookNotUploadedLive { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("totalDivisionCount")]
    public int TotalDivisionCount { get; set; }
}

// ── Housing ──────────────────────────────────────────────────────────────────
public class HousingOverallVm
{
    public int TotalHouses { get; set; } public int Started { get; set; } public int NotStarted { get; set; }
    public int Completed { get; set; } public int GradBeam { get; set; } public int Basement { get; set; }
    public int LintelLevel { get; set; } public int RoofLevel { get; set; } public int Completion { get; set; }
}
public class HousingDistrictVm : HousingOverallVm
{
    public int Sno { get; set; }
    public string Division { get; set; } = ""; public string District { get; set; } = "";
    public string Phase { get; set; } = "";
}
public class HousingMilestonesVm
{
    public int GradeBeam { get; set; } public int Basement { get; set; }
    public int LintelLevel { get; set; } public int RoofLevel { get; set; } public int Completion { get; set; }
}
public class HousingInfraVm
{
    public int HillArea { get; set; } public int OthersArea { get; set; } public int PlainArea { get; set; }
}
public class HousingDivisionVm
{
    public string Division { get; set; } = "";
    public int TotalHouses { get; set; } public int Completed { get; set; }
    public int Started { get; set; } public int NotStarted { get; set; }
}

// ── Enrollment ───────────────────────────────────────────────────────────────
public class EnrollSummaryVm
{
    public int TotalStudents { get; set; } public int Present { get; set; } public decimal AttendancePct { get; set; }
    public int NewEnrollment { get; set; } public int TotalCourses { get; set; } public int NewCourses { get; set; }
    public int TotalInstitutes { get; set; } public int NewInstitutes { get; set; }
    public int Male { get; set; } public int Female { get; set; } public int Others { get; set; }
}
public class EnrollInstituteVm
{
    public int Sno { get; set; }
    public string Division { get; set; } = ""; public string District { get; set; } = "";
    public string Institute { get; set; } = ""; public string Course { get; set; } = "";
    public string Status { get; set; } = "";
    public int TotalStudents { get; set; } public int Present { get; set; }
    public decimal AttendancePct { get; set; } public string Grade { get; set; } = "";
}
public class EnrollDistrictVm
{
    public string District { get; set; } = "";
    public int Total { get; set; } public int Completed { get; set; } public int Ongoing { get; set; }
}
public class EnrollDivisionVm
{
    public string Division { get; set; } = "";
    public int Students { get; set; } public int Present { get; set; } public decimal AttendancePct { get; set; }
}
public class GradeDistributionVm
{
    public int Excellent { get; set; } public int Good { get; set; }
    public int Average { get; set; } public int Poor { get; set; }
}
public class MonthlyCompletionVm { public string Month { get; set; } = ""; public int Count { get; set; } }

// ── Schemes / TELP / One Portal ─────────────────────────────────────────────
public class SchemeVm
{
    public int Sno { get; set; }
    public string Project { get; set; } = ""; public string Scheme { get; set; } = "";
    public string SubScheme { get; set; } = "";
    public int Apply { get; set; } public int DmPending { get; set; }
    public int HqPending { get; set; } public int PaymentPending { get; set; }
}
public class TelpAgencyVm
{
    public string Agency { get; set; } = "";
    public int Apply { get; set; } public int DmPending { get; set; } public int HqPending { get; set; }
}
public class MemberSummaryVm
{
    public int TotalWorks { get; set; } public int Save { get; set; } public int DmPending { get; set; }
    public int HqPending { get; set; } public int CardInProgress { get; set; } public int CardIssued { get; set; }
}
public class MemberDistrictVm : MemberSummaryVm
{
    public string Division { get; set; } = ""; public string District { get; set; } = "";
}
public class SchemeSummaryVm
{
    public int TotalApply { get; set; } public int DmPending { get; set; }
    public int HqPending { get; set; } public int PaymentPending { get; set; }
}

// ── TOD / Patrol360 ──────────────────────────────────────────────────────────
public class TodSummaryVm
{
    public int TotalTasks { get; set; } public int TotalEvents { get; set; }
    public int NotStarted { get; set; } public int InProgress { get; set; }
    public int Completed { get; set; } public int Overdue { get; set; }
}
public class TodDistrictVm
{
    public string Division { get; set; } = ""; public string District { get; set; } = "";
    public string TaskType { get; set; } = "";
    public int TaskCount { get; set; } public int NotStarted { get; set; }
    public int InProgress { get; set; } public int Completed { get; set; } public int Overdue { get; set; }
}
public class PatrolSummaryVm
{
    public int TotalWorks { get; set; } public int Started { get; set; } public int NotStarted { get; set; }
    public int InProgress { get; set; } public int Completed { get; set; }
    public int CameraInstalled { get; set; } public int CurrentActive { get; set; } public int CurrentInactive { get; set; }
}
public class PatrolDistrictVm : PatrolSummaryVm
{
    public string Division { get; set; } = ""; public string District { get; set; } = "";
}
public class OfflineDurationVm
{
    public int LessThan2Days { get; set; } public int Between3To10Days { get; set; } public int MoreThan10Days { get; set; }
}

public sealed record TipsTimeLiveResult(
    TenderSummaryVm TenderSummary,
    System.Collections.Generic.List<TenderDivisionVm> TenderDivisions,
    System.Collections.Generic.List<TenderDistrictVm> TenderDistricts,
    PatrolSummaryVm PatrolSummary,
    System.Collections.Generic.List<PatrolDistrictVm> PatrolDistricts);
