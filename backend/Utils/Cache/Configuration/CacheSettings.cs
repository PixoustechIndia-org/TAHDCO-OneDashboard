namespace Utils.Cache.Configuration;

/// <summary>Bound from the "Cache" section of appsettings.json.</summary>
public class CacheSettings
{
    public int DashboardSeconds { get; set; } = 60;
    public int LookupSeconds { get; set; } = 3600;
}
