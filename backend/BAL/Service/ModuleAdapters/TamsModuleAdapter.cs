using BAL.Interface;
using Microsoft.Extensions.Options;
using Model.ViewModel;

namespace BAL.Service.ModuleAdapters;

/// <summary>
/// MODULE 5: TAMS.
/// COUNT  POST https://tams.tahdco.com/api/onedashboard/count
/// DETAIL POST https://tams.tahdco.com/api/onedashboard/count-ben
/// Same shape as THMS but with "institute" instead of phase/terrain/builder.
/// </summary>
public class TamsModuleAdapter : BaseModuleAdapter, IDashboardModuleAdapter
{
    public string Module => DashboardModule.Tams;

    public TamsModuleAdapter(IResilientApiClient client, IOptions<ModuleApiConfigOptions> config)
        : base(client, config, DashboardModule.Tams) { }

    public object BuildCountRequest(Dictionary<string, object?> filters) => new
    {
        division = GetFilterArray(filters, "division"),
        district = GetFilterArray(filters, "district"),
        institute = GetFilterArray(filters, "institute")
    };

    public object BuildDetailRequest(ClickContextDto clickContext) => new
    {
        division = string.IsNullOrWhiteSpace(clickContext.Division) ? Array.Empty<string>() : new[] { clickContext.Division },
        district = string.IsNullOrWhiteSpace(clickContext.District) ? Array.Empty<string>() : new[] { clickContext.District },
        institute = GetFilterArray(clickContext.Filters, "institute"),
        status = clickContext.Metric ?? ""                    // <-- dynamic, from the clicked column
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
                RecordId = JsonNormalizationHelper.TryGetString(d, "id", "traineeId", "trainee_id"),
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
            GetFilterArray(clickContext.Filters, "institute"));

    public string GetCountCacheKey(Dictionary<string, object?> filters) =>
        BuildCacheKey(Module, ApiOperation.Count, GetFilterArray(filters, "division"), GetFilterArray(filters, "district"), GetFilterArray(filters, "institute"));
}
