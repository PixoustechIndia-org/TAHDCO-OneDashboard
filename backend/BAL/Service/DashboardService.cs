using BAL.Interface;
using Utils.Cache.Configuration;
using Utils.Interface;
using Microsoft.Extensions.Options;

namespace BAL.Service;

/// <summary>
/// Assembles the full dashboard document in exactly the shape of the Angular
/// app's dashboard-data.json, cached per FY (Hangfire warms this cache).
/// TIPS / TIME / Patrol360 data is fetched live from the external TIME API;
/// Housing data is fetched live from the THMS API. Both fall back to MySQL.
/// </summary>
public class DashboardService : IDashboardService
{
    private readonly ILookupService      _lookup;
    private readonly ITenderService      _tender;
    private readonly IHousingService     _housing;
    private readonly IEnrollmentService  _enroll;
    private readonly ISchemeService      _scheme;
    private readonly ITodService         _tod;
    private readonly IPatrolService      _patrol;
    private readonly ITipsTimeLiveService _tipsTime;
    private readonly ICacheService       _cache;
    private readonly CacheSettings       _cfg;

    public DashboardService(
        ILookupService lookup, ITenderService tender, IHousingService housing,
        IEnrollmentService enroll, ISchemeService scheme, ITodService tod,
        IPatrolService patrol, ITipsTimeLiveService tipsTime,
        ICacheService cache, IOptions<CacheSettings> cfg)
    {
        _lookup = lookup; _tender = tender; _housing = housing; _enroll = enroll;
        _scheme = scheme; _tod = tod; _patrol = patrol; _tipsTime = tipsTime;
        _cache = cache; _cfg = cfg.Value;
    }

