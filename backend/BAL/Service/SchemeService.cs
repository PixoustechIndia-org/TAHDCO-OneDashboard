using BAL.Interface;
using DAL;
using Model.ViewModel;

namespace BAL.Service;

public class SchemeService : ISchemeService
{
    private readonly IDapperRepository _db;
    public SchemeService(IDapperRepository db) => _db = db;

    public Task<IEnumerable<SchemeVm>> GetSchemesAsync(int fyId, string? project, string? search) =>
        _db.QueryAsync<SchemeVm>(@"
            SELECT m.scheme_id AS Sno, m.project AS Project, m.scheme_name AS Scheme,
                   m.sub_scheme AS SubScheme,
                   f.apply_cnt AS Apply, f.dm_pending AS DmPending,
                   f.hq_pending AS HqPending, f.payment_pending AS PaymentPending
            FROM scheme_fy f
            JOIN scheme_master m ON m.scheme_id = f.scheme_id
            WHERE f.fy_id = @FyId
              AND (@Project IS NULL OR m.project = @Project)
              AND (@Q IS NULL OR m.scheme_name LIKE @Q OR m.sub_scheme LIKE @Q)
            ORDER BY m.scheme_id",
            new
            {
                FyId = fyId,
                Project = string.IsNullOrWhiteSpace(project) || project == "All Projects" ? null : project,
                Q = TenderService.Like(search)
            });

    public Task<SchemeSummaryVm> GetOnoSchemeSummaryAsync(int fyId) =>
        _db.QuerySingleAsync<SchemeSummaryVm>(@"
            SELECT COALESCE(SUM(f.apply_cnt),0)       AS TotalApply,
                   COALESCE(SUM(f.dm_pending),0)      AS DmPending,
                   COALESCE(SUM(f.hq_pending),0)      AS HqPending,
                   COALESCE(SUM(f.payment_pending),0) AS PaymentPending
            FROM scheme_fy f
            JOIN scheme_master m ON m.scheme_id = f.scheme_id
            WHERE f.fy_id = @FyId AND m.project = 'ONO PORTAL'", new { FyId = fyId });

    public async Task<object> GetTelpAsync(int fyId)
    {
        var agencies = (await _db.QueryAsync<TelpAgencyVm>(@"
            SELECT m.scheme_name AS Agency, f.apply_cnt AS Apply,
                   f.dm_pending AS DmPending, f.hq_pending AS HqPending
            FROM scheme_fy f
            JOIN scheme_master m ON m.scheme_id = f.scheme_id
            WHERE f.fy_id = @FyId AND m.project = 'TELP'
            ORDER BY m.scheme_id", new { FyId = fyId })).ToList();

        return new
        {
            summary = new
            {
                totalApply = agencies.Sum(a => a.Apply),
                dmPending = agencies.Sum(a => a.DmPending),
                hqPending = agencies.Sum(a => a.HqPending),
                agencies = agencies.Count
            },
            agencies
        };
    }

    public Task<MemberSummaryVm> GetMemberSummaryAsync(int fyId) =>
        _db.QuerySingleAsync<MemberSummaryVm>(@"
            SELECT COALESCE(SUM(total_works),0)      AS TotalWorks,
                   COALESCE(SUM(save_cnt),0)         AS Save,
                   COALESCE(SUM(dm_pending),0)       AS DmPending,
                   COALESCE(SUM(hq_pending),0)       AS HqPending,
                   COALESCE(SUM(card_in_progress),0) AS CardInProgress,
                   COALESCE(SUM(card_issued),0)      AS CardIssued
            FROM member_district WHERE fy_id = @FyId", new { FyId = fyId });

    public Task<IEnumerable<MemberDistrictVm>> GetMemberDistrictsAsync(int fyId, string? division, string? search) =>
        _db.QueryAsync<MemberDistrictVm>(@"
            SELECT dv.name AS Division, d.name AS District,
                   m.total_works AS TotalWorks, m.save_cnt AS Save,
                   m.dm_pending AS DmPending, m.hq_pending AS HqPending,
                   m.card_in_progress AS CardInProgress, m.card_issued AS CardIssued
            FROM member_district m
            JOIN district d  ON d.district_id = m.district_id
            JOIN division dv ON dv.division_id = d.division_id
            WHERE m.fy_id = @FyId
              AND (@Division IS NULL OR dv.name = @Division)
              AND (@Q IS NULL OR d.name LIKE @Q OR dv.name LIKE @Q)
            ORDER BY d.district_id",
            new { FyId = fyId, Division = TenderService.Norm(division), Q = TenderService.Like(search) });
}
