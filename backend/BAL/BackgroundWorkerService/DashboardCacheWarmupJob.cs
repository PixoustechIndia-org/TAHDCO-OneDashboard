using Microsoft.Extensions.Logging;
using BAL.Interface;

namespace BAL.BackgroundWorkerService;

/// <summary>Hangfire recurring job: pre-computes the dashboard document per FY
/// so the first user of every cache window never pays the aggregation cost.</summary>
public class DashboardCacheWarmupJob
{
    private readonly IDashboardService _dashboard;
    private readonly ILogger<DashboardCacheWarmupJob> _log;

    public DashboardCacheWarmupJob(IDashboardService dashboard, ILogger<DashboardCacheWarmupJob> log)
    { _dashboard = dashboard; _log = log; }

    public async Task RunAsync()
    {
        foreach (var fy in new[] { "FY 2025-26", "FY 2024-25" })
        {
            await _dashboard.GetFullAsync(fy);
            _log.LogInformation("Dashboard cache warmed for {Fy}", fy);
        }
    }
}
