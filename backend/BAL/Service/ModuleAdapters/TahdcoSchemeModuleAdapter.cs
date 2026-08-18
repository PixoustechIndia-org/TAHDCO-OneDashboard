using BAL.Interface;
using Microsoft.Extensions.Options;
using Model.ViewModel;

namespace BAL.Service.ModuleAdapters;

/// <summary>
/// MODULE 2: TAHDCO Scheme.
/// COUNT  GET  https://scst.pixous.info/Report/GetSchemeSummary   ?fromYear=&amp;toYear=
/// DETAIL POST https://scst.pixous.info/Report/GetApplicationDetails
///
/// Endpoint note: the COUNT endpoint is GET, not POST (POST returns 405 on this host) —
/// verified by direct probe (check_module_apis.py, MAI-03/04 in the QA report's Module API
/// Integration tab). The COUNT path is also GetSchemeSummary, not GetDistrictSummary — the
/// uploaded Postman collection's own request URL uses GetSchemeSummary even though the
/// request is labeled "GetDistrictSummary (COUNT)"; that label is stale/mismatched with its
/// own URL. This adapter uses the verified real endpoint, not the stale label.
///
/// districtId in the DETAIL payload is this upstream system's own numeric ID (e.g. "207"),
/// unrelated to this app's district_id — there is no known mapping table in this codebase,
/// so it must be supplied by the caller via clickContext.Filters["districtId"]. If it's
/// ever missing, clickContext.District is passed through as a last-resort string fallback
/// rather than silently defaulting to a hard-coded example like "207".
/// </summary>
public class TahdcoSchemeModuleAdapter : BaseModuleAdapter, IDashboardModuleAdapter
{
    public string Module => DashboardModule.TahdcoScheme;

    public TahdcoSchemeModuleAdapter(IResilientApiClient client, IOptions<ModuleApiConfigOptions> config)
        : base(client, config, DashboardModule.TahdcoScheme) { }

    public object BuildCountRequest(Dictionary<string, object?> filters) => new
    {
        financialYearFrom = Convert.ToInt32(GetFilter(filters, "financialYearFrom", GetFilter(filters, "fromYear", 0))),
        financialYearTo = Convert.ToInt32(GetFilter(filters, "financialYearTo", GetFilter(filters, "toYear", 0))),
        districtId = GetFilter<string>(filters, "districtId") ?? ""
    };

    public object BuildDetailRequest(ClickContextDto clickContext)
    {
        var schemeCode = GetFilter<string>(clickContext.Filters, "schemeCode") ?? "PM-AJAY";
        var statusFilter = clickContext.Metric ?? GetFilter<string>(clickContext.Filters, "statusFilter") ?? "submittedCount";
        var financialYearFrom = Convert.ToInt32(GetFilter(clickContext.Filters, "financialYearFrom", GetFilter(clickContext.Filters, "fromYear", 0)));
        var financialYearTo = Convert.ToInt32(GetFilter(clickContext.Filters, "financialYearTo", GetFilter(clickContext.Filters, "toYear", 0)));

        return new
        {
            schemeCode,
            statusFilter,
            financialYearFrom,
            financialYearTo
        };
    }

    public async Task<string> GetCountDataAsync(Dictionary<string, object?> filters, CancellationToken ct = default) =>
        await Client.PostJsonAsync(Endpoint.CountUrl, BuildCountRequest(filters), NewCorrelationId(), Endpoint.TimeoutSeconds, Endpoint.MaxRetries, ct);

    public async Task<string> GetDetailDataAsync(ClickContextDto clickContext, CancellationToken ct = default) =>
        await Client.PostJsonAsync(Endpoint.DetailUrl, BuildDetailRequest(clickContext), NewCorrelationId(), Endpoint.TimeoutSeconds, Endpoint.MaxRetries, ct);

    public IReadOnlyList<NormalizedCountDto> NormalizeCountResponse(string rawResponse, Dictionary<string, object?> filters)
    {
        var rows = JsonNormalizationHelper.ExtractRows(rawResponse);
        var result = new List<NormalizedCountDto>();
        foreach (var row in rows)
        {
            var d = JsonNormalizationHelper.ToDictionary(row);
            var district = JsonNormalizationHelper.TryGetString(d, "district", "districtName");
            foreach (var (metricKey, value) in d)
            {
                if (!long.TryParse(value?.ToString(), out var numeric)) continue;
                if (metricKey.Equals("district", StringComparison.OrdinalIgnoreCase)) continue;
                result.Add(new NormalizedCountDto { Module = Module, District = district, Metric = metricKey, Value = numeric, Filters = filters, Source = DataSource.Api });
            }
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
                RecordId = JsonNormalizationHelper.TryGetString(d, "id", "applicationId", "application_id"),
                District = JsonNormalizationHelper.TryGetString(d, "district", "districtName") ?? clickContext.District,
                Division = JsonNormalizationHelper.TryGetString(d, "division", "divisionName") ?? clickContext.Division,
                Metric = clickContext.Metric,
                Data = d,
                Source = DataSource.Api
            };
        }).ToList();
    }

    public string GetDetailCacheKey(ClickContextDto clickContext) =>
        BuildCacheKey(Module, ApiOperation.Detail,
            GetFilter<string>(clickContext.Filters, "districtId") ?? clickContext.District,
            clickContext.Division, clickContext.Metric,
            GetFilter<object>(clickContext.Filters, "fromYear"), GetFilter<object>(clickContext.Filters, "toYear"));

    public string GetCountCacheKey(Dictionary<string, object?> filters) =>
        BuildCacheKey(Module, ApiOperation.Count, GetFilter<object>(filters, "fromYear"), GetFilter<object>(filters, "toYear"));
}
