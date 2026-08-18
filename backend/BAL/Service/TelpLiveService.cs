using System.Text.Json;
using System.Text.Json.Nodes;
using System.Net.Http;
using System.Text;
using BAL.Interface;
using Microsoft.Extensions.Logging;

namespace BAL.Service;

public class TelpLiveService : ITelpLiveService
{
    private readonly IHttpClientFactory _factory;
    private readonly ILogger<TelpLiveService> _log;

    public TelpLiveService(IHttpClientFactory factory, ILogger<TelpLiveService> log)
    {
        _factory = factory;
        _log = log;
    }

    // Confirmed-working defaults (Postman-verified against the real API) — used whenever the
    // caller doesn't override them. Previously GetDistrictSummaryAsync sent an empty "{}" body,
    // which is why the count tile never returned real data even though the same API worked
    // fine in Postman with this exact payload.
    private const int DefaultFromYear = 2023;
    private const int DefaultSummaryToYear = 2027;
    private const int DefaultDetailToYear = 2026;

    public async Task<object?> GetDistrictSummaryAsync(int? fromYear = null, int? toYear = null, string[]? schemeIds = null, string[]? districtIds = null)
    {
        try
        {
            var client = _factory.CreateClient("external");
            client.Timeout = TimeSpan.FromSeconds(15);
            var payload = new
            {
                fromYear = fromYear ?? DefaultFromYear,
                toYear = toYear ?? DefaultSummaryToYear,
                schemeIds = (schemeIds is { Length: > 0 }) ? schemeIds : new[] { "" },
                districtIds = (districtIds is { Length: > 0 }) ? districtIds : new[] { "" }
            };
            var jsonPayload = JsonSerializer.Serialize(payload);
            using var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
            const string url = "https://qatelp.pixous.info/api/Report/DistrictWise_ApplicationSummary";

            _log.LogInformation("Calling external TELP summary API: {Url} with payload {Payload}", url, jsonPayload);
            using var response = await client.PostAsync(url, content);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            return JsonNode.Parse(json);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Failed to fetch TELP district summary from external service");
            return null;
        }
    }

    public async Task<object?> GetApplicationDetailAsync(string district, string categoryType, int? fromYear = null, int? toYear = null)
    {
        try
        {
            var client = _factory.CreateClient("external");
            client.Timeout = TimeSpan.FromSeconds(15);
            // Property names are lowercase-first to match the exact shape confirmed working in
            // Postman (district / categoryType / fromYear / toYear) — the previous PascalCase
            // payload (District / CategoryType) was silently ignored/mismatched by the upstream API.
            var payload = new
            {
                fromYear = fromYear ?? DefaultFromYear,
                toYear = toYear ?? DefaultDetailToYear,
                district = string.IsNullOrWhiteSpace(district) ? "Ariyalur" : district,
                categoryType = string.IsNullOrWhiteSpace(categoryType) ? "statusSavedCount" : categoryType
            };
            var jsonPayload = JsonSerializer.Serialize(payload);
            using var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
            const string url = "https://qatelp.pixous.info/api/Report/DistrictWise_ApplicationDetail";

            _log.LogInformation("Calling external TELP detail API: {Url} with payload {Payload}", url, jsonPayload);
            using var response = await client.PostAsync(url, content);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            return JsonNode.Parse(json);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Failed to fetch TELP application detail for district={District}, category={Category}", district, categoryType);
            return null;
        }
    }
}
