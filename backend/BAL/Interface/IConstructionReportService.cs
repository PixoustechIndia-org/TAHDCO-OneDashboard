using System.Collections.Generic;
using System.Threading.Tasks;
using Model.ViewModel;

namespace BAL.Interface
{
    public interface IConstructionReportService
    {
        Task<ConstructionDashboardDto> GetDashboardSummaryAsync(ConstructionFilterDto filter, int userId, string userRole);
        Task<(List<ConstructionWorkVm> Works, int TotalCount)> GetWorkListAsync(ConstructionFilterDto filter, int userId, string userRole);
        Task<ConstructionWorkVm?> GetWorkByIdAsync(int id, int userId, string userRole);
        Task<ConstructionWorkVm> CreateWorkAsync(ConstructionWorkVm work, int userId);
        Task<ConstructionWorkVm?> UpdateWorkAsync(int id, ConstructionWorkVm work, int userId);
        Task<bool> DeleteWorkAsync(int id, int userId);

        Task<bool> UpdateProgressAsync(int id, ConstructionProgressUpdateDto req, int userId);
        Task<List<ConstructionProgressUpdateDto>> GetProgressHistoryAsync(int id);

        Task<List<ConstructionScheduleDto>> GetSchedulesAsync(ConstructionFilterDto filter, int userId);
        Task<ConstructionScheduleDto> CreateScheduleAsync(ConstructionScheduleDto schedule, int userId);
        Task<ConstructionScheduleDto?> UpdateScheduleAsync(int id, ConstructionScheduleDto schedule, int userId);
        Task<bool> CompleteScheduleAsync(int id, int userId);

        Task<bool> ApproveProgressAsync(int id, ConstructionApprovalActionDto action, int userId);
        Task<bool> RejectProgressAsync(int id, ConstructionApprovalActionDto action, int userId);

        Task<object> GetExportDataAsync(ConstructionFilterDto filter, int userId);
    }
}
