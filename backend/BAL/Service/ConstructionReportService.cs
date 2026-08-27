using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BAL.Interface;
using Model.ViewModel;

namespace BAL.Service
{
    public class ConstructionReportService : IConstructionReportService
    {
        private static readonly ConcurrentDictionary<int, ConstructionWorkVm> _works = new();
        private static readonly ConcurrentDictionary<int, List<ConstructionProgressUpdateDto>> _progressHistory = new();
        private static readonly ConcurrentDictionary<int, ConstructionScheduleDto> _schedules = new();
        private static int _nextWorkId = 1;
        private static int _nextScheduleId = 1;
        private static readonly object _lock = new();

        private static int GetNextWorkId() => System.Threading.Interlocked.Increment(ref _nextWorkId);
        private static int GetNextScheduleId() => System.Threading.Interlocked.Increment(ref _nextScheduleId);

        static ConstructionReportService()
        {
            InitializeSeedData();
        }

        private static void InitializeSeedData()
        {
            lock (_lock)
            {
                if (_works.Count > 0) return;

                // PDF Page 3 Items & representative state items
                var seedWorks = new List<ConstructionWorkVm>
                {
                    new ConstructionWorkVm
                    {
                        Id = _nextWorkId++,
                        GoReference = "82 / 03.10.24",
                        Division = "Trichy",
                        District = "Trichy",
                        Place = "Poigaipatty",
                        NameOfPremises = "HSS Poigaipatty",
                        Components = "1. 10 Class Room, 2. Science Lab, 3. Toilet Block",
                        Department = "Adidravidar Welfare Department",
                        Category = "Schools",
                        WorkType = "School Infrastructure & Lab",
                        NumberOfFloors = 2,
                        EstimatedAmount = 329.00m,
                        ExpUptoPrevYear = 0m,
                        ExpDuringCurrYear = 231.68m,
                        WorkOrderDate = "2024-11-11",
                        AgreementDate = "2024-11-27",
                        AgreementPeriod = "6 Month",
                        ActualCommencementDate = "2025-02-18",
                        CompletionDateAsPerAgt = "2025-09-17",
                        ProbableDateOfCompletion = "2026-06-15",
                        ProgressPercentage = 78m,
                        PreviousProgressPercentage = 68m,
                        LastWeekProgress = "Brickwork and roofing finished. Plastering work in progress.",
                        ThisWeekProgress = "Building painting work is in progress. Toilet Tiles work is in progress.",
                        WorkStatus = "Ongoing",
                        ApprovalStatus = "Approved",
                        ResponsibleOfficer = "Er. S. Murugesan (EE)",
                        LastUpdated = "2026-06-05 10:30"
                    },
                    new ConstructionWorkVm
                    {
                        Id = _nextWorkId++,
                        GoReference = "14 / 06.11.24",
                        Division = "Trichy",
                        District = "Trichy",
                        Place = "Kattur-Papakurichi",
                        NameOfPremises = "HSS Kattur-Papakurichi",
                        Components = "Girls 10 Class room",
                        Department = "Adidravidar Welfare Department",
                        Category = "Schools",
                        WorkType = "School Classroom Block",
                        NumberOfFloors = 2,
                        EstimatedAmount = 223.94m,
                        ExpUptoPrevYear = 0m,
                        ExpDuringCurrYear = 118.02m,
                        WorkOrderDate = "2025-05-26",
                        AgreementDate = "2025-05-30",
                        AgreementPeriod = "6 Month",
                        ActualCommencementDate = "2025-06-20",
                        CompletionDateAsPerAgt = "2025-12-19",
                        ProbableDateOfCompletion = "2026-05-31",
                        ProgressPercentage = 95m,
                        PreviousProgressPercentage = 88m,
                        LastWeekProgress = "Flooring and windows fixing completed.",
                        ThisWeekProgress = "Work nearly completed. Final electrical fixtures and campus cleaning ongoing.",
                        WorkStatus = "Ongoing",
                        ApprovalStatus = "Approved",
                        ResponsibleOfficer = "Er. S. Murugesan (EE)",
                        LastUpdated = "2026-06-05 11:15"
                    },
                    new ConstructionWorkVm
                    {
                        Id = _nextWorkId++,
                        GoReference = "45 / 12.01.25",
                        Division = "Madurai",
                        District = "Madurai",
                        Place = "Usilampatti",
                        NameOfPremises = "Tribal Residential Hostel",
                        Components = "50-Bed Hostel Block, Kitchen & Dining",
                        Department = "Tribal Welfare Department",
                        Category = "Hostels",
                        WorkType = "Hostel Building",
                        NumberOfFloors = 2,
                        EstimatedAmount = 285.50m,
                        ExpUptoPrevYear = 0m,
                        ExpDuringCurrYear = 195.20m,
                        WorkOrderDate = "2025-02-10",
                        AgreementDate = "2025-02-24",
                        AgreementPeriod = "8 Month",
                        ActualCommencementDate = "2025-03-05",
                        CompletionDateAsPerAgt = "2025-11-04",
                        ProbableDateOfCompletion = "2026-07-20",
                        ProgressPercentage = 68m,
                        PreviousProgressPercentage = 55m,
                        LastWeekProgress = "Second floor slab concrete curing completed.",
                        ThisWeekProgress = "Internal electrical wiring and plumbing line laying in progress.",
                        WorkStatus = "Ongoing",
                        ApprovalStatus = "Approved",
                        ResponsibleOfficer = "Er. K. Anbarasan (EE)",
                        LastUpdated = "2026-06-04 16:45"
                    },
                    new ConstructionWorkVm
                    {
                        Id = _nextWorkId++,
                        GoReference = "109 / 18.03.25",
                        Division = "Salem",
                        District = "Salem",
                        Place = "Attur",
                        NameOfPremises = "Village Knowledge Centre & Digital Hub",
                        Components = "E-Learning Hall, Solar Rooftop, Conference Room",
                        Department = "TAHDCO",
                        Category = "Village Knowledge Centre",
                        WorkType = "Knowledge Infrastructure",
                        NumberOfFloors = 1,
                        EstimatedAmount = 145.00m,
                        ExpUptoPrevYear = 0m,
                        ExpDuringCurrYear = 142.50m,
                        WorkOrderDate = "2025-04-15",
                        AgreementDate = "2025-04-28",
                        AgreementPeriod = "4 Month",
                        ActualCommencementDate = "2025-05-10",
                        CompletionDateAsPerAgt = "2025-09-09",
                        ProbableDateOfCompletion = "2026-05-15",
                        ProgressPercentage = 100m,
                        PreviousProgressPercentage = 95m,
                        LastWeekProgress = "Painting and solar panel testing complete.",
                        ThisWeekProgress = "Civil works 100% completed. Handover inspection conducted.",
                        WorkStatus = "Completed",
                        ApprovalStatus = "Approved",
                        ResponsibleOfficer = "Er. R. Venkatesh (EE)",
                        LastUpdated = "2026-05-18 14:00"
                    },
                    new ConstructionWorkVm
                    {
                        Id = _nextWorkId++,
                        GoReference = "67 / 08.02.25",
                        Division = "Coimbatore",
                        District = "Coimbatore",
                        Place = "Pollachi",
                        NameOfPremises = "Adidravidar Community Hall",
                        Components = "Main Auditorium (500 capacity), Dining Hall, Stage",
                        Department = "Adidravidar Welfare Department",
                        Category = "Community Hall",
                        WorkType = "Community Facility",
                        NumberOfFloors = 1,
                        EstimatedAmount = 190.00m,
                        ExpUptoPrevYear = 0m,
                        ExpDuringCurrYear = 85.00m,
                        WorkOrderDate = "2025-03-01",
                        AgreementDate = "2025-03-15",
                        AgreementPeriod = "6 Month",
                        ActualCommencementDate = "2025-04-01",
                        CompletionDateAsPerAgt = "2025-10-01",
                        ProbableDateOfCompletion = "2026-08-30",
                        ProgressPercentage = 45m,
                        PreviousProgressPercentage = 40m,
                        LastWeekProgress = "Roof truss fabrication in progress.",
                        ThisWeekProgress = "Steel roofing installation delayed due to steel delivery schedule.",
                        WorkStatus = "Delayed",
                        ApprovalStatus = "Approved",
                        ResponsibleOfficer = "Er. M. Sivakumar (EE)",
                        LastUpdated = "2026-06-03 09:20"
                    },
                    new ConstructionWorkVm
                    {
                        Id = _nextWorkId++,
                        GoReference = "211 / 22.04.25",
                        Division = "Chennai",
                        District = "Chennai",
                        Place = "Tambaram",
                        NameOfPremises = "Katral Karpithal Koodam (Smart Learning Lab)",
                        Components = "Interactive Audio-Visual Classrooms, Computing Lab",
                        Department = "Adidravidar Welfare Department",
                        Category = "Katral Karpithal Koodam",
                        WorkType = "Special Education Infrastructure",
                        NumberOfFloors = 2,
                        EstimatedAmount = 310.00m,
                        ExpUptoPrevYear = 0m,
                        ExpDuringCurrYear = 190.00m,
                        WorkOrderDate = "2025-05-12",
                        AgreementDate = "2025-05-25",
                        AgreementPeriod = "6 Month",
                        ActualCommencementDate = "2025-06-10",
                        CompletionDateAsPerAgt = "2025-12-09",
                        ProbableDateOfCompletion = "2026-06-30",
                        ProgressPercentage = 62m,
                        PreviousProgressPercentage = 50m,
                        LastWeekProgress = "First floor slab shuttering and reinforcement laying.",
                        ThisWeekProgress = "First floor concrete casting completed; curing in progress.",
                        WorkStatus = "Ongoing",
                        ApprovalStatus = "Approved",
                        ResponsibleOfficer = "Er. T. Loganathan (EE)",
                        LastUpdated = "2026-06-05 14:10"
                    }
                };

                foreach (var w in seedWorks)
                {
                    _works[w.Id] = w;

                    _progressHistory[w.Id] = new List<ConstructionProgressUpdateDto>
                    {
                        new ConstructionProgressUpdateDto
                        {
                            ProgressPercentage = w.ProgressPercentage,
                            ProgressDate = w.LastUpdated.Split(' ')[0],
                            LastWeekProgress = w.LastWeekProgress,
                            ThisWeekProgress = w.ThisWeekProgress,
                            WorkStatus = w.WorkStatus,
                            Remarks = "Weekly field progress validated by EE."
                        }
                    };

                    _schedules[w.Id] = new ConstructionScheduleDto
                    {
                        Id = _nextScheduleId++,
                        WorkId = w.Id,
                        WorkName = w.NameOfPremises,
                        District = w.District,
                        ResponsibleOfficer = w.ResponsibleOfficer,
                        Frequency = "Weekly",
                        StartDate = w.ActualCommencementDate ?? "2025-06-01",
                        NextDueDate = DateTime.Now.AddDays(w.WorkStatus == "Delayed" ? -3 : 4).ToString("yyyy-MM-dd"),
                        Status = w.WorkStatus == "Delayed" ? "Overdue" : "Pending",
                        IsOverdue = w.WorkStatus == "Delayed"
                    };
                }
            }
        }

