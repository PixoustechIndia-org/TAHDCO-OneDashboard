using BAL.Interface;
using DAL;
using Model.ViewModel;

namespace BAL.Service;

public class TenderService : ITenderService
{
    private readonly IDapperRepository _db;
    public TenderService(IDapperRepository db) => _db = db;

    public Task<TenderSummaryVm> GetSummaryAsync(int fyId) =>
        _db.QuerySingleAsync<TenderSummaryVm>(@"
            SELECT COALESCE(SUM(total_works),0)  AS TotalWorks,
                   COALESCE(SUM(started),0)      AS Started,
                   COALESCE(SUM(not_started),0)  AS NotStarted,
                   COALESCE(SUM(in_progress),0)  AS InProgress,
                   COALESCE(SUM(completed),0)    AS Completed,
                   COALESCE(SUM(slow_progress),0) AS SlowProgress,
                   COALESCE(SUM(mbook_total),0)  AS MBookTotal,
                   COALESCE(SUM(mbook_uploaded),0) AS MBookUploaded,
                   COALESCE(SUM(mbook_pending),0)  AS MBookPending,
                   COALESCE(SUM(no_action),0)    AS NoAction,
                   COALESCE(SUM(payment_pending),0) AS PaymentPending
            FROM tender_district WHERE fy_id = @FyId", new { FyId = fyId });

    public Task<IEnumerable<TenderDivisionVm>> GetDivisionCountsAsync(int fyId) =>
        _db.QueryAsync<TenderDivisionVm>(@"
            SELECT dv.name AS Division,
                   SUM(t.total_works)   AS TotalWorks,
                   SUM(t.in_progress)   AS InProgress,
                   SUM(t.not_started)   AS NotStarted,
                   SUM(t.completed)     AS Completed,
                   SUM(t.slow_progress) AS SlowProgress,
                   SUM(t.mbook_total)   AS MBooks
            FROM tender_district t
            JOIN district d  ON d.district_id = t.district_id
            JOIN division dv ON dv.division_id = d.division_id
            WHERE t.fy_id = @FyId
            GROUP BY dv.division_id, dv.name
            ORDER BY dv.division_id", new { FyId = fyId });

    public Task<IEnumerable<TenderDistrictVm>> GetDistrictsAsync(int fyId, string? division, string? search) =>
        _db.QueryAsync<TenderDistrictVm>(@"
            SELECT ROW_NUMBER() OVER (ORDER BY d.district_id) AS Sno,
                   dv.name AS Division, d.name AS District,
                   t.total_works AS TotalWorks, t.started AS Started, t.not_started AS NotStarted,
                   t.in_progress AS InProgress, t.completed AS Completed, t.slow_progress AS SlowProgress,
                   t.mbook_uploaded AS MBookUploaded, t.mbook_pending AS MBookPending,
                   t.no_action AS NoAction, t.payment_pending AS PaymentPending
            FROM tender_district t
            JOIN district d  ON d.district_id = t.district_id
            JOIN division dv ON dv.division_id = d.division_id
            WHERE t.fy_id = @FyId
              AND (@Division IS NULL OR dv.name = @Division)
              AND (@Q IS NULL OR d.name LIKE @Q OR dv.name LIKE @Q)
            ORDER BY d.district_id",
            new { FyId = fyId, Division = Norm(division), Q = Like(search) });

    internal static string? Norm(string? division) =>
        string.IsNullOrWhiteSpace(division) || division == "All Divisions" ? null : division;
    internal static string? Like(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : $"%{s.Trim()}%";
}
