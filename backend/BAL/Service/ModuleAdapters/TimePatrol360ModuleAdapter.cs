using BAL.Interface;
using Microsoft.Extensions.Options;
using Model.ViewModel;

namespace BAL.Service.ModuleAdapters;

/// <summary>
/// MODULE 3: TIME + Patrol360.
/// COUNT and DETAIL are the SAME endpoint (OneDashboard_Work_Get) with DIFFERENT payloads —
/// this is the module the spec explicitly calls out as the "one endpoint != one operation"
/// case (section 3/22). The adapter therefore has two distinct payload builders even though
/// Endpoint.CountUrl and Endpoint.DetailUrl resolve to the same configured URL.
/// statusNameList is populated dynamically from clickContext.Metric — never hard-coded.
/// </summary>
public class TimePatrol360ModuleAdapter : BaseModuleAdapter, IDashboardModuleAdapter
{
    public string Module => DashboardModule.TimePatrol360;

    public TimePatrol360ModuleAdapter(IResilientApiClient client, IOptions<ModuleApiConfigOptions> config)
        : base(client, config, DashboardModule.TimePatrol360) { }

    public object BuildCountRequest(Dictionary<string, object?> filters) => new
    {
        divisionIds = GetFilterArray(filters, "divisionIds"),
        division = GetFilterArray(filters, "division"),
        district = GetFilterArray(filters, "district"),
        year = GetFilterArray(filters, "year") is { Length: > 0 } y ? y : new[] { "2026" }
    };

    public object BuildDetailRequest(ClickContextDto clickContext)
    {
        var division = clickContext.Division;
        var district = clickContext.District;
        var year = GetFilterArray(clickContext.Filters, "year") is { Length: > 0 } y ? y : new[] { DateTime.UtcNow.Year.ToString() };
        return new
        {
            divisionIds = Array.Empty<string>(),
            division = string.IsNullOrWhiteSpace(division) ? Array.Empty<string>() : new[] { division },
            district = string.IsNullOrWhiteSpace(district) ? Array.Empty<string>() : new[] { district },
            year,
            camerastatusList = GetFilter(clickContext.Filters, "cameraStatus", "Live"),
            type = "work",
            statusNameList = string.IsNullOrWhiteSpace(clickContext.Metric) ? Array.Empty<string>() : new[] { clickContext.Metric }
        };
    }

    public async Task<string> GetCountDataAsync(Dictionary<string, object?> filters, CancellationToken ct = default) =>
        await Client.PostJsonAsync(Endpoint.CountUrl, BuildCountRequest(filters), NewCorrelationId(), Endpoint.TimeoutSeconds, Endpoint.MaxRetries, ct);

    public async Task<string> GetDetailDataAsync(ClickContextDto clickContext, CancellationToken ct = default) =>
        // Same URL as COUNT, different payload — see class remarks.
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
                RecordId = JsonNormalizationHelper.TryGetString(d, "id", "workId", "work_id", "mbookId"),
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
            GetFilterArray(clickContext.Filters, "year"), GetFilter<object>(clickContext.Filters, "cameraStatus"));

    public string GetCountCacheKey(Dictionary<string, object?> filters) =>
        BuildCacheKey(Module, ApiOperation.Count, GetFilter<object>(filters, "division"), GetFilterArray(filters, "year"), GetFilter<object>(filters, "cameraStatus"));
}
