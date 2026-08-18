using BAL.Interface;
using DAL;
using Model.ViewModel;

namespace BAL.Service;

/// <summary>
/// THMS data: live-first (THMS QA API via IThmsLiveService), MySQL fallback.
/// Live data only exists for the current FY; historical FYs always read the DB.
/// </summary>
public class HousingService : IHousingService
{
    private const int CurrentFy = 1;                      // fy_id 1 = FY 2025-26
    private readonly IDapperRepository _db;
    private readonly IThmsLiveService _live;

    public HousingService(IDapperRepository db, IThmsLiveService live)
    { _db = db; _live = live; }

    // ── phase-level rows (real grain) ────────────────────────────────────────
    public async Task<IEnumerable<HousingDistrictVm>> GetRowsAsync(
        int fyId, string? division, string? district, string? phase, string? search)
    {
        var rows = await SourceRowsAsync(fyId);
        var q = TenderService.Like(search)?.Trim('%').ToLowerInvariant();
        var div = TenderService.Norm(division);
        var dist = string.IsNullOrWhiteSpace(district) || district == "All Districts" ? null : district;
        var ph = string.IsNullOrWhiteSpace(phase) || phase == "All Phases" ? null : phase;

        return rows.Where(r =>
            (div is null || r.Division == div) &&
            (dist is null || r.District == dist) &&
            (ph is null || r.Phase == ph) &&
            (q is null || r.District.ToLowerInvariant().Contains(q)
                       || r.Division.ToLowerInvariant().Contains(q)
                       || r.Phase.ToLowerInvariant().Contains(q)));
    }

    // ── district aggregate (back-compat for drill/overview) ─────────────────
    public async Task<IEnumerable<HousingDistrictVm>> GetDistrictsAsync(int fyId, string? division)
    {
        var rows = await GetRowsAsync(fyId, division, null, null, null);
        return rows.GroupBy(r => new { r.Division, r.District })
            .Select((g, i) => new HousingDistrictVm
            {
                Sno = i + 1, Division = g.Key.Division, District = g.Key.District,
                Phase = string.Join("+", g.Select(x => x.Phase).Distinct().OrderBy(x => x)),
                TotalHouses = g.Sum(x => x.TotalHouses), Started = g.Sum(x => x.Started),
                NotStarted = g.Sum(x => x.NotStarted), Completed = g.Sum(x => x.Completed),
                GradBeam = g.Sum(x => x.GradBeam), Basement = g.Sum(x => x.Basement),
                LintelLevel = g.Sum(x => x.LintelLevel), RoofLevel = g.Sum(x => x.RoofLevel),
                Completion = g.Sum(x => x.Completion)
            });
    }

    public async Task<HousingOverallVm> GetOverallAsync(int fyId)
    {
        var rows = (await SourceRowsAsync(fyId)).ToList();
        return new HousingOverallVm
        {
            TotalHouses = rows.Sum(r => r.TotalHouses), Started = rows.Sum(r => r.Started),
            NotStarted = rows.Sum(r => r.NotStarted), Completed = rows.Sum(r => r.Completed),
            GradBeam = rows.Sum(r => r.GradBeam), Basement = rows.Sum(r => r.Basement),
            LintelLevel = rows.Sum(r => r.LintelLevel), RoofLevel = rows.Sum(r => r.RoofLevel),
            Completion = rows.Sum(r => r.Completion)
        };
    }

    public async Task<IEnumerable<HousingDivisionVm>> GetDivisionSummaryAsync(int fyId)
    {
        var rows = await SourceRowsAsync(fyId);
        return rows.GroupBy(r => r.Division).Select(g => new HousingDivisionVm
        {
            Division = g.Key,
            TotalHouses = g.Sum(x => x.TotalHouses), Completed = g.Sum(x => x.Completed),
            Started = g.Sum(x => x.Started), NotStarted = g.Sum(x => x.NotStarted)
        });
    }

    public async Task<HousingMilestonesVm> GetMilestonesAsync(int fyId)
    {
        var o = await GetOverallAsync(fyId);
        return new HousingMilestonesVm
        {
            GradeBeam = o.GradBeam, Basement = o.Basement,
            LintelLevel = o.LintelLevel, RoofLevel = o.RoofLevel, Completion = o.Completion
        };
    }

    public Task<HousingInfraVm> GetInfrastructureAsync(int fyId) =>
        _db.QuerySingleAsync<HousingInfraVm>(@"
            SELECT hill_area AS HillArea, others_area AS OthersArea, plain_area AS PlainArea
            FROM housing_infra WHERE fy_id = @FyId", new { FyId = fyId });

    // ── source: live API first, DB otherwise / on failure ──────────────────
    private async Task<IEnumerable<HousingDistrictVm>> SourceRowsAsync(int fyId)
    {
        var live = await _live.TryGetLiveRowsAsync();
        if (live is { Count: > 0 }) return live;

        return await _db.QueryAsync<HousingDistrictVm>(@"
            SELECT ROW_NUMBER() OVER (ORDER BY d.district_id, h.phase) AS Sno,
                   dv.name AS Division, d.name AS District, h.phase AS Phase,
                   h.total_houses AS TotalHouses, h.started AS Started, h.not_started AS NotStarted,
                   h.completed AS Completed, h.grad_beam AS GradBeam, h.basement AS Basement,
                   h.lintel_level AS LintelLevel, h.roof_level AS RoofLevel, h.completion AS Completion
            FROM housing_district h
            JOIN district d  ON d.district_id = h.district_id
            JOIN division dv ON dv.division_id = d.division_id
            WHERE h.fy_id = @FyId
            ORDER BY d.district_id, h.phase", new { FyId = fyId });
    }
}
