using BAL.Interface;
using DAL;
using Model.ViewModel;

namespace BAL.Service;

public class PatrolService : IPatrolService
{
    private readonly IDapperRepository _db;
    public PatrolService(IDapperRepository db) => _db = db;

    public Task<PatrolSummaryVm> GetSummaryAsync(int fyId) =>
        _db.QuerySingleAsync<PatrolSummaryVm>(@"
            SELECT COALESCE(SUM(total_works),0)      AS TotalWorks,
                   COALESCE(SUM(started),0)          AS Started,
                   COALESCE(SUM(not_started),0)      AS NotStarted,
                   COALESCE(SUM(in_progress),0)      AS InProgress,
                   COALESCE(SUM(completed),0)        AS Completed,
                   COALESCE(SUM(camera_installed),0) AS CameraInstalled,
                   COALESCE(SUM(current_active),0)   AS CurrentActive,
                   COALESCE(SUM(current_inactive),0) AS CurrentInactive
            FROM patrol_district WHERE fy_id = @FyId", new { FyId = fyId });

    public Task<IEnumerable<PatrolDistrictVm>> GetDistrictsAsync(int fyId) =>
        _db.QueryAsync<PatrolDistrictVm>(@"
            SELECT dv.name AS Division, d.name AS District,
                   p.total_works AS TotalWorks, p.started AS Started, p.not_started AS NotStarted,
                   p.in_progress AS InProgress, p.completed AS Completed,
                   p.camera_installed AS CameraInstalled, p.current_active AS CurrentActive,
                   p.current_inactive AS CurrentInactive
            FROM patrol_district p
            JOIN district d  ON d.district_id = p.district_id
            JOIN division dv ON dv.division_id = d.division_id
            WHERE p.fy_id = @FyId
            ORDER BY d.district_id", new { FyId = fyId });

    public Task<OfflineDurationVm> GetOfflineDurationAsync(int fyId) =>
        _db.QuerySingleAsync<OfflineDurationVm>(@"
            SELECT less_than_2_days AS LessThan2Days,
                   days_3_to_10 AS Between3To10Days,
                   more_than_10_days AS MoreThan10Days
            FROM patrol_offline WHERE fy_id = @FyId", new { FyId = fyId });
}
