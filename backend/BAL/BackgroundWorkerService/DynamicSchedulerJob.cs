using Microsoft.Extensions.Logging;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using DAL;
using Model.ViewModel;

namespace BAL.BackgroundWorkerService;

/// <summary>
/// Dynamically-scheduled job that hits any configured external API,
/// logs results, and updates the scheduler_job table.
/// </summary>
public class DynamicSchedulerJob
{
    private readonly IHttpClientFactory _clientFactory;
    private readonly IDapperRepository _db;
    private readonly ILogger<DynamicSchedulerJob> _log;

    public DynamicSchedulerJob(IHttpClientFactory clientFactory, IDapperRepository db, ILogger<DynamicSchedulerJob> log)
    {
        _clientFactory = clientFactory;
        _db = db;
        _log = log;
    }

    public async Task RunJobAsync(int jobId)
    {
        // Fetch job config from DB
        var job = await _db.QueryFirstOrDefaultAsync<SchedulerJobVm>(
            "SELECT id, job_name AS JobName, project AS Project, api_url AS ApiUrl, http_method AS HttpMethod, payload AS Payload, cron_expression AS CronExpression, is_active AS IsActive FROM scheduler_job WHERE id = @Id",
            new { Id = jobId });

        if (job == null)
        {
            _log.LogWarning("DynamicSchedulerJob: No job found for id={Id}", jobId);
            return;
        }
        if (!job.IsActive)
        {
            _log.LogInformation("DynamicSchedulerJob: Job {Id} ({Name}) is inactive, skipping.", jobId, job.JobName);
            return;
        }

        _log.LogInformation("DynamicSchedulerJob starting: id={Id}, name={Name}, project={Project}", jobId, job.JobName, job.Project);

        // Mark as running
        await _db.ExecuteAsync("UPDATE scheduler_job SET last_run_time = @Now, last_run_status = 'RUNNING', last_run_message = NULL WHERE id = @Id",
            new { Now = DateTime.UtcNow, Id = jobId });

        try
        {
            var client = _clientFactory.CreateClient("external");
            client.Timeout = TimeSpan.FromSeconds(60);

            HttpResponseMessage resp;
            var method = (job.HttpMethod ?? "POST").ToUpperInvariant();

            if (method == "GET")
            {
                resp = await client.GetAsync(job.ApiUrl);
            }
            else
            {
                var content = job.Payload != null
                    ? new StringContent(job.Payload, Encoding.UTF8, "application/json")
                    : (HttpContent)new StringContent("", Encoding.UTF8, "application/json");
                resp = await client.PostAsync(job.ApiUrl, content);
            }

            resp.EnsureSuccessStatusCode();
            var body = await resp.Content.ReadAsStringAsync();
            var preview = body.Length > 300 ? body[..300] + "…" : body;

            _log.LogInformation("DynamicSchedulerJob {Id} ({Name}) completed. Status={StatusCode}. Preview: {Preview}",
                jobId, job.JobName, (int)resp.StatusCode, preview);

            var successMsg = $"HTTP {(int)resp.StatusCode} · {preview}";
            await _db.ExecuteAsync("UPDATE scheduler_job SET last_run_status = 'SUCCESS', last_run_message = @Msg WHERE id = @Id",
                new { Msg = successMsg, Id = jobId });
            await _db.ExecuteAsync("INSERT INTO scheduler_log (scheduler_job_id, run_time, status, message) VALUES (@Id, @Now, 'SUCCESS', @Msg)",
                new { Id = jobId, Now = DateTime.UtcNow, Msg = successMsg });
        }
        catch (Exception ex)
        {
            var failMsg = ex.Message[..Math.Min(ex.Message.Length, 500)];
            _log.LogError(ex, "DynamicSchedulerJob {Id} ({Name}) failed.", jobId, job.JobName);
            await _db.ExecuteAsync("UPDATE scheduler_job SET last_run_status = 'FAILED', last_run_message = @Msg WHERE id = @Id",
                new { Msg = failMsg, Id = jobId });
            await _db.ExecuteAsync("INSERT INTO scheduler_log (scheduler_job_id, run_time, status, message) VALUES (@Id, @Now, 'FAILED', @Msg)",
                new { Id = jobId, Now = DateTime.UtcNow, Msg = failMsg });
            throw;
        }
    }
}
