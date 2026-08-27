using Hangfire;
using Microsoft.AspNetCore.Localization;
using Microsoft.AspNetCore.RateLimiting;
using QuestPDF.Infrastructure;
using Serilog;
using Serilog.Sinks.MariaDB;
using Serilog.Sinks.MariaDB.Extensions;
using System.Globalization;
using System.Threading.RateLimiting;
using API.Infrastructure;
using API.Middleware;
using BAL.BackgroundWorkerService;

var builder = WebApplication.CreateBuilder(args);

// ── Serilog: console + MariaDB/MySQL sink (auto-creates app_logs) ────────────
var connectionString = builder.Configuration.GetConnectionString("Default") ?? "";
var loggerConfig = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console();

if (!string.IsNullOrWhiteSpace(connectionString))
{
    try
    {
        loggerConfig.WriteTo.MariaDB(
            connectionString: connectionString,
            tableName: "app_logs",
            autoCreateTable: true,
            useBulkInsert: false);
    }
    catch { /* Console logging remains active */ }
}
Log.Logger = loggerConfig.CreateLogger();
builder.Host.UseSerilog();

// ── QuestPDF community license ───────────────────────────────────────────────
QuestPDF.Settings.License = LicenseType.Community;

// ── Services ─────────────────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerDocs();
builder.Services.AddAppServices(builder.Configuration);
builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddHangfireJobs(builder.Configuration);
builder.Services.AddCorsForAngular(builder.Configuration);

// Rate limiting: protect login endpoint from brute-force attacks
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("login", opt =>
    {
        opt.PermitLimit = 100;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 0;
    });
    options.RejectionStatusCode = 429;
});

// Register DB Backup background service
builder.Services.AddHostedService<API.Services.DatabaseBackupService>();

// session (backed by the distributed memory cache)
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(o =>
{
    o.IdleTimeout = TimeSpan.FromHours(8);
    o.Cookie.HttpOnly = true;
    o.Cookie.IsEssential = true;
});

// localization: English + Tamil
builder.Services.AddLocalization(o => o.ResourcesPath = "Resources");
var supportedCultures = new[] { new CultureInfo("en-IN"), new CultureInfo("ta-IN") };

var app = builder.Build();

//if (app.Environment.IsDevelopment())
//{
//    app.UseSwagger();
//    app.UseSwaggerUI(c =>
//        c.SwaggerEndpoint(
//            "/swagger/v1/swagger.json",
//            "TAHDCO UDP API v1"));
//}

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "TAHDCO UDP API v1");
    c.RoutePrefix = "swagger";
});

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<RequestLoggingMiddleware>();

app.UseCors("ng");

app.UseRequestLocalization(new RequestLocalizationOptions
{
    DefaultRequestCulture = new RequestCulture("en-IN"),
    SupportedCultures = supportedCultures,
    SupportedUICultures = supportedCultures
});

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseSession();

app.UseAuthentication();
app.UseAuthorization();

app.UseRateLimiter();

app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = new[]
    {
        new API.Infrastructure.HangfireAuthFilter()
    },
    DashboardTitle = "TAHDCO UDP Background Jobs"
});

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();

app.MapFallbackToFile("index.html");

try
{
    using (var scope = app.Services.CreateScope())
    {
        var jobs = scope.ServiceProvider.GetRequiredService<IRecurringJobManager>();
        jobs.AddOrUpdate<DashboardCacheWarmupJob>(
            "dashboard-cache-warmup", j => j.RunAsync(), "*/5 * * * *");
        jobs.AddOrUpdate<LogCleanupJob>(
            "log-cleanup", j => j.RunAsync(), "0 2 * * *");
        jobs.AddOrUpdate<HousingSyncJob>(
            "housing-sync", j => j.RunAsync(), "11 23 * * *");
        jobs.AddOrUpdate<TncwwbSyncJob>(
            "tncwwb-sync", j => j.RunAsync(), "22 23 * * *");
        jobs.AddOrUpdate<NotificationWorker>(
            "sla-threshold-alerts", j => j.RunAsync(), "*/10 * * * *");

        var dynDb = scope.ServiceProvider.GetRequiredService<DAL.IDapperRepository>();
        try
        {
            var dynJobs = await dynDb.QueryAsync<(int Id, string JobName, string CronExpression, bool IsActive)>(
                "SELECT id, job_name, cron_expression, CAST(is_active AS SIGNED) FROM scheduler_job");
            foreach (var dj in dynJobs)
            {
                var hangfireId = $"dynamic-job-{dj.Id}";
                var capturedId = dj.Id;
                try
                {
                    if (dj.IsActive)
                        jobs.AddOrUpdate<BAL.BackgroundWorkerService.DynamicSchedulerJob>(hangfireId, j => j.RunJobAsync(capturedId), dj.CronExpression);
                    else
                        jobs.RemoveIfExists(hangfireId);
                }
                catch (Exception jobEx)
                {
                    Log.Warning(jobEx, "Could not register dynamic scheduler job {Id} ({Name}) in Hangfire.", dj.Id, dj.JobName);
                }
            }
            Log.Information("Registered {Count} dynamic scheduler jobs from DB.", dynJobs.Count());
        }
        catch (Exception dynEx)
        {
            Log.Warning(dynEx, "Could not register dynamic scheduler jobs from DB.");
        }
    }
}
catch (Exception ex)
{
    Log.Error(ex, "Failed to register Hangfire recurring jobs.");
}

app.Run();