    private static System.Text.Json.Nodes.JsonNode? _bundledFallbackCache = null;
    private static System.Text.Json.Nodes.JsonNode? LoadBundledJsonFallbackNode()
    {
        if (_bundledFallbackCache != null) return _bundledFallbackCache;
        try
        {
            var searchPaths = new[]
            {
                Path.Combine(AppContext.BaseDirectory, "wwwroot", "assets", "data", "dashboard-data.json"),
                Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "assets", "data", "dashboard-data.json"),
                Path.Combine(Directory.GetCurrentDirectory(), "..", "frontend", "src", "assets", "data", "dashboard-data.json"),
                Path.Combine(Directory.GetCurrentDirectory(), "frontend", "src", "assets", "data", "dashboard-data.json")
            };

            foreach (var p in searchPaths)
            {
                if (File.Exists(p))
                {
                    var json = File.ReadAllText(p);
                    var parsed = System.Text.Json.Nodes.JsonNode.Parse(json);
                    if (parsed != null)
                    {
                        _bundledFallbackCache = parsed;
                        return parsed;
                    }
                }
            }
        }
        catch {}
        return null;
    }

    public async Task<object> GetFullAsync(string? fyLabel, bool clearCache = false)
    {
        try
        {
            int fyId = 1;
            try { fyId = await _lookup.GetFyIdAsync(fyLabel); } catch { fyId = 1; }

            var cacheKey = $"dashboard:full:{fyId}";
            if (clearCache)
            {
                _cache.Remove(cacheKey);
            }
            return await _cache.GetOrCreateAsync(cacheKey,
                TimeSpan.FromSeconds(_cfg.DashboardSeconds), async () =>
            {
                static async Task<T?> SafeRun<T>(Task<T> task) where T : class
                {
                    try { return await task; }
                    catch { return null; }
                }

                var fallback = LoadBundledJsonFallbackNode();

                var metaTask             = SafeRun(_lookup.GetMetaAsync());
                var liveTipsTimeTask     = SafeRun(_tipsTime.TryFetchAsync());

                var tenderSummaryTask        = SafeRun(_tender.GetSummaryAsync(fyId));
                var tenderDivisionCountsTask = SafeRun(_tender.GetDivisionCountsAsync(fyId));
                var tenderDistrictsTask      = SafeRun(_tender.GetDistrictsAsync(fyId, null, null));

                var housingOverallTask         = SafeRun(_housing.GetOverallAsync(fyId));
                var housingRowsTask            = SafeRun(_housing.GetRowsAsync(fyId, null, null, null, null));
                var housingDistrictsTask       = SafeRun(_housing.GetDistrictsAsync(fyId, null));
                var housingDivisionSummaryTask = SafeRun(_housing.GetDivisionSummaryAsync(fyId));
                var housingMilestonesTask      = SafeRun(_housing.GetMilestonesAsync(fyId));
                var housingInfrastructureTask  = SafeRun(_housing.GetInfrastructureAsync(fyId));

                var enrollSummaryTask          = SafeRun(_enroll.GetSummaryAsync(fyId));
                var enrollInstitutesTask       = SafeRun(_enroll.GetInstitutesAsync(fyId, null, null));
                var enrollDistrictDataTask     = SafeRun(_enroll.GetDistrictDataAsync(fyId));
                var enrollDivisionSummaryTask  = SafeRun(_enroll.GetDivisionSummaryAsync(fyId));
                var enrollGradeDistributionTask= SafeRun(_enroll.GetGradeDistributionAsync(fyId));
                var enrollMonthlyCompletionTask= SafeRun(_enroll.GetMonthlyCompletionAsync(fyId));

                var schemesTask                  = SafeRun(_scheme.GetSchemesAsync(fyId, null, null));
                var telpTask                     = SafeRun(_scheme.GetTelpAsync(fyId));
                var onePortalMemberSummaryTask   = SafeRun(_scheme.GetMemberSummaryAsync(fyId));
                var onePortalMemberDistrictsTask = SafeRun(_scheme.GetMemberDistrictsAsync(fyId, null, null));
                var onePortalSchemeSummaryTask   = SafeRun(_scheme.GetOnoSchemeSummaryAsync(fyId));

                var todSummaryTask     = SafeRun(_tod.GetSummaryAsync(fyId));
                var todDistrictDataTask= SafeRun(_tod.GetDistrictsAsync(fyId));

                var patrolSummaryTask         = SafeRun(_patrol.GetSummaryAsync(fyId));
                var patrolDistrictDataTask    = SafeRun(_patrol.GetDistrictsAsync(fyId));
                var patrolOfflineDurationTask = SafeRun(_patrol.GetOfflineDurationAsync(fyId));

                await Task.WhenAll(
                    metaTask, liveTipsTimeTask,
                    tenderSummaryTask, tenderDivisionCountsTask, tenderDistrictsTask,
                    housingOverallTask, housingRowsTask, housingDistrictsTask, housingDivisionSummaryTask, housingMilestonesTask, housingInfrastructureTask,
                    enrollSummaryTask, enrollInstitutesTask, enrollDistrictDataTask, enrollDivisionSummaryTask, enrollGradeDistributionTask, enrollMonthlyCompletionTask,
                    schemesTask, telpTask, onePortalMemberSummaryTask, onePortalMemberDistrictsTask, onePortalSchemeSummaryTask,
                    todSummaryTask, todDistrictDataTask,
                    patrolSummaryTask, patrolDistrictDataTask, patrolOfflineDurationTask
                );

                var meta = (object?)await metaTask ?? fallback?["meta"];
                var liveTipsTime = await liveTipsTimeTask;
                var housingOverall = await housingOverallTask;

                var tenderSummary = liveTipsTime?.TenderSummary ?? (object?)await tenderSummaryTask ?? fallback?["tender"]?["summary"];
                var tenderDivs = liveTipsTime?.TenderDivisions ?? (object?)await tenderDivisionCountsTask ?? fallback?["tender"]?["divisionCounts"];
                var tenderDists = liveTipsTime?.TenderDistricts ?? (object?)await tenderDistrictsTask ?? fallback?["tender"]?["districtCounts"];

                var tender = new
                {
                    summary        = tenderSummary,
                    divisionCounts = tenderDivs,
                    districtCounts = tenderDists
                };

                var housing = (housingOverall == null && await housingRowsTask == null)
                    ? (object?)fallback?["housing"]
                    : new
                    {
                        overall    = (object?)housingOverall ?? fallback?["housing"]?["overall"],
                        rows       = (object?)await housingRowsTask ?? fallback?["housing"]?["rows"],
                        districts  = (object?)await housingDistrictsTask ?? fallback?["housing"]?["districts"],
                        divisionSummary    = (object?)await housingDivisionSummaryTask ?? fallback?["housing"]?["divisionSummary"],
                        milestones         = (object?)await housingMilestonesTask ?? fallback?["housing"]?["milestones"],
                        statusSummary      = (housingOverall != null) ? (object)new
                        {
                            completed  = housingOverall.Completed,
                            inProgress = housingOverall.Started,
                            notStarted = housingOverall.NotStarted
                        } : fallback?["housing"]?["statusSummary"],
                        infrastructure    = (object?)await housingInfrastructureTask ?? fallback?["housing"]?["infrastructure"],
                        lastMonthProgress = new { completed = 22, inProgress = 9, notStarted = 0 }
                    };

                var enrollSummary = await enrollSummaryTask;
                var enrollment = (enrollSummary == null && await enrollInstitutesTask == null)
                    ? (object?)fallback?["enrollment"]
                    : new
                    {
                        summary           = (object?)enrollSummary ?? fallback?["enrollment"]?["summary"],
                        institutes        = (object?)await enrollInstitutesTask ?? fallback?["enrollment"]?["institutes"],
                        districtData      = (object?)await enrollDistrictDataTask ?? fallback?["enrollment"]?["districtData"],
                        divisionSummary   = (object?)await enrollDivisionSummaryTask ?? fallback?["enrollment"]?["divisionSummary"],
                        gradeDistribution = (object?)await enrollGradeDistributionTask ?? fallback?["enrollment"]?["gradeDistribution"],
                        monthlyCompletion = (object?)await enrollMonthlyCompletionTask ?? fallback?["enrollment"]?["monthlyCompletion"]
                    };

                var schemes   = (object?)await schemesTask ?? fallback?["schemes"];
                var telp      = (object?)await telpTask ?? fallback?["telp"];
                
                var opMember = await onePortalMemberSummaryTask;
                var onePortal = (opMember == null)
                    ? (object?)fallback?["onePortal"]
                    : new
                    {
                        memberSummary  = (object?)opMember ?? fallback?["onePortal"]?["memberSummary"],
                        memberDistricts= (object?)await onePortalMemberDistrictsTask ?? fallback?["onePortal"]?["memberDistricts"],
                        schemeSummary  = (object?)await onePortalSchemeSummaryTask ?? fallback?["onePortal"]?["schemeSummary"]
                    };

                var todSummary = await todSummaryTask;
                var tod = (todSummary == null && await todDistrictDataTask == null)
                    ? (object?)fallback?["tod"]
                    : new
                    {
                        summary     = (object?)todSummary ?? fallback?["tod"]?["summary"],
                        districtData= (object?)await todDistrictDataTask ?? fallback?["tod"]?["districtData"]
                    };

                var patrol360 = new
                {
                    summary         = liveTipsTime?.PatrolSummary ?? (object?)await patrolSummaryTask ?? fallback?["patrol360"]?["summary"],
                    districtData    = liveTipsTime?.PatrolDistricts ?? (object?)await patrolDistrictDataTask ?? fallback?["patrol360"]?["districtData"],
                    offlineDuration = (object?)await patrolOfflineDurationTask ?? fallback?["patrol360"]?["offlineDuration"]
                };

                return (object)new { meta, tender, housing, enrollment, schemes, telp, onePortal, tod, patrol360 };
            });
        }
        catch
        {
            return (object?)LoadBundledJsonFallbackNode() ?? new { };
        }
    }
}
