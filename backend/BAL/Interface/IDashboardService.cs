namespace BAL.Interface;

public interface IDashboardService
{
    /// <summary>Full dashboard document, identical shape to dashboard-data.json.</summary>
    Task<object> GetFullAsync(string? fyLabel, bool clearCache = false);
}
