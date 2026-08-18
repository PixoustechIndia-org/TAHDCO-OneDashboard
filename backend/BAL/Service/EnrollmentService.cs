using BAL.Interface;
using DAL;
using Model.ViewModel;

namespace BAL.Service;

public class EnrollmentService : IEnrollmentService
{
    private readonly IDapperRepository _db;
    public EnrollmentService(IDapperRepository db) => _db = db;

    public async Task<EnrollSummaryVm> GetSummaryAsync(int fyId)
    {
        var s = await _db.QuerySingleAsync<EnrollSummaryVm>(@"
            SELECT COALESCE(SUM(total_students),0) AS TotalStudents,
                   COALESCE(SUM(present),0)        AS Present,
                   COALESCE(SUM(CASE WHEN status='Ongoing' THEN total_students END),0) AS NewEnrollment,
                   COUNT(DISTINCT course)          AS TotalCourses,
                   COUNT(DISTINCT CASE WHEN status='Ongoing' THEN course END)       AS NewCourses,
                   COUNT(DISTINCT institute_id)    AS TotalInstitutes,
                   COUNT(DISTINCT CASE WHEN status='Ongoing' THEN institute_id END) AS NewInstitutes
            FROM enroll_institute WHERE fy_id = @FyId", new { FyId = fyId });

        s.AttendancePct = s.TotalStudents == 0 ? 0
            : Math.Round((decimal)s.Present / s.TotalStudents * 100, 1);

        var g = await _db.QueryFirstOrDefaultAsync<(int Male, int Female, int Others)>(
            "SELECT male AS Male, female AS Female, others AS Others FROM enroll_gender WHERE fy_id = @FyId",
            new { FyId = fyId });
        s.Male = g.Male; s.Female = g.Female; s.Others = g.Others;
        return s;
    }

    public Task<IEnumerable<EnrollInstituteVm>> GetInstitutesAsync(int fyId, string? division, string? search) =>
        _db.QueryAsync<EnrollInstituteVm>(@"
            SELECT ROW_NUMBER() OVER (ORDER BY i.institute_id) AS Sno,
                   dv.name AS Division, d.name AS District, i.name AS Institute,
                   e.course AS Course, e.status AS Status,
                   e.total_students AS TotalStudents, e.present AS Present,
                   e.attendance_pct AS AttendancePct, e.grade AS Grade
            FROM enroll_institute e
            JOIN institute i ON i.institute_id = e.institute_id
            JOIN district d  ON d.district_id = i.district_id
            JOIN division dv ON dv.division_id = d.division_id
            WHERE e.fy_id = @FyId
              AND (@Division IS NULL OR dv.name = @Division)
              AND (@Q IS NULL OR i.name LIKE @Q OR e.course LIKE @Q)
            ORDER BY i.institute_id",
            new { FyId = fyId, Division = TenderService.Norm(division), Q = TenderService.Like(search) });

    public Task<IEnumerable<EnrollDistrictVm>> GetDistrictDataAsync(int fyId) =>
        _db.QueryAsync<EnrollDistrictVm>(@"
            SELECT d.name AS District,
                   COALESCE(SUM(e.total_students),0) AS Total,
                   COALESCE(SUM(CASE WHEN e.status='Completed' THEN e.total_students END),0) AS Completed,
                   COALESCE(SUM(CASE WHEN e.status='Ongoing'   THEN e.total_students END),0) AS Ongoing
            FROM enroll_institute e
            JOIN institute i ON i.institute_id = e.institute_id
            JOIN district d  ON d.district_id = i.district_id
            WHERE e.fy_id = @FyId
            GROUP BY d.district_id, d.name
            ORDER BY d.district_id", new { FyId = fyId });

    public Task<IEnumerable<EnrollDivisionVm>> GetDivisionSummaryAsync(int fyId) =>
        _db.QueryAsync<EnrollDivisionVm>(@"
            SELECT dv.name AS Division,
                   COALESCE(SUM(e.total_students),0) AS Students,
                   COALESCE(SUM(e.present),0)        AS Present,
                   COALESCE(ROUND(SUM(e.present) / NULLIF(SUM(e.total_students),0) * 100, 1),0) AS AttendancePct
            FROM division dv
            LEFT JOIN district d ON d.division_id = dv.division_id
            LEFT JOIN institute i ON i.district_id = d.district_id
            LEFT JOIN enroll_institute e ON e.institute_id = i.institute_id AND e.fy_id = @FyId
            GROUP BY dv.division_id, dv.name
            ORDER BY dv.division_id", new { FyId = fyId });

    public Task<GradeDistributionVm> GetGradeDistributionAsync(int fyId) =>
        _db.QuerySingleAsync<GradeDistributionVm>(@"
            SELECT COALESCE(SUM(grade='Excellent'),0) AS Excellent,
                   COALESCE(SUM(grade='Good'),0)      AS Good,
                   COALESCE(SUM(grade='Average'),0)   AS Average,
                   COALESCE(SUM(grade='Poor'),0)      AS Poor
            FROM enroll_institute WHERE fy_id = @FyId", new { FyId = fyId });

    public Task<IEnumerable<MonthlyCompletionVm>> GetMonthlyCompletionAsync(int fyId) =>
        _db.QueryAsync<MonthlyCompletionVm>(@"
            SELECT month_label AS Month, completed AS Count
            FROM monthly_completion WHERE fy_id = @FyId ORDER BY month_no", new { FyId = fyId });
}
