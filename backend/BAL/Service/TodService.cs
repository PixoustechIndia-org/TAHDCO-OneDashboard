using BAL.Interface;
using DAL;
using Model.ViewModel;

namespace BAL.Service;

public class TodService : ITodService
{
    private readonly IDapperRepository _db;
    public TodService(IDapperRepository db) => _db = db;

    public Task<TodSummaryVm> GetSummaryAsync(int fyId) =>
        _db.QuerySingleAsync<TodSummaryVm>(@"
            SELECT COALESCE(SUM(task_count),0)  AS TotalTasks,
                   COALESCE(SUM(task_count),0)  AS TotalEvents,
                   COALESCE(SUM(not_started),0) AS NotStarted,
                   COALESCE(SUM(in_progress),0) AS InProgress,
                   COALESCE(SUM(completed),0)   AS Completed,
                   COALESCE(SUM(overdue),0)     AS Overdue
            FROM tod_district WHERE fy_id = @FyId", new { FyId = fyId });

    public Task<IEnumerable<TodDistrictVm>> GetDistrictsAsync(int fyId) =>
        _db.QueryAsync<TodDistrictVm>(@"
            SELECT dv.name AS Division, d.name AS District, t.task_type AS TaskType,
                   t.task_count AS TaskCount, t.not_started AS NotStarted,
                   t.in_progress AS InProgress, t.completed AS Completed, t.overdue AS Overdue
            FROM tod_district t
            JOIN district d  ON d.district_id = t.district_id
            JOIN division dv ON dv.division_id = d.division_id
            WHERE t.fy_id = @FyId
            ORDER BY d.district_id", new { FyId = fyId });
}
