using BAL.Interface;
using Microsoft.Extensions.Options;
using Model.ViewModel;

namespace BAL.Service.ModuleAdapters;

/// <summary>
/// MODULES 6 &amp; 7: One Portal (Member / Scheme).
/// Both GET https://testtncwwbv2-qa.pixoustech.app/api/OneDashboard/General
/// with Type=MEMBER|Scheme, Mode=Count|LIST, Status, Year as QUERY PARAMETERS, not a JSON
/// body (spec section 23) — built via IResilientApiClient's safe query-string builder, never
/// manual concatenation. Status and Year are dynamic (clickContext.Metric supplies Status for
/// DETAIL; filters supply both for COUNT) — "HqPending"/"2026" in the spec are examples only.
/// </summary>
public abstract class OnePortalModuleAdapterBase : BaseModuleAdapter, IDashboardModuleAdapter
{
    /// <summary>"MEMBER" or "Scheme" — the one thing that differs between the two subclasses.</summary>
    protected abstract string TypeParam { get; }
    public abstract string Module { get; }

    protected OnePortalModuleAdapterBase(IResilientApiClient client, IOptions<ModuleApiConfigOptions> config, string module)
        : base(client, config, module) { }

    public object BuildCountRequest(Dictionary<string, object?> filters) => new Dictionary<string, string?>
    {
        ["Type"] = TypeParam,
        ["Mode"] = "Count",
        ["Status"] = GetFilter(filters, "status", "HqPending"),
        ["Year"] = GetFilter(filters, "year", DateTime.UtcNow.Year.ToString())
    };

    public object BuildDetailRequest(ClickContextDto clickContext) => new Dictionary<string, string?>
    {
        ["Type"] = TypeParam,
        ["Mode"] = "LIST",
        ["Status"] = clickContext.Metric,                        // <-- dynamic: the clicked category IS the status filter here
        ["Year"] = GetFilter(clickContext.Filters, "year", DateTime.UtcNow.Year.ToString())
    };

    public async Task<string> GetCountDataAsync(Dictionary<string, object?> filters, CancellationToken ct = default) =>
        await Client.GetAsync(Endpoint.CountUrl, (Dictionary<string, string?>)BuildCountRequest(filters), NewCorrelationId(), Endpoint.TimeoutSeconds, Endpoint.MaxRetries, ct);

    public async Task<string> GetDetailDataAsync(ClickContextDto clickContext, CancellationToken ct = default) =>
        await Client.GetAsync(Endpoint.DetailUrl, (Dictionary<string, string?>)BuildDetailRequest(clickContext), NewCorrelationId(), Endpoint.TimeoutSeconds, Endpoint.MaxRetries, ct);

    public IReadOnlyList<NormalizedCountDto> NormalizeCountResponse(string rawResponse, Dictionary<string, object?> filters)
    {
        var rows = JsonNormalizationHelper.ExtractRows(rawResponse);
        var result = new List<NormalizedCountDto>();
        foreach (var row in rows)
        {
            var d = JsonNormalizationHelper.ToDictionary(row);
            var district = JsonNormalizationHelper.TryGetString(d, "district", "districtName");
            var value = JsonNormalizationHelper.TryGetLong(d, "count", "value", "total", "totalCount");
            var status = JsonNormalizationHelper.TryGetString(d, "status") ?? GetFilter(filters, "status", "HqPending");
            result.Add(new NormalizedCountDto { Module = Module, District = district, Metric = status, Value = value, Filters = filters, Source = DataSource.Api });
        }
        return result;
    }

    public IReadOnlyList<NormalizedDetailRecordDto> NormalizeDetailResponse(string rawResponse, ClickContextDto clickContext)
    {
        var rows = JsonNormalizationHelper.ExtractRows(rawResponse);
        return rows.Select(row =>
        {
            var d = JsonNormalizationHelper.ToDictionary(row);
            return new NormalizedDetailRecordDto
            {
                Module = Module,
                RecordId = JsonNormalizationHelper.TryGetString(d, "id", "memberId", "member_id", "schemeId"),
                District = JsonNormalizationHelper.TryGetString(d, "district", "districtName") ?? clickContext.District,
                Division = JsonNormalizationHelper.TryGetString(d, "division", "divisionName") ?? clickContext.Division,
                Metric = clickContext.Metric,
                Data = d,
                Source = DataSource.Api
            };
        }).ToList();
    }

    public string GetDetailCacheKey(ClickContextDto clickContext) =>
        BuildCacheKey(Module, ApiOperation.Detail, clickContext.Metric, GetFilter<object>(clickContext.Filters, "year"));

    public string GetCountCacheKey(Dictionary<string, object?> filters) =>
        BuildCacheKey(Module, ApiOperation.Count, GetFilter<object>(filters, "status"), GetFilter<object>(filters, "year"));
}

public class OnePortalMemberModuleAdapter : OnePortalModuleAdapterBase
{
    protected override string TypeParam => "MEMBER";
    public override string Module => DashboardModule.OnePortalMember;

    public OnePortalMemberModuleAdapter(IResilientApiClient client, IOptions<ModuleApiConfigOptions> config)
        : base(client, config, DashboardModule.OnePortalMember) { }
}

public class OnePortalSchemeModuleAdapter : OnePortalModuleAdapterBase
{
    protected override string TypeParam => "Scheme";
    public override string Module => DashboardModule.OnePortalScheme;

    public OnePortalSchemeModuleAdapter(IResilientApiClient client, IOptions<ModuleApiConfigOptions> config)
        : base(client, config, DashboardModule.OnePortalScheme) { }
}
