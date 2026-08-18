namespace BAL.Interface;

public interface ILookupService
{
    /// <summary>Resolve an FY label like 'FY 2025-26' to fy_id (default = latest).</summary>
    Task<int> GetFyIdAsync(string? fyLabel);
    Task<object> GetMetaAsync();
}
