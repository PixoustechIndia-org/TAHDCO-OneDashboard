using BAL.Interface;
using BAL.Service.ModuleAdapters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Model.ViewModel;

namespace API.Controllers;

/// <summary>
/// The click-driven COUNT/DETAIL cache API (spec sections 3-9, 18-19): one controller,
/// module-agnostic, that drives all 7 modules (TELP, TAHDCO Scheme, TIME+Patrol360, THMS,
/// TAMS, One Portal Member, One Portal Scheme) through <see cref="IModuleAdapterRegistry"/> +
/// <see cref="IDetailCacheService"/> / <see cref="ICountCacheService"/>. This is deliberately
/// versioned under api/v2/dashboard-cache rather than replacing the existing api/v1/dashboard/*
/// endpoints (DashboardController) — those remain the source for the aggregate KPI tiles;
/// this is specifically the resilient, DB-cached, click-context-driven drill-down path.
/// </summary>
[ApiController]
[Route("api/v2/dashboard-cache")]
[Authorize]
public class DashboardCacheController : ControllerBase
{
    private readonly IModuleAdapterRegistry _adapters;
    private readonly ICountCacheService _countCache;
    private readonly IDetailCacheService _detailCache;

    public DashboardCacheController(IModuleAdapterRegistry adapters, ICountCacheService countCache, IDetailCacheService detailCache)
    {
        _adapters = adapters;
        _countCache = countCache;
        _detailCache = detailCache;
    }

    /// <summary>List the 7 registered modules — lets the frontend's ModuleTabs build itself
    /// from the backend's adapter registry instead of a second hard-coded list.</summary>
    [HttpGet("modules")]
    public IActionResult Modules() => Ok(_adapters.AvailableModules);

    [HttpPost("{module}/count")]
    public async Task<IActionResult> GetCount(string module, [FromBody] Dictionary<string, object?>? filters)
    {
        if (!DashboardModule.IsValid(module)) return BadRequest(new { message = $"Unknown module '{module}'." });
        var adapter = _adapters.Get(module);
        var result = await _countCache.GetCountDataAsync(adapter, filters ?? new Dictionary<string, object?>());
        return Ok(result);
    }

    /// <summary>The core drill-down endpoint. Body is the full ClickContextDto — per spec
    /// section 5, the frontend must never send a bare {count}. Module in the route and
    /// clickContext.Module must agree; if the caller omits clickContext.Module we fill it
    /// from the route rather than reject the call.</summary>
    [HttpPost("{module}/detail")]
    public async Task<IActionResult> GetDetail(string module, [FromBody] ClickContextDto clickContext)
    {
        if (!DashboardModule.IsValid(module)) return BadRequest(new { message = $"Unknown module '{module}'." });
        if (string.IsNullOrWhiteSpace(clickContext.Metric))
            return BadRequest(new { message = "clickContext.metric is required — a count cannot be identified by its numeric value alone." });

        clickContext.Module = module;
        var adapter = _adapters.Get(module);
        var result = await _detailCache.GetDetailDataAsync(adapter, clickContext);
        return Ok(result);
    }

    [HttpPost("{module}/status")]
    public async Task<IActionResult> GetStatus(string module, [FromBody] ClickContextDto clickContext)
    {
        if (!DashboardModule.IsValid(module)) return BadRequest(new { message = $"Unknown module '{module}'." });
        clickContext.Module = module;
        var status = await _detailCache.GetDataStatusAsync(_adapters.Get(module), clickContext);
        return Ok(status);
    }

    [HttpPost("{module}/source")]
    public async Task<IActionResult> GetSource(string module, [FromBody] ClickContextDto clickContext)
    {
        if (!DashboardModule.IsValid(module)) return BadRequest(new { message = $"Unknown module '{module}'." });
        clickContext.Module = module;
        var source = await _detailCache.GetDataSourceAsync(_adapters.Get(module), clickContext);
        return Ok(new { source });
    }

    /// <summary>Manual "Refresh" button behind a stale-data banner. Same single-flighted,
    /// never-destroy-old-data path the background auto-refresh uses.</summary>
    [HttpPost("{module}/refresh")]
    public async Task<IActionResult> Refresh(string module, [FromBody] ClickContextDto clickContext)
    {
        if (!DashboardModule.IsValid(module)) return BadRequest(new { message = $"Unknown module '{module}'." });
        clickContext.Module = module;
        var result = await _detailCache.RefreshDetailDataAsync(_adapters.Get(module), clickContext);
        return Ok(result);
    }
}
