using BAL.Interface;
using Microsoft.Extensions.Options;
using Model.ViewModel;

namespace BAL.Service.ModuleAdapters;

/// <summary>
/// MODULE 4: THMS.
/// COUNT  POST https://thms.tahdco.com/api/onedashboard/count
/// DETAIL POST https://thms.tahdco.com/api/onedashboard/count-ben
/// Filters (division/district/phase/terrain/builder) are copied straight from the dashboard
/// context/clickContext — never hard-coded to "Chennai" as in the spec's illustrative example.
/// </summary>
public class ThmsModuleAdapter : BaseModuleAdapter, IDashboardModuleAdapter
{
    public string Module => DashboardModule.Thms;

    public ThmsModuleAdapter(IResilientApiClient client, IOptions<ModuleApiConfigOptions> config)
        : base(client, config, DashboardModule.Thms) { }

    public object BuildCountRequest(Dictionary<string, object?> filters) => new
    {
        division = GetFilterArray(filters, "division"),
        district = GetFilterArray(filters, "district"),
        phase = GetFilterArray(filters, "phase"),
        terrain = GetFilterArray(filters, "terrain"),
        builder = GetFilterArray(filters, "builder")
    };

    public object BuildDetailRequest(ClickContextDto clickContext) => new
    {
        division = string.IsNullOrWhiteSpace(clickContext.Division) ? Array.Empty<string>() : new[] { clickContext.Division },
        district = string.IsNullOrWhiteSpace(clickContext.District) ? Array.Empty<string>() : new[] { clickContext.District },
        phase = GetFilterArray(clickContext.Filters, "phase"),
        terrain = GetFilterArray(clickContext.Filters, "terrain"),
        builder = GetFilterArray(clickContext.Filters, "builder")
        // Note: THMS's DETAIL payload shape has no explicit "metric" field per the supplied
        // spec — the metric (e.g. milestone/status) is expressed as one of phase/terrain here.
        // clickContext.Metric still drives the cache key so distinct clicked categories never collide.
    };

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
            var division = JsonNormalizationHelper.TryGetString(d, "division", "divisionName");
            foreach (var (metricKey, value) in d)
            {
                if (!long.TryParse(value?.ToString(), out var numeric)) continue;
                if (metricKey.Equals("district", StringComparison.OrdinalIgnoreCase) || metricKey.Equals("division", StringComparison.OrdinalIgnoreCase)) continue;
                result.Add(new NormalizedCountDto { Module = Module, District = district, Division = division, Metric = metricKey, Value = numeric, Filters = filters, Source = DataSource.Api });
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
                RecordId = JsonNormalizationHelper.TryGetString(d, "id", "beneficiaryId", "beneficiary_id"),
                District = JsonNormalizationHelper.TryGetString(d, "district", "districtName") ?? clickContext.District,
                Division = JsonNormalizationHelper.TryGetString(d, "division", "divisionName") ?? clickContext.Division,
                Metric = clickContext.Metric,
                Data = d,
                Source = DataSource.Api
            };
        }).ToList();
    }

    public string GetDetailCacheKey(ClickContextDto clickContext) =>
        BuildCacheKey(Module, ApiOperation.Detail, clickContext.District, clickContext.Division, clickContext.Metric,
            GetFilterArray(clickContext.Filters, "phase"), GetFilterArray(clickContext.Filters, "terrain"), GetFilterArray(clickContext.Filters, "builder"));

    public string GetCountCacheKey(Dictionary<string, object?> filters) =>
        BuildCacheKey(Module, ApiOperation.Count, GetFilterArray(filters, "division"), GetFilterArray(filters, "district"),
            GetFilterArray(filters, "phase"), GetFilterArray(filters, "terrain"), GetFilterArray(filters, "builder"));
}
