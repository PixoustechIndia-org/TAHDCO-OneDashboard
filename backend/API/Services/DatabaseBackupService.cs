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

        string args;
        if (!string.IsNullOrWhiteSpace(_connectionString))
        {
            try
            {
                var csb = new MySqlConnector.MySqlConnectionStringBuilder(_connectionString);
                var host = string.IsNullOrWhiteSpace(csb.Server) ? "localhost" : csb.Server;
                var port = csb.Port > 0 ? csb.Port : 3306;
                var user = string.IsNullOrWhiteSpace(csb.UserID) ? "root" : csb.UserID;
                var db = string.IsNullOrWhiteSpace(csb.Database) ? "tahdco_udp" : csb.Database;
                var passArg = string.IsNullOrWhiteSpace(csb.Password) ? "" : $"-p\"{csb.Password}\"";

                args = $"-h {host} -P {port} -u {user} {passArg} {db} -r \"{fullPath}\"";
            }
            catch
            {
                args = $"-u root tahdco_udp -r \"{fullPath}\"";
            }
        }
        else
        {
            args = $"-u root tahdco_udp -r \"{fullPath}\"";
        }

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
