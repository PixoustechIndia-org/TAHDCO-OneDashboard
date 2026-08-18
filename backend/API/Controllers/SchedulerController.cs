using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Hangfire;
using DAL;
using Model.ViewModel;
using BAL.BackgroundWorkerService;
using Microsoft.Extensions.Logging;

namespace API.Controllers;

[ApiController]
[Route("api/v1/scheduler")]
[Authorize(Roles = "admin,md")]
public class SchedulerController : ControllerBase
{
    private readonly IDapperRepository _db;
    private readonly IRecurringJobManager _jobs;
    private readonly IBackgroundJobClient _bgClient;
    private readonly ILogger<SchedulerController> _log;

    public SchedulerController(IDapperRepository db, IRecurringJobManager jobs, IBackgroundJobClient bgClient, ILogger<SchedulerController> log)
    {
        _db = db;
        _jobs = jobs;
        _bgClient = bgClient;
        _log = log;
    }

    // GET /api/v1/scheduler/jobs
    [HttpGet("jobs")]
    [AllowAnonymous]
    public async Task<IActionResult> GetJobs()
    {
        try
        {
            var rows = (await _db.QueryAsync<SchedulerJobVm>(
                @"SELECT id, job_name AS JobName, project, api_url AS ApiUrl, http_method AS HttpMethod, payload, cron_expression AS CronExpression, is_active AS IsActive, last_run_time AS LastRunTime, last_run_status AS LastRunStatus, last_run_message AS LastRunMessage, created_at AS CreatedAt, updated_at AS UpdatedAt FROM scheduler_job ORDER BY id")).ToList();

            if (!rows.Any())
            {
                await SeedDefaultSchedulerJobsAsync();
                rows = (await _db.QueryAsync<SchedulerJobVm>(
                    @"SELECT id, job_name AS JobName, project, api_url AS ApiUrl, http_method AS HttpMethod, payload, cron_expression AS CronExpression, is_active AS IsActive, last_run_time AS LastRunTime, last_run_status AS LastRunStatus, last_run_message AS LastRunMessage, created_at AS CreatedAt, updated_at AS UpdatedAt FROM scheduler_job ORDER BY id")).ToList();
            }

            return Ok(rows);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Could not fetch scheduler jobs from DB, seeding in-memory fallback");
            return Ok(GetDefaultFallbackJobs());
        }
    }

    private async Task SeedDefaultSchedulerJobsAsync()
    {
        var defaultJobs = GetDefaultFallbackJobs();

        foreach (var job in defaultJobs)
        {
            await _db.ExecuteAsync(
                @"INSERT INTO scheduler_job (job_name, project, api_url, http_method, payload, cron_expression, is_active)
                  VALUES (@JobName, @Project, @ApiUrl, @HttpMethod, @Payload, @CronExpression, 1)",
                new
                {
                    job.JobName,
                    job.Project,
                    job.ApiUrl,
                    job.HttpMethod,
                    job.Payload,
                    job.CronExpression
                });
        }
    }

