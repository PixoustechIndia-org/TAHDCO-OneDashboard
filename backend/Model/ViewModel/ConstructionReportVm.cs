using System;
using System.Collections.Generic;

namespace Model.ViewModel
{
    public class ConstructionWorkVm
    {
        public int Id { get; set; }
        public string GoReference { get; set; } = string.Empty;
        public string Division { get; set; } = "Trichy";
        public string District { get; set; } = string.Empty;
        public string Place { get; set; } = string.Empty;
        public string NameOfPremises { get; set; } = string.Empty;
        public string Components { get; set; } = string.Empty;
        public string Department { get; set; } = "Adidravidar Welfare Department"; // Adidravidar Welfare Department, Tribal Welfare Department, TAHDCO
        public string Category { get; set; } = "Schools"; // Hostels, Schools, Village Knowledge Centre, etc.
        public string WorkType { get; set; } = "Civil Construction";
        public int NumberOfFloors { get; set; } = 1;

        // Financials (in Rs. Lakh)
        public decimal EstimatedAmount { get; set; }
        public decimal ExpUptoPrevYear { get; set; }
        public decimal ExpDuringCurrYear { get; set; }
        public decimal TotalExpenditure => ExpUptoPrevYear + ExpDuringCurrYear;
        public decimal BalanceAmount => Math.Max(0, EstimatedAmount - TotalExpenditure);

        // Date Milestones
        public string? WorkOrderDate { get; set; }
        public string? AgreementDate { get; set; }
        public string AgreementPeriod { get; set; } = "6 Month";
        public string? ActualCommencementDate { get; set; }
        public string? CompletionDateAsPerAgt { get; set; }
        public string? ProbableDateOfCompletion { get; set; }

        // Progress Tracking
        public decimal ProgressPercentage { get; set; }
        public decimal PreviousProgressPercentage { get; set; }
        public string LastWeekProgress { get; set; } = string.Empty;
        public string ThisWeekProgress { get; set; } = string.Empty;
        public string WorkStatus { get; set; } = "Ongoing"; // Not Started, Ongoing, Completed, Delayed, On Hold
        public string ApprovalStatus { get; set; } = "Approved"; // Draft, Submitted, Reviewed, Approved, Rejected

        public string ResponsibleOfficer { get; set; } = "Executive Engineer";
        public string LastUpdated { get; set; } = DateTime.Now.ToString("yyyy-MM-dd HH:mm");
        public string Remarks { get; set; } = string.Empty;
    }

    public class ConstructionDashboardDto
    {
        public int TotalWorks { get; set; }
        public int OngoingWorks { get; set; }
        public int CompletedWorks { get; set; }
        public int DelayedWorks { get; set; }
        public int NotStartedWorks { get; set; }
        public int OverdueUpdatesCount { get; set; }

        public decimal TotalEstimatedAmount { get; set; }
        public decimal TotalExpUptoPrevYear { get; set; }
        public decimal TotalExpDuringCurrYear { get; set; }
        public decimal TotalExpenditure { get; set; }
        public decimal BalanceAmount { get; set; }

        // Department-wise & Category-wise matrix breakdown (from PDF Page 2)
        public List<DepartmentCategoryMatrixRowDto> CategoryMatrix { get; set; } = new();
        public List<StatusChartDto> StatusDistribution { get; set; } = new();
        public List<DistrictSummaryDto> DistrictBreakdown { get; set; } = new();
    }

    public class DepartmentCategoryMatrixRowDto
    {
        public int SNo { get; set; }
        public string Description { get; set; } = string.Empty; // e.g. Hostels, Schools, etc.
        public int TotalNoOfWorks { get; set; }
        public decimal TotalEstAmt { get; set; }

        // Adidravidar Welfare Department
        public int AdidravidarWorks { get; set; }
        public decimal AdidravidarEstAmt { get; set; }
        public decimal AdidravidarExpUptoPrev { get; set; }
        public decimal AdidravidarExpDuringCurr { get; set; }
        public decimal AdidravidarTotalExp => AdidravidarExpUptoPrev + AdidravidarExpDuringCurr;

        // Tribal Welfare Department
        public int TribalWorks { get; set; }
        public decimal TribalEstAmt { get; set; }
        public decimal TribalExpUptoPrev { get; set; }
        public decimal TribalExpDuringCurr { get; set; }
        public decimal TribalTotalExp => TribalExpUptoPrev + TribalExpDuringCurr;

        // TAHDCO
        public int TahdcoWorks { get; set; }
        public decimal TahdcoEstAmt { get; set; }
        public decimal TahdcoExpUptoPrev { get; set; }
        public decimal TahdcoExpDuringCurr { get; set; }
        public decimal TahdcoTotalExp => TahdcoExpUptoPrev + TahdcoExpDuringCurr;

        public decimal TotalExp => AdidravidarTotalExp + TribalTotalExp + TahdcoTotalExp;
        public decimal Balance => Math.Max(0, TotalEstAmt - TotalExp);
    }

    public class StatusChartDto
    {
        public string Status { get; set; } = string.Empty;
        public int Count { get; set; }
        public decimal Percentage { get; set; }
        public string Color { get; set; } = string.Empty;
    }

    public class DistrictSummaryDto
    {
        public string District { get; set; } = string.Empty;
        public int TotalWorks { get; set; }
        public int CompletedWorks { get; set; }
        public int OngoingWorks { get; set; }
        public int DelayedWorks { get; set; }
        public decimal TotalEstAmt { get; set; }
        public decimal TotalExp { get; set; }
    }

    public class ConstructionProgressUpdateDto
    {
        public decimal ProgressPercentage { get; set; }
        public string ProgressDate { get; set; } = DateTime.Now.ToString("yyyy-MM-dd");
        public string LastWeekProgress { get; set; } = string.Empty;
        public string ThisWeekProgress { get; set; } = string.Empty;
        public string Remarks { get; set; } = string.Empty;
        public string WorkStatus { get; set; } = "Ongoing";
        public List<string> Photos { get; set; } = new();
        public List<string> Documents { get; set; } = new();
    }

    public class ConstructionScheduleDto
    {
        public int Id { get; set; }
        public int WorkId { get; set; }
        public string WorkName { get; set; } = string.Empty;
        public string District { get; set; } = string.Empty;
        public string ResponsibleOfficer { get; set; } = string.Empty;
        public string Frequency { get; set; } = "Weekly"; // Weekly, Fortnightly, Monthly
        public string StartDate { get; set; } = string.Empty;
        public string NextDueDate { get; set; } = string.Empty;
        public string Reminder { get; set; } = "1 day before";
        public string Status { get; set; } = "Pending"; // Pending, Submitted, Reviewed, Approved, Overdue
        public bool IsOverdue { get; set; }
    }

    public class ConstructionApprovalActionDto
    {
        public string Action { get; set; } = "Approve"; // Approve, Reject
        public string Comments { get; set; } = string.Empty;
        public string ReviewerName { get; set; } = string.Empty;
    }

    public class ConstructionFilterDto
    {
        public string? Division { get; set; }
        public string? Department { get; set; }
        public string? District { get; set; }
        public string? FinancialYear { get; set; }
        public string? WorkType { get; set; }
        public string? Category { get; set; }
        public string? Status { get; set; }
        public string? FromDate { get; set; }
        public string? ToDate { get; set; }
        public string? Search { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }
}