        public Task<ConstructionDashboardDto> GetDashboardSummaryAsync(ConstructionFilterDto filter, int userId, string userRole)
        {
            var query = ApplyFilters(_works.Values.AsQueryable(), filter);
            var worksList = query.ToList();

            var result = new ConstructionDashboardDto
            {
                TotalWorks = worksList.Count,
                OngoingWorks = worksList.Count(w => w.WorkStatus == "Ongoing"),
                CompletedWorks = worksList.Count(w => w.WorkStatus == "Completed"),
                DelayedWorks = worksList.Count(w => w.WorkStatus == "Delayed"),
                NotStartedWorks = worksList.Count(w => w.WorkStatus == "Not Started"),
                OverdueUpdatesCount = _schedules.Values.Count(s => s.IsOverdue),

                TotalEstimatedAmount = worksList.Sum(w => w.EstimatedAmount),
                TotalExpUptoPrevYear = worksList.Sum(w => w.ExpUptoPrevYear),
                TotalExpDuringCurrYear = worksList.Sum(w => w.ExpDuringCurrYear),
                TotalExpenditure = worksList.Sum(w => w.TotalExpenditure),
                BalanceAmount = worksList.Sum(w => w.BalanceAmount)
            };

            // PDF Page 2 Category Matrix (11 Categories)
            var categoryDefinitions = new List<(int SNo, string Name)>
            {
                (1, "Hostels"),
                (2, "Schools"),
                (3, "Village Knowledge Centre"),
                (4, "Village Knowledge Centre - shed"),
                (5, "Community Hall"),
                (6, "Shopping Complex"),
                (7, "Katral Karpithal Koodam"),
                (8, "Special repair - Hostels"),
                (9, "Special repair - Schools"),
                (10, "Multipurpose center"),
                (11, "Others")
            };

            foreach (var cat in categoryDefinitions)
            {
                var catWorks = worksList.Where(w => w.Category.Equals(cat.Name, StringComparison.OrdinalIgnoreCase) ||
                    (cat.Name == "Others" && !categoryDefinitions.Take(10).Any(c => c.Name.Equals(w.Category, StringComparison.OrdinalIgnoreCase)))).ToList();

                var adiWorks = catWorks.Where(w => w.Department.Contains("Adidravidar", StringComparison.OrdinalIgnoreCase)).ToList();
                var triWorks = catWorks.Where(w => w.Department.Contains("Tribal", StringComparison.OrdinalIgnoreCase)).ToList();
                var tahWorks = catWorks.Where(w => w.Department.Contains("TAHDCO", StringComparison.OrdinalIgnoreCase)).ToList();

                result.CategoryMatrix.Add(new DepartmentCategoryMatrixRowDto
                {
                    SNo = cat.SNo,
                    Description = cat.Name,
                    TotalNoOfWorks = catWorks.Count,
                    TotalEstAmt = catWorks.Sum(w => w.EstimatedAmount),

                    AdidravidarWorks = adiWorks.Count,
                    AdidravidarEstAmt = adiWorks.Sum(w => w.EstimatedAmount),
                    AdidravidarExpUptoPrev = adiWorks.Sum(w => w.ExpUptoPrevYear),
                    AdidravidarExpDuringCurr = adiWorks.Sum(w => w.ExpDuringCurrYear),

                    TribalWorks = triWorks.Count,
                    TribalEstAmt = triWorks.Sum(w => w.EstimatedAmount),
                    TribalExpUptoPrev = triWorks.Sum(w => w.ExpUptoPrevYear),
                    TribalExpDuringCurr = triWorks.Sum(w => w.ExpDuringCurrYear),

                    TahdcoWorks = tahWorks.Count,
                    TahdcoEstAmt = tahWorks.Sum(w => w.EstimatedAmount),
                    TahdcoExpUptoPrev = tahWorks.Sum(w => w.ExpUptoPrevYear),
                    TahdcoExpDuringCurr = tahWorks.Sum(w => w.ExpDuringCurrYear)
                });
            }

            // Status Distribution Chart
            if (result.TotalWorks > 0)
            {
                result.StatusDistribution = new List<StatusChartDto>
                {
                    new StatusChartDto { Status = "Completed", Count = result.CompletedWorks, Percentage = Math.Round((decimal)result.CompletedWorks / result.TotalWorks * 100, 1), Color = "#10B981" },
                    new StatusChartDto { Status = "Ongoing", Count = result.OngoingWorks, Percentage = Math.Round((decimal)result.OngoingWorks / result.TotalWorks * 100, 1), Color = "#3B82F6" },
                    new StatusChartDto { Status = "Delayed", Count = result.DelayedWorks, Percentage = Math.Round((decimal)result.DelayedWorks / result.TotalWorks * 100, 1), Color = "#EF4444" },
                    new StatusChartDto { Status = "Not Started", Count = result.NotStartedWorks, Percentage = Math.Round((decimal)result.NotStartedWorks / result.TotalWorks * 100, 1), Color = "#94A3B8" }
                };
            }

            // District Breakdown
            result.DistrictBreakdown = worksList
                .GroupBy(w => string.IsNullOrWhiteSpace(w.District) ? "Other" : w.District)
                .Select(g => new DistrictSummaryDto
                {
                    District = g.Key,
                    TotalWorks = g.Count(),
                    CompletedWorks = g.Count(w => w.WorkStatus == "Completed"),
                    OngoingWorks = g.Count(w => w.WorkStatus == "Ongoing"),
                    DelayedWorks = g.Count(w => w.WorkStatus == "Delayed"),
                    TotalEstAmt = g.Sum(w => w.EstimatedAmount),
                    TotalExp = g.Sum(w => w.TotalExpenditure)
                })
                .OrderByDescending(d => d.TotalEstAmt)
                .ToList();

            return Task.FromResult(result);
        }

