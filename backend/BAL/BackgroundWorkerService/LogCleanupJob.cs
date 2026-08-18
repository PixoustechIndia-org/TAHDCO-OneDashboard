using Microsoft.Extensions.Logging;
using DAL;

namespace BAL.BackgroundWorkerService;

/// <summary>Hangfire recurring job: prunes Serilog rows older than 30 days.</summary>
public class LogCleanupJob
{
    private readonly IDapperRepository _db;
    private readonly ILogger<LogCleanupJob> _log;

    public LogCleanupJob(IDapperRepository db, ILogger<LogCleanupJob> log)
    { _db = db; _log = log; }

    public async Task RunAsync()
    {
        var removed = await _db.ExecuteAsync(
            "DELETE FROM app_logs WHERE Timestamp < DATE_SUB(NOW(), INTERVAL 30 DAY)");
        _log.LogInformation("LogCleanupJob removed {Count} old log rows", removed);
    }
}
