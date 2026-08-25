using System.Net.Http;
using System.Text;
using System.Text.Json;
using BAL.Interface;
using DAL;
using Microsoft.Extensions.Logging;

namespace BAL.Service;

/// <summary>
/// Proxies the TAMS beneficiary detail API (https://tams.tahdco.com/api/onedashboard/count-ben).
/// Mirrors ThmsLiveService.GetBenListAsync - uses the "external" HttpClient (cert-bypass)
/// so the expired cert / Cloudflare setup does not block the call. The live endpoint is
/// currently not deployed (404 on the QA host), so on any failure the service falls back to
/// the app's own enrollment tables (real institute-level records from tahdco_udp) and labels
/// the response with source="database-fallback".
/// </summary>
public class TamsLiveService : ITamsLiveService
{
    // Candidate URLs - try in order and log each attempt so a path change on the
    // TAMS side is visible in the log instead of a silent 404. report-details is the
    // detail endpoint documented in the Postman collection (tamsqa).
    private static readonly string[] BenUrls =
    {
        "https://tams.tahdco.com/api/attendance/report-details",
        "https://tams.tahdco.com/api/onedashboard/count-ben",
        "https://tams.tahdco.com/api/onedashboard/countben",
        "https://tams.tahdco.com/api/onedashboard/count",
        "https://tamsqa.pixoustech.in/App/api/attendance/report-details"
    };

    private readonly IHttpClientFactory _factory;
    private readonly IDapperRepository _db;
    private readonly ILogger<TamsLiveService> _log;

    public TamsLiveService(IHttpClientFactory factory, IDapperRepository db, ILogger<TamsLiveService> log)
    {
        _factory = factory;
        _db = db;
        _log = log;
    }

    public async Task<object?> GetBenListAsync(string district, string status)
    {
        // 1) Try the live TAMS API first.
        try
        {
            var client = _factory.CreateClient("external");
            client.Timeout = TimeSpan.FromSeconds(20);

            var payload1 = new
            {
                division = Array.Empty<string>(),
                district = string.IsNullOrWhiteSpace(district) ? Array.Empty<string>() : new[] { district },
                institute = Array.Empty<string>(),
                status = status ?? ""
            };
            var payload2 = new
            {
                Institute_Name = "",
                Course_Name = "",
                division = "",
                district = district ?? "",
                status = status ?? "",
                From_Date = "",
                search = ""
            };

            Exception? last = null;
            foreach (var url in BenUrls)
            {
                try
                {
                    var selectedPayload = url.Contains("attendance") ? (object)payload2 : (object)payload1;
                    var content = new StringContent(JsonSerializer.Serialize(selectedPayload), Encoding.UTF8, "application/json");
                    using var resp = await client.PostAsync(url, content);
                    var body = await resp.Content.ReadAsStringAsync();
                    _log.LogInformation("TAMS candidate {Url} -> HTTP {Status} ({BodyLength} chars)",
                        url, (int)resp.StatusCode, body.Length);
                    if (resp.IsSuccessStatusCode)
                    {
                        using var doc = JsonDocument.Parse(body);
                        return JsonSerializer.Deserialize<object>(body);
                    }
                    last = new HttpRequestException($"{(int)resp.StatusCode} from {url}");
                }
                catch (Exception ex)
                {
                    last = ex;
                    _log.LogWarning("TAMS candidate {Url} failed: {Message}", url, ex.Message);
                }
            }
            _log.LogWarning(last, "TAMS live fetch failed for district={District}, status={Status} - using DB fallback", district, status);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "TAMS live fetch failed for district={District}, status={Status} - using DB fallback", district, status);
        }

        // 2) Fallback: real institute-level enrolment records from the app's DB.
        try
        {
            var rows = await _db.QueryAsync<TamsInstituteRow>(@"
                SELECT i.name AS Institute, d.name AS District, e.course AS Course,
                       e.status AS Status, e.total_students AS TotalStudents,
                       e.present AS Present, e.attendance_pct AS AttendancePct, e.grade AS Grade
                FROM enroll_institute e
                JOIN institute i ON i.institute_id = e.institute_id
                JOIN district d  ON d.district_id = i.district_id
                WHERE e.fy_id = (SELECT MAX(fy_id) FROM enroll_institute)
                  AND (@District = '' OR d.name = @District)
                ORDER BY i.name, e.course", new { District = district ?? "" });
            return new { status = true, source = "database-fallback", data = rows };
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "TAMS DB fallback failed for district={District}", district);
            return null;
        }
    }
}

/// <summary>One institute/course row from the enrolment tables (DB fallback shape).</summary>
public class TamsInstituteRow
{
    public string? Institute { get; set; }
    public string? District { get; set; }
    public string? Course { get; set; }
    public string? Status { get; set; }
    public int TotalStudents { get; set; }
    public int Present { get; set; }
    public decimal AttendancePct { get; set; }
    public string? Grade { get; set; }
}