        public Task<(List<ConstructionWorkVm> Works, int TotalCount)> GetWorkListAsync(ConstructionFilterDto filter, int userId, string userRole)
        {
            var query = ApplyFilters(_works.Values.AsQueryable(), filter);
            var totalCount = query.Count();

            var page = filter.Page <= 0 ? 1 : filter.Page;
            var pageSize = filter.PageSize <= 0 ? 20 : filter.PageSize;

            var items = query
                .OrderByDescending(w => w.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            return Task.FromResult((items, totalCount));
        }

        public Task<ConstructionWorkVm?> GetWorkByIdAsync(int id, int userId, string userRole)
        {
            _works.TryGetValue(id, out var work);
            return Task.FromResult(work);
        }

        public Task<ConstructionWorkVm> CreateWorkAsync(ConstructionWorkVm work, int userId)
        {
            lock (_lock)
            {
                work.Id = GetNextWorkId();
                work.LastUpdated = DateTime.Now.ToString("yyyy-MM-dd HH:mm");
                _works[work.Id] = work;

                _progressHistory[work.Id] = new List<ConstructionProgressUpdateDto>
                {
                    new ConstructionProgressUpdateDto
                    {
                        ProgressPercentage = work.ProgressPercentage,
                        ProgressDate = DateTime.Now.ToString("yyyy-MM-dd"),
                        LastWeekProgress = work.LastWeekProgress,
                        ThisWeekProgress = work.ThisWeekProgress,
                        WorkStatus = work.WorkStatus,
                        Remarks = "Initial record creation."
                    }
                };

                _schedules[work.Id] = new ConstructionScheduleDto
                {
                    Id = GetNextScheduleId(),
                    WorkId = work.Id,
                    WorkName = work.NameOfPremises,
                    District = work.District,
                    ResponsibleOfficer = work.ResponsibleOfficer,
                    Frequency = "Weekly",
                    StartDate = work.ActualCommencementDate ?? DateTime.Now.ToString("yyyy-MM-dd"),
                    NextDueDate = DateTime.Now.AddDays(7).ToString("yyyy-MM-dd"),
                    Status = "Pending",
                    IsOverdue = false
                };

                return Task.FromResult(work);
            }
        }

        public Task<ConstructionWorkVm?> UpdateWorkAsync(int id, ConstructionWorkVm work, int userId)
        {
            if (!_works.ContainsKey(id)) return Task.FromResult<ConstructionWorkVm?>(null);

            work.Id = id;
            work.LastUpdated = DateTime.Now.ToString("yyyy-MM-dd HH:mm");
            _works[id] = work;
            return Task.FromResult<ConstructionWorkVm?>(work);
        }

        public Task<bool> DeleteWorkAsync(int id, int userId)
        {
            var removed = _works.TryRemove(id, out _);
            _progressHistory.TryRemove(id, out _);
            _schedules.TryRemove(id, out _);
            return Task.FromResult(removed);
        }

        public Task<bool> UpdateProgressAsync(int id, ConstructionProgressUpdateDto req, int userId)
        {
            if (!_works.TryGetValue(id, out var work)) return Task.FromResult(false);

            work.PreviousProgressPercentage = work.ProgressPercentage;
            work.ProgressPercentage = req.ProgressPercentage;
            work.LastWeekProgress = string.IsNullOrWhiteSpace(req.LastWeekProgress) ? work.ThisWeekProgress : req.LastWeekProgress;
            work.ThisWeekProgress = req.ThisWeekProgress;
            work.WorkStatus = req.WorkStatus;
            work.Remarks = req.Remarks;
            work.ApprovalStatus = "Submitted"; // triggers approval workflow
            work.LastUpdated = DateTime.Now.ToString("yyyy-MM-dd HH:mm");

            if (!_progressHistory.ContainsKey(id)) _progressHistory[id] = new List<ConstructionProgressUpdateDto>();
            _progressHistory[id].Insert(0, req);

            // Update associated schedule
            var schedule = _schedules.Values.FirstOrDefault(s => s.WorkId == id);
            if (schedule != null)
            {
                schedule.Status = "Submitted";
                schedule.IsOverdue = false;
                schedule.NextDueDate = DateTime.Now.AddDays(schedule.Frequency == "Monthly" ? 30 : (schedule.Frequency == "Fortnightly" ? 14 : 7)).ToString("yyyy-MM-dd");
            }

            return Task.FromResult(true);
        }

        public Task<List<ConstructionProgressUpdateDto>> GetProgressHistoryAsync(int id)
        {
            if (_progressHistory.TryGetValue(id, out var list))
            {
                return Task.FromResult(list);
            }
            return Task.FromResult(new List<ConstructionProgressUpdateDto>());
        }

        public Task<List<ConstructionScheduleDto>> GetSchedulesAsync(ConstructionFilterDto filter, int userId)
        {
            var list = _schedules.Values.ToList();
            var today = DateTime.Now.ToString("yyyy-MM-dd");
            foreach (var s in list)
            {
                if (string.Compare(s.NextDueDate, today, StringComparison.Ordinal) < 0 && s.Status != "Approved")
                {
                    s.IsOverdue = true;
                    s.Status = "Overdue";
                }
            }
            return Task.FromResult(list.OrderBy(s => s.NextDueDate).ToList());
        }

        public Task<ConstructionScheduleDto> CreateScheduleAsync(ConstructionScheduleDto schedule, int userId)
        {
            lock (_lock)
            {
                schedule.Id = _nextScheduleId++;
                _schedules[schedule.Id] = schedule;
                return Task.FromResult(schedule);
            }
        }

        public Task<ConstructionScheduleDto?> UpdateScheduleAsync(int id, ConstructionScheduleDto schedule, int userId)
        {
            if (!_schedules.ContainsKey(id)) return Task.FromResult<ConstructionScheduleDto?>(null);
            schedule.Id = id;
            _schedules[id] = schedule;
            return Task.FromResult<ConstructionScheduleDto?>(schedule);
        }

        public Task<bool> CompleteScheduleAsync(int id, int userId)
        {
            if (!_schedules.TryGetValue(id, out var schedule)) return Task.FromResult(false);
            schedule.Status = "Submitted";
            schedule.IsOverdue = false;
            schedule.NextDueDate = DateTime.Now.AddDays(schedule.Frequency == "Monthly" ? 30 : 7).ToString("yyyy-MM-dd");
            return Task.FromResult(true);
        }

        public Task<bool> ApproveProgressAsync(int id, ConstructionApprovalActionDto action, int userId)
        {
            if (!_works.TryGetValue(id, out var work)) return Task.FromResult(false);
            work.ApprovalStatus = "Approved";
            work.Remarks = string.IsNullOrWhiteSpace(action.Comments) ? work.Remarks : $"{work.Remarks} [Approved: {action.Comments}]";

            var schedule = _schedules.Values.FirstOrDefault(s => s.WorkId == id);
            if (schedule != null) schedule.Status = "Approved";

            return Task.FromResult(true);
        }

        public Task<bool> RejectProgressAsync(int id, ConstructionApprovalActionDto action, int userId)
        {
            if (!_works.TryGetValue(id, out var work)) return Task.FromResult(false);
            work.ApprovalStatus = "Rejected";
            work.Remarks = string.IsNullOrWhiteSpace(action.Comments) ? work.Remarks : $"{work.Remarks} [Rejected: {action.Comments}]";

            var schedule = _schedules.Values.FirstOrDefault(s => s.WorkId == id);
            if (schedule != null) schedule.Status = "Pending";

            return Task.FromResult(true);
        }

        public Task<object> GetExportDataAsync(ConstructionFilterDto filter, int userId)
        {
            var query = ApplyFilters(_works.Values.AsQueryable(), filter);
            var list = query.ToList();
            return Task.FromResult<object>(new
            {
                generatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                totalRecords = list.Count,
                records = list
            });
        }

        private static IQueryable<ConstructionWorkVm> ApplyFilters(IQueryable<ConstructionWorkVm> query, ConstructionFilterDto filter)
        {
            if (!string.IsNullOrWhiteSpace(filter.Division))
            {
                var divs = filter.Division.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (divs.Length > 0 && !divs.Contains("All", StringComparer.OrdinalIgnoreCase))
                    query = query.Where(w => divs.Contains(w.Division, StringComparer.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(filter.Department))
            {
                var depts = filter.Department.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (depts.Length > 0 && !depts.Contains("All", StringComparer.OrdinalIgnoreCase))
                    query = query.Where(w => depts.Any(d => w.Department.Contains(d, StringComparison.OrdinalIgnoreCase)));
            }

            if (!string.IsNullOrWhiteSpace(filter.District))
            {
                var dists = filter.District.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (dists.Length > 0 && !dists.Contains("All", StringComparer.OrdinalIgnoreCase))
                    query = query.Where(w => dists.Contains(w.District, StringComparer.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(filter.Category))
            {
                var cats = filter.Category.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (cats.Length > 0 && !cats.Contains("All", StringComparer.OrdinalIgnoreCase))
                    query = query.Where(w => cats.Contains(w.Category, StringComparer.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(filter.Status))
            {
                var stats = filter.Status.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (stats.Length > 0 && !stats.Contains("All", StringComparer.OrdinalIgnoreCase))
                    query = query.Where(w => stats.Contains(w.WorkStatus, StringComparer.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(filter.Search))
            {
                var s = filter.Search.Trim().ToLowerInvariant();
                query = query.Where(w =>
                    w.NameOfPremises.ToLowerInvariant().Contains(s) ||
                    w.GoReference.ToLowerInvariant().Contains(s) ||
                    w.District.ToLowerInvariant().Contains(s) ||
                    w.Place.ToLowerInvariant().Contains(s) ||
                    w.Components.ToLowerInvariant().Contains(s));
            }

            return query;
        }
    }
}
