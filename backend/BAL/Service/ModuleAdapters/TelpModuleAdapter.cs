using BAL.Interface;
using Microsoft.Extensions.Options;
using Model.ViewModel;

namespace BAL.Service.ModuleAdapters;

/// <summary>
/// MODULE 1: TELP.
/// COUNT  POST https://qatelp.pixous.info/api/Report/DistrictWise_ApplicationSummary
/// DETAIL POST https://qatelp.pixous.info/api/Report/DistrictWise_ApplicationDetail
/// categoryType is dynamic — it is always clickContext.Metric (the clicked column), never
/// a hard-coded "statusSavedCount".
/// </summary>
public class TelpModuleAdapter : BaseModuleAdapter, IDashboardModuleAdapter
{
    public string Module => DashboardModule.Telp;

    public TelpModuleAdapter(IResilientApiClient client, IOptions<ModuleApiConfigOptions> config)
        : base(client, config, DashboardModule.Telp) { }

    public object BuildCountRequest(Dictionary<string, object?> filters)
    {
        var districts = GetFilterArray(filters, "districtIds");
        if (districts.Length == 0)
        {
            var single = GetFilter<string>(filters, "district");
            districts = string.IsNullOrWhiteSpace(single) ? Array.Empty<string?>() : new[] { single };
        }
        return new
        {
            fromYear = GetFilter(filters, "fromYear", DateTime.UtcNow.Year),
            toYear = GetFilter(filters, "toYear", DateTime.UtcNow.Year + 1),
            schemeIds = GetFilterArray(filters, "schemeIds") is { Length: > 0 } s ? s : new[] { "" },
            districtIds = districts
        };
    }

    public object BuildDetailRequest(ClickContextDto clickContext)
    {
        var fromYear = GetFilter(clickContext.Filters, "fromYear", DateTime.UtcNow.Year);
        var toYear = GetFilter(clickContext.Filters, "toYear", DateTime.UtcNow.Year + 1);
        return new
        {
            fromYear,
            toYear,
            district = clickContext.District ?? "",
            categoryType = clickContext.Metric,           // <-- dynamic, from the clicked column, never hard-coded
            skip = (clickContext.Page ?? 0) * (clickContext.PageSize ?? 0),
            take = clickContext.PageSize ?? 0
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
            var district = JsonNormalizationHelper.TryGetString(d, "district", "districtName", "district_name");
            foreach (var (metricKey, value) in d)
            {
                if (!long.TryParse(value?.ToString(), out var numeric)) continue;
                if (metricKey.Equals("district", StringComparison.OrdinalIgnoreCase) || metricKey.Equals("division", StringComparison.OrdinalIgnoreCase)) continue;
                result.Add(new NormalizedCountDto
                {
                    Module = Module,
                    District = district,
                    Metric = metricKey,
                    Value = numeric,
                    Filters = filters,
                    Source = DataSource.Api
                });
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
                RecordId = JsonNormalizationHelper.TryGetString(d, "id", "applicationId", "application_id", "refNo"),
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
            GetFilter<object>(clickContext.Filters, "fromYear"), GetFilter<object>(clickContext.Filters, "toYear"));

    public string GetCountCacheKey(Dictionary<string, object?> filters) =>
        BuildCacheKey(Module, ApiOperation.Count, GetFilterArray(filters, "districtIds"),
            GetFilter<object>(filters, "fromYear"), GetFilter<object>(filters, "toYear"));
}
