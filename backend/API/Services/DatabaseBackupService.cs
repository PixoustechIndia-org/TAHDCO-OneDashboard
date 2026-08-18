using System.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace API.Services;

public class DatabaseBackupService : BackgroundService
{
    private readonly ILogger<DatabaseBackupService> _logger;
    private readonly string _connectionString;

    public DatabaseBackupService(ILogger<DatabaseBackupService> logger, IConfiguration config)
    {
        _logger = logger;
        _connectionString = config.GetConnectionString("DefaultConnection") ?? "";
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.Now;
            var nextRun = new DateTime(now.Year, now.Month, now.Day, 23, 0, 0); // 11:00 PM

            if (now > nextRun)
            {
                nextRun = nextRun.AddDays(1);
            }

            var delay = nextRun - now;
            _logger.LogInformation("Next database backup scheduled for {NextRun} (in {DelayHours} hours).", nextRun, delay.TotalHours);

            await Task.Delay(delay, stoppingToken);

            if (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    RunBackup();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred during database backup.");
                }
            }
        }
    }

    private void RunBackup()
    {
        var backupFolder = Path.Combine(Directory.GetCurrentDirectory(), "Backups");
        if (!Directory.Exists(backupFolder)) Directory.CreateDirectory(backupFolder);
        
        var fileName = $"tahdco_backup_{DateTime.Now:yyyyMMdd_HHmm}.sql";
        var fullPath = Path.Combine(backupFolder, fileName);

        var args = $"-u root -pPassword123! tahdco_db -r \"{fullPath}\""; // Replace with parsed credentials in prod

        var psi = new ProcessStartInfo
        {
            FileName = "mysqldump",
            Arguments = args,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        try 
        {
            using var process = Process.Start(psi);
            if (process != null)
            {
                process.WaitForExit();
                if (process.ExitCode == 0)
                {
                    _logger.LogInformation("Database backup successfully created at {FullPath}", fullPath);
                }
                else
                {
                    var error = process.StandardError.ReadToEnd();
                    _logger.LogError("mysqldump failed with exit code {ExitCode}. Error: {Error}", process.ExitCode, error);
                }
            }
        } 
        catch (Exception ex) 
        {
            _logger.LogError(ex, "Failed to launch mysqldump. Ensure it is installed and in the system PATH.");
        }
    }
}