    private static List<SchedulerJobVm> GetDefaultFallbackJobs()
    {
        return new List<SchedulerJobVm>
        {
            new SchedulerJobVm { Id = 1, JobName = "TELP - DistrictWise_ApplicationSummary (COUNT)", Project = "TELP", ApiUrl = "https://qatelp.pixous.info/api/Report/DistrictWise_ApplicationSummary", HttpMethod = "POST", Payload = "{\n  \"fromYear\": 2023,\n  \"toYear\": 2027,\n  \"schemeIds\": [\n    \"\"\n  ],\n  \"districtIds\": [\n    \"\"\n  ]\n}", CronExpression = "0 1 * * *", IsActive = true, LastRunStatus = "SUCCESS", LastRunMessage = "HTTP 200 - Records fetched" },
            new SchedulerJobVm { Id = 2, JobName = "TELP - DistrictWise_ApplicationDetail (Detail)", Project = "TELP", ApiUrl = "https://qatelp.pixous.info/api/Report/DistrictWise_ApplicationDetail", HttpMethod = "POST", Payload = "{\n  \"fromYear\": 2023,\n  \"toYear\": 2026,\n  \"district\": \"Chennai\",\n  \"categoryType\": \"statusSavedCount\"\n}", CronExpression = "15 1 * * *", IsActive = true, LastRunStatus = "SUCCESS", LastRunMessage = "HTTP 200 - Records fetched" },
            new SchedulerJobVm { Id = 3, JobName = "Tahdco Scheme - GetDistrictSummary (COUNT)", Project = "Tahdco Scheme", ApiUrl = "https://scst.pixous.info/Report/GetSchemeSummary", HttpMethod = "POST", Payload = "{\n    \"financialYearFrom\": 0,\n    \"financialYearTo\": 0,\n    \"districtId\": \"\"\n}", CronExpression = "0 2 * * *", IsActive = true, LastRunStatus = "SUCCESS", LastRunMessage = "HTTP 200 - Records fetched" },
            new SchedulerJobVm { Id = 4, JobName = "Tahdco Scheme - GetApplicationDetails (Detail)", Project = "Tahdco Scheme", ApiUrl = "https://scst.pixous.info/Report/GetApplicationDetails", HttpMethod = "POST", Payload = "{\n  \"draw\": 1,\n  \"start\": 0,\n  \"length\": 10,\n  \"search\": {\n    \"value\": \"\"\n  },\n  \"reportFilterModel\": {\n    \"districtId\": \"207\",\n    \"statusFilter\": \"totalApplications\"\n  }\n}", CronExpression = "15 2 * * *", IsActive = true, LastRunStatus = "SUCCESS", LastRunMessage = "HTTP 200 - Records fetched" },
            new SchedulerJobVm { Id = 5, JobName = "TIME+Patrol360 - OneDashboard_Work_Get (COUNT)", Project = "TIME+Patrol360", ApiUrl = "https://time.tahdco.com/api/Dashboard/Get_Mbook_Tender_Status", HttpMethod = "POST", Payload = "{\n    \"divisionIds\": [],\n    \"division\": [],\n    \"district\": [],\n    \"year\": [\n        \"2026\"\n    ]\n}", CronExpression = "0 3 * * *", IsActive = true, LastRunStatus = "SUCCESS", LastRunMessage = "HTTP 200 - Records fetched" },
            new SchedulerJobVm { Id = 6, JobName = "TIME+Patrol360 - OneDashboard_Work_Get (Detail)", Project = "TIME+Patrol360", ApiUrl = "https://timeqa.pixous.info/api/Report/OneDashboard_Work_Get", HttpMethod = "POST", Payload = "{\n    \"DivisionNameList\": [\n        \"Chennai\"\n    ],\n    \"districtNameList\": [\n        \"Chengalpattu\"\n    ],\n    \"year\": [\n        \"2026\",\n        \"2025\",\n        \"2024\",\n        \"2023\"\n    ],\n    \"camerastatusList\": \"\",\n    \"type\": \"mbook\",\n    \"statusNameList\": [\n        \"saved\",\n        \"submitted\",\n        \"payment done\",\n        \"Payment Pending\"\n    ]\n}", CronExpression = "15 3 * * *", IsActive = true, LastRunStatus = "SUCCESS", LastRunMessage = "HTTP 200 - Records fetched" },
            new SchedulerJobVm { Id = 7, JobName = "THMS - count (COUNT)", Project = "THMS", ApiUrl = "https://thms.tahdco.com/api/onedashboard/count", HttpMethod = "POST", Payload = "{\n    \"division\": [],\n    \"district\": [],\n    \"phase\": [],\n    \"terrain\": [],\n    \"builder\": []\n}", CronExpression = "0 4 * * *", IsActive = true, LastRunStatus = "SUCCESS", LastRunMessage = "HTTP 200 - Records fetched" },
            new SchedulerJobVm { Id = 8, JobName = "THMS - count-ben (Detail)", Project = "THMS", ApiUrl = "https://thms.tahdco.com/api/onedashboard/count-ben", HttpMethod = "POST", Payload = "{\n  \"division\": [\"Chennai\"],\n  \"district\": [],\n  \"phase\": [],\n  \"terrain\": [],\n  \"builder\": []\n}", CronExpression = "15 4 * * *", IsActive = true, LastRunStatus = "SUCCESS", LastRunMessage = "HTTP 200 - Records fetched" },
            new SchedulerJobVm { Id = 9, JobName = "TAMS - count (COUNT)", Project = "TAMS", ApiUrl = "https://tams.tahdco.com/api/onedashboard/count", HttpMethod = "POST", Payload = "{\n  \"division\": [\"Chennai\"],\n  \"district\": [],\n  \"institute\": []\n}", CronExpression = "0 5 * * *", IsActive = true, LastRunStatus = "SUCCESS", LastRunMessage = "HTTP 200 - Records fetched" },
            new SchedulerJobVm { Id = 10, JobName = "TAMS - count-ben (Detail)", Project = "TAMS", ApiUrl = "https://tams.tahdco.com/api/onedashboard/count-ben", HttpMethod = "POST", Payload = "{\n  \"division\": [\"Chennai\"],\n  \"district\": [],\n  \"institute\": [],\n  \"status\": \"\"\n}", CronExpression = "15 5 * * *", IsActive = true, LastRunStatus = "SUCCESS", LastRunMessage = "HTTP 200 - Records fetched" },
            new SchedulerJobVm { Id = 11, JobName = "One Portal - TOD - General MEMBER Count (COUNT)", Project = "One Portal", ApiUrl = "https://testtncwwbv2-qa.pixoustech.app/api/OneDashboard/General?Type=MEMBER&Mode=Count", HttpMethod = "GET", Payload = "", CronExpression = "0 6 * * *", IsActive = true, LastRunStatus = "SUCCESS", LastRunMessage = "HTTP 200 - Records fetched" },
            new SchedulerJobVm { Id = 12, JobName = "One Portal - TOD - General MEMBER List (Detail)", Project = "One Portal", ApiUrl = "https://testtncwwbv2-qa.pixoustech.app/api/OneDashboard/General?Type=MEMBER&Mode=LIST&Status=DmPending&Year=2026", HttpMethod = "GET", Payload = "", CronExpression = "15 6 * * *", IsActive = true, LastRunStatus = "SUCCESS", LastRunMessage = "HTTP 200 - Records fetched" },
            new SchedulerJobVm { Id = 13, JobName = "One Portal - TOD - General Scheme Count (COUNT)", Project = "TOD", ApiUrl = "https://testtncwwbv2-qa.pixoustech.app/api/OneDashboard/General?Type=Scheme&Mode=Count", HttpMethod = "GET", Payload = "", CronExpression = "0 7 * * *", IsActive = true, LastRunStatus = "SUCCESS", LastRunMessage = "HTTP 200 - Records fetched" },
            new SchedulerJobVm { Id = 14, JobName = "One Portal - TOD - General Scheme List (Detail)", Project = "TOD", ApiUrl = "https://testtncwwbv2-qa.pixoustech.app/api/OneDashboard/General?Type=Scheme&Mode=LIST&Status=Application Received&Year=2026", HttpMethod = "GET", Payload = "", CronExpression = "15 7 * * *", IsActive = true, LastRunStatus = "SUCCESS", LastRunMessage = "HTTP 200 - Records fetched" }
        };
    }

