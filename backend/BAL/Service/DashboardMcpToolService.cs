using System.Collections.Concurrent;
using System.Diagnostics;
using BAL.Interface;
using BAL.Service.ModuleAdapters;
using DAL;
using Microsoft.Extensions.Logging;
using Model.ViewModel;

namespace BAL.Service;

/// <summary>See <see cref="IDashboardMcpToolService"/>. Every tool follows the same shape:
/// validate input -> resolve the module adapter (never a raw URL/SQL string from the caller)
/// -> delegate to the same cache services the REST API uses -> log -> return a bounded,
/// already-normalized result. No tool here ever executes a caller-supplied SQL string or a
/// caller-supplied URL — "module" is the only caller-controlled routing input and it is
/// checked against DashboardModule.All before use.</summary>
public class DashboardMcpToolService : IDashboardMcpToolService
{
    private readonly IModuleAdapterRegistry _adapters;
    private readonly ICountCacheService _countCache;
    private readonly IDetailCacheService _detailCache;
    private readonly IDetailCacheRepository _records;
    private readonly ILogger<DashboardMcpToolService> _log;

    // Simple in-process sliding-window rate limit: 30 MCP tool calls / minute / user.
    // The ASP.NET RateLimiter middleware only covers HTTP endpoints; MCP tools are invoked
    // programmatically from AIService (LLM tool-calling), so they need their own guard here.
    private static readonly ConcurrentDictionary<int, ConcurrentQueue<DateTime>> _callWindow = new();
    private const int MaxCallsPerMinute = 30;

    public DashboardMcpToolService(
        IModuleAdapterRegistry adapters,
        ICountCacheService countCache,
        IDetailCacheService detailCache,
        IDetailCacheRepository records,
        ILogger<DashboardMcpToolService> log)
    {
        _adapters = adapters;
        _countCache = countCache;
        _detailCache = detailCache;
        _records = records;
        _log = log;
    }

    public async Task<DashboardMcpToolResultDto> GetDashboardCountAsync(string module, Dictionary<string, object?>? filters, int userId) =>
        await GuardAsync("get_dashboard_count", module, userId, async () =>
        {
            var adapter = _adapters.Get(module);
            var result = await _countCache.GetCountDataAsync(adapter, filters ?? new Dictionary<string, object?>());
            return result;
        });

    public async Task<DashboardMcpToolResultDto> GetDetailDataAsync(string module, ClickContextDto clickContext, int userId) =>
        await GuardAsync("get_detail_data", module, userId, async () =>
        {
            RequireMetric(clickContext);
            clickContext.Module = module;
            var adapter = _adapters.Get(module);
            return await _detailCache.GetDetailDataAsync(adapter, clickContext);
        });

    public async Task<DashboardMcpToolResultDto> SearchDetailRecordsAsync(string module, string? district, string? division, string? metric, string? query, int userId) =>
        await GuardAsync("search_detail_records", module, userId, async () =>
        {
            // Structured filter first, keyword second — this tool never runs a vector/semantic
            // search itself (that's DetailRecordRetrievalService, used directly by AIService for
            // free-text questions); here it is a bounded, parameterized LIKE query only.
            var rows = await _records.SearchRecordsAsync(module, district, division, metric, query, limit: 50);
            return rows;
        });

    public async Task<DashboardMcpToolResultDto> GetCachedDataStatusAsync(string module, ClickContextDto clickContext, int userId) =>
        await GuardAsync("get_cached_data_status", module, userId, async () =>
        {
            clickContext.Module = module;
            var adapter = _adapters.Get(module);
            return await _detailCache.GetDataStatusAsync(adapter, clickContext);
        });

    public async Task<DashboardMcpToolResultDto> RefreshDetailDataAsync(string module, ClickContextDto clickContext, int userId) =>
        await GuardAsync("refresh_detail_data", module, userId, async () =>
        {
            RequireMetric(clickContext);
            clickContext.Module = module;
            var adapter = _adapters.Get(module);
            return await _detailCache.RefreshDetailDataAsync(adapter, clickContext);
        });

    public async Task<DashboardMcpToolResultDto> GetDataSourceAsync(string module, ClickContextDto clickContext, int userId) =>
        await GuardAsync("get_data_source", module, userId, async () =>
        {
            clickContext.Module = module;
            var adapter = _adapters.Get(module);
            var source = await _detailCache.GetDataSourceAsync(adapter, clickContext);
            return new { source };
        });

