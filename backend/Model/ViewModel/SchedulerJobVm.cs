namespace Model.ViewModel;

public class SchedulerJobVm
{
    public int Id { get; set; }
    public string JobName { get; set; } = "";
    public string Project { get; set; } = "";
    public string ApiUrl { get; set; } = "";
    public string HttpMethod { get; set; } = "POST";
    public string? Payload { get; set; }
    public string CronExpression { get; set; } = "11 23 * * *";
    public bool IsActive { get; set; } = true;
    public DateTime? LastRunTime { get; set; }
    public string? LastRunStatus { get; set; }
    public string? LastRunMessage { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Computed
    public string CronDescription => CronToText(CronExpression);

    private static string CronToText(string cron)
    {
        if (string.IsNullOrEmpty(cron)) return cron;
        var parts = cron.Trim().Split(' ');
        if (parts.Length >= 5 && parts[2] == "*" && parts[3] == "*" && parts[4] == "*")
        {
            if (int.TryParse(parts[0], out var m) && int.TryParse(parts[1], out var h))
                return $"Daily at {h:D2}:{m:D2}";
        }
        return cron;
    }
}

public class SaveSchedulerRequest
{
    public string JobName { get; set; } = "";
    public string Project { get; set; } = "";
    public string ApiUrl { get; set; } = "";
    public string HttpMethod { get; set; } = "POST";
    public string? Payload { get; set; }
    public string CronExpression { get; set; } = "11 23 * * *";
    public bool IsActive { get; set; } = true;
}