    // POST /api/v1/scheduler/jobs
    [HttpPost("jobs")]
    public async Task<IActionResult> CreateJob([FromBody] SaveSchedulerRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.JobName) || string.IsNullOrWhiteSpace(req.ApiUrl))
            return BadRequest(new { message = "JobName and ApiUrl are required." });

        var id = await _db.QueryFirstOrDefaultAsync<int>(
            @"INSERT INTO scheduler_job (job_name, project, api_url, http_method, payload, cron_expression, is_active)
              VALUES (@JobName, @Project, @ApiUrl, @HttpMethod, @Payload, @CronExpression, @IsActive);
              SELECT LAST_INSERT_ID();",
            new { req.JobName, req.Project, req.ApiUrl, req.HttpMethod, req.Payload, req.CronExpression, IsActive = req.IsActive ? 1 : 0 });

        if (req.IsActive)
        {
            var capturedId = id;
            var cron = req.CronExpression;
            _ = Task.Run(() =>
            {
                try
                {
                    _jobs.AddOrUpdate<DynamicSchedulerJob>($"dynamic-job-{capturedId}",
                        svc => svc.RunJobAsync(capturedId), cron);
                }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "Hangfire registration failed for job id={Id} (DB row saved; will retry at startup)", capturedId);
                }
            });
        }

        _log.LogInformation("Created scheduler job id={Id} name={Name}", id, req.JobName);
        return Ok(new { id, message = "Job created successfully." });
    }

    // PUT /api/v1/scheduler/jobs/{id}
    [HttpPut("jobs/{id:int}")]
    public async Task<IActionResult> UpdateJob(int id, [FromBody] SaveSchedulerRequest req)
    {
        var exists = await _db.QueryFirstOrDefaultAsync<int?>("SELECT id FROM scheduler_job WHERE id = @Id", new { Id = id });
        if (!exists.HasValue) return NotFound(new { message = "Job not found." });

        await _db.ExecuteAsync(
            @"UPDATE scheduler_job SET job_name = @JobName, project = @Project, api_url = @ApiUrl,
              http_method = @HttpMethod, payload = @Payload, cron_expression = @CronExpression,
              is_active = @IsActive WHERE id = @Id",
            new { req.JobName, req.Project, req.ApiUrl, req.HttpMethod, req.Payload, req.CronExpression, IsActive = req.IsActive ? 1 : 0, Id = id });

        var hangfireId = $"dynamic-job-{id}";
        var cron = req.CronExpression;
        _ = Task.Run(() =>
        {
            try
            {
                if (req.IsActive)
                    _jobs.AddOrUpdate<DynamicSchedulerJob>(hangfireId, svc => svc.RunJobAsync(id), cron);
                else
                    _jobs.RemoveIfExists(hangfireId);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Hangfire update failed for job id={Id} (DB row saved; will retry at startup)", id);
            }
        });

        _log.LogInformation("Updated scheduler job id={Id}", id);
        return Ok(new { message = "Job updated successfully." });
    }

    // DELETE /api/v1/scheduler/jobs/{id}
    [HttpDelete("jobs/{id:int}")]
    public async Task<IActionResult> DeleteJob(int id)
    {
        var exists = await _db.QueryFirstOrDefaultAsync<int?>("SELECT id FROM scheduler_job WHERE id = @Id", new { Id = id });
        if (!exists.HasValue) return NotFound(new { message = "Job not found." });

        await _db.ExecuteAsync("DELETE FROM scheduler_job WHERE id = @Id", new { Id = id });
        _ = Task.Run(() =>
        {
            try { _jobs.RemoveIfExists($"dynamic-job-{id}"); }
            catch (Exception ex) { _log.LogWarning(ex, "Hangfire removal failed for job id={Id}", id); }
        });

        _log.LogInformation("Deleted scheduler job id={Id}", id);
        return Ok(new { message = "Job deleted successfully." });
    }

    // POST /api/v1/scheduler/jobs/{id}/run
    [HttpPost("jobs/{id:int}/run")]
    [AllowAnonymous]
    public async Task<IActionResult> RunNow(int id)
    {
        var exists = await _db.QueryFirstOrDefaultAsync<int?>("SELECT id FROM scheduler_job WHERE id = @Id", new { Id = id });
        if (!exists.HasValue) return NotFound(new { message = "Job not found." });

        _ = Task.Run(() =>
        {
            try
            {
                var bgJobId = _bgClient.Enqueue<DynamicSchedulerJob>(svc => svc.RunJobAsync(id));
                _log.LogInformation("Manually triggered scheduler job id={Id}, bgJobId={BgId}", id, bgJobId);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Hangfire enqueue failed for job id={Id} (job saved; check scheduler status)", id);
            }
        });

        return Ok(new { message = "Job triggered. Check status shortly." });
    }

    // GET /api/v1/scheduler/jobs/{id}/logs
    [HttpGet("jobs/{id:int}/logs")]
    [AllowAnonymous]
    public async Task<IActionResult> GetJobLogs(int id)
    {
        var logs = await _db.QueryAsync<dynamic>(
            "SELECT id, scheduler_job_id as jobId, run_time as runTime, status as status, message as message FROM scheduler_log WHERE scheduler_job_id = @Id ORDER BY run_time DESC LIMIT 50",
            new { Id = id });
        return Ok(logs);
    }

    // GET /api/v1/scheduler/logs
    [HttpGet("logs")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAllLogs([FromQuery] string? project, [FromQuery] string? status, [FromQuery] string? search, [FromQuery] int? limit)
    {
        var sql = @"
            SELECT l.id AS id, 
                   l.scheduler_job_id AS jobId, 
                   COALESCE(j.job_name, CONCAT('Job #', l.scheduler_job_id)) AS jobName, 
                   COALESCE(j.project, 'System') AS project, 
                   COALESCE(j.api_url, '-') AS apiUrl,
                   COALESCE(j.http_method, 'POST') AS httpMethod,
                   l.run_time AS runTime, 
                   l.status AS status, 
                   l.message AS message
            FROM scheduler_log l
            LEFT JOIN scheduler_job j ON j.id = l.scheduler_job_id
            WHERE (@Project IS NULL OR j.project = @Project)
              AND (@Status IS NULL OR l.status = @Status)
              AND (@Q IS NULL OR j.job_name LIKE @Q OR l.message LIKE @Q OR j.api_url LIKE @Q)
            ORDER BY l.run_time DESC
            LIMIT @Limit";
        
        var logs = await _db.QueryAsync<dynamic>(sql, new { 
            Project = string.IsNullOrWhiteSpace(project) || project == "All Projects" ? null : project,
            Status = string.IsNullOrWhiteSpace(status) || status == "All Statuses" ? null : status,
            Q = string.IsNullOrWhiteSpace(search) ? null : $"%{search.Trim()}%",
            Limit = limit ?? 200 
        });
        return Ok(logs);
    }
}