    public List<MCPToolDescriptorDto> GetToolCatalog() => new()
    {
        Tool("get_dashboard_count", "Returns the normalized COUNT/summary data for a dashboard module, honoring the fresh->stale->API fallback chain.", "Dashboard",
            new { module = Str(true), filters = Obj() }),
        Tool("get_detail_data", "Returns normalized DETAIL records for a specific clicked count (module + district/division/metric + filters). Never destroys prior data on API failure.", "Dashboard",
            new { module = Str(true), clickContext = Obj(true), page = Num(), pageSize = Num() }),
        Tool("search_detail_records", "Structured + keyword search over previously stored DETAIL records for a module. Use for 'which records...' questions, not for exact counts.", "Dashboard",
            new { module = Str(true), district = Str(), division = Str(), metric = Str(), query = Str() }),
        Tool("get_cached_data_status", "Reports whether cached data exists for a clickContext, and whether it is fresh or stale.", "Dashboard",
            new { module = Str(true), clickContext = Obj(true) }),
        Tool("refresh_detail_data", "Forces a live-API refresh for one clickContext. Keeps existing data if the refresh fails.", "Dashboard",
            new { module = Str(true), clickContext = Obj(true) }),
        Tool("get_data_source", "Returns API / CACHE / STALE / NONE for a clickContext, so the AI can disclose data freshness.", "Dashboard",
            new { module = Str(true), clickContext = Obj(true) }),
    };

    // ── guard: validation + auth-context + rate limit + timing + logging, once ─────────────

    private async Task<DashboardMcpToolResultDto> GuardAsync(string toolName, string module, int userId, Func<Task<object?>> action)
    {
        var sw = Stopwatch.StartNew();

        if (userId <= 0)
        {
            return Fail(toolName, sw, "Authentication is required to call MCP tools.");
        }
        if (!IsWithinRateLimit(userId))
        {
            _log.LogWarning("MCP rate limit exceeded for user {UserId} calling {Tool}", userId, toolName);
            return Fail(toolName, sw, "Rate limit exceeded — too many AI data requests in the last minute.");
        }
        if (!DashboardModule.IsValid(module))
        {
            return Fail(toolName, sw, $"Unknown module '{module}'.");
        }

        try
        {
            var output = await action();
            sw.Stop();
            _log.LogInformation("MCP {Tool} user={UserId} module={Module} success=true durationMs={Duration}", toolName, userId, module, sw.ElapsedMilliseconds);
            return new DashboardMcpToolResultDto { Success = true, Output = output, ExecutionTimeMs = sw.ElapsedMilliseconds };
        }
        catch (KeyNotFoundException)
        {
            return Fail(toolName, sw, $"Unknown module '{module}'.");
        }
        catch (ArgumentException ex)
        {
            return Fail(toolName, sw, ex.Message); // validation errors are safe to surface (no internals)
        }
        catch (Exception ex)
        {
            sw.Stop();
            _log.LogError(ex, "MCP {Tool} user={UserId} module={Module} failed", toolName, userId, module);
            return Fail(toolName, sw, "The requested data tool failed unexpectedly.");
        }
    }

    private static void RequireMetric(ClickContextDto clickContext)
    {
        if (string.IsNullOrWhiteSpace(clickContext.Metric))
            throw new ArgumentException("clickContext.metric is required.");
    }

    private static bool IsWithinRateLimit(int userId)
    {
        var now = DateTime.UtcNow;
        var window = _callWindow.GetOrAdd(userId, _ => new ConcurrentQueue<DateTime>());
        window.Enqueue(now);
        while (window.TryPeek(out var oldest) && (now - oldest).TotalSeconds > 60)
            window.TryDequeue(out _);
        return window.Count <= MaxCallsPerMinute;
    }

    private static DashboardMcpToolResultDto Fail(string toolName, Stopwatch sw, string message)
    {
        sw.Stop();
        return new DashboardMcpToolResultDto { Success = false, Error = message, ExecutionTimeMs = sw.ElapsedMilliseconds };
    }

    private static MCPToolDescriptorDto Tool(string name, string description, string category, object schema) => new()
    {
        Name = name,
        Description = description,
        Category = category,
        InputSchema = new { type = "object", properties = schema }
    };
    private static object Str(bool required = false) => new { type = "string", required };
    private static object Num() => new { type = "number" };
    private static object Obj(bool required = false) => new { type = "object", required };
}
