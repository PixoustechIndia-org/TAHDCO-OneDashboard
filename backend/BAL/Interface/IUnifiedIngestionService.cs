using System.Collections.Generic;
using System.Threading.Tasks;
using Model.ViewModel;

namespace BAL.Interface
{
    public interface IUnifiedIngestionService
    {
        Task<UnifiedIngestionSyncResultDto> SyncAllProjectApisAsync();
        Task<UnifiedIngestionSyncResultDto> GetIngestionStatusAsync();
        Task<List<UnifiedProjectRecordDto>> GetRecordsAsync(string? projectName = null, string? district = null, string? status = null, int limit = 100);
        Task<Dictionary<string, object>> GetUnifiedDashboardCountsAsync();
    }
}
