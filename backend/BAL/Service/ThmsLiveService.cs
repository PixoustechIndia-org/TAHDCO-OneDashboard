using System.Text.Json;
using System.Net.Http;
using BAL.Interface;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Model.ViewModel;

namespace BAL.Service;

public class ThmsSettings
{
    public bool UseLive { get; set; } = true;
    public string CountUrl { get; set; } = "https://thmsqa.pixoustech.in/App/api/onedashboard/count";
    public int TimeoutSeconds { get; set; } = 10;
}

/// <summary>
/// Pulls the real THMS phase-level counts from the field system. Any failure
/// (network, shape change, timeout) returns null so HousingService falls back
/// to the seeded MySQL data — the dashboard never breaks on an upstream outage.
/// </summary>
public class ThmsLiveService : IThmsLiveService
{
    private static readonly Dictionary<string, string> DivNorm = new()
    { ["Viluppuram"] = "Villupuram", ["Tirunelveli"] = "Thirunelveli" };

    private readonly IHttpClientFactory _factory;
    private readonly ThmsSettings _cfg;
    private readonly ILogger<ThmsLiveService> _log;

    public ThmsLiveService(IHttpClientFactory factory, IOptions<ThmsSettings> cfg, ILogger<ThmsLiveService> log)
    { _factory = factory; _cfg = cfg.Value; _log = log; }

    public async Task<IReadOnlyList<HousingDistrictVm>?> TryGetLiveRowsAsync()
    {
        if (!_cfg.UseLive) return null;
        string[] countUrls = {
            "https://thms.tahdco.com/api/onedashboard/count",
            _cfg.CountUrl,
            "https://thmsqa.pixoustech.in/App/api/onedashboard/count"
        };

        var payload = new
        {
            division = Array.Empty<string>(),
            district = Array.Empty<string>(),
            phase = Array.Empty<string>(),
            terrain = Array.Empty<string>(),
            builder = Array.Empty<string>()
        };
        var contentStr = JsonSerializer.Serialize(payload);

        foreach (var url in countUrls)
        {
            try
            {
                var client = _factory.CreateClient("external");
                client.Timeout = TimeSpan.FromSeconds(_cfg.TimeoutSeconds);
                using var content = new StringContent(contentStr, System.Text.Encoding.UTF8, "application/json");
                using var resp = await client.PostAsync(url, content);
                if (resp.IsSuccessStatusCode)
                {
                    using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
                    var rows = new List<HousingDistrictVm>();
                    var sno = 0;
                    if (doc.RootElement.TryGetProperty("data", out var dataEl) && dataEl.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var el in dataEl.EnumerateArray())
                        {
                            var division = Str(el, "Division");
                            var district = Str(el, "District");
                            if (string.IsNullOrEmpty(district) || division.Contains("Total", StringComparison.OrdinalIgnoreCase))
                                continue;
                            rows.Add(new HousingDistrictVm
                            {
                                Sno = ++sno,
                                Division = DivNorm.TryGetValue(division, out var d) ? d : division,
                                District = district,
                                Phase = Str(el, "PhaseAssignment"),
                                TotalHouses = Num(el, "TotalHouses"),
                                NotStarted = Num(el, "NotStarted"),
                                Started = Num(el, "Started"),
                                Completed = Num(el, "Completed"),
                                GradBeam = Num(el, "Grade Beam"),
                                Basement = Num(el, "Basement Level"),
                                LintelLevel = Num(el, "Lintel LEVEL"),
                                RoofLevel = Num(el, "ROOF LEVEL"),
                                Completion = Num(el, "COMPLETION")
                            });
                        }
                        if (rows.Count > 0)
                        {
                            _log.LogInformation("THMS live fetch OK from {Url}: {Count} phase rows", url, rows.Count);
                            return rows;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "THMS count candidate {Url} failed, trying next candidate", url);
            }
        }
        return null;
    }

    public async Task<object?> GetBenListAsync(string district, string status, string groupMilestone)
    {
        try
        {
            var client = _factory.CreateClient("external");
            client.Timeout = TimeSpan.FromSeconds(15);
            var payload = new
            {
                division = new[] { "" },
                district = string.IsNullOrWhiteSpace(district) ? Array.Empty<string>() : new[] { district },
                phase = Array.Empty<string>(),
                terrain = Array.Empty<string>(),
                builder = Array.Empty<string>(),
                status = status ?? "",
                groupmilestone = groupMilestone ?? ""
            };
            var content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");

            string[] urls =
            {
                "https://thms.tahdco.com/api/onedashboard/BenList",
                "https://thms.tahdco.com/api/onedashboard/count-ben",
                "https://thmsqa.pixoustech.in/App/api/onedashboard/BenList",
                "https://thmsqa.pixoustech.in/App/api/onedashboard/count-ben"
            };

            foreach (var url in urls)
            {
                try
                {
                    using var resp = await client.PostAsync(url, content);
                    string body = await resp.Content.ReadAsStringAsync();
                    if (resp.IsSuccessStatusCode)
                    {
                        using var doc = JsonDocument.Parse(body);
                        return JsonSerializer.Deserialize<object>(body);
                    }
                }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "THMS BenList candidate {Url} failed", url);
                }
            }
            return null;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "THMS count-ben fetch failed for district={District}, status={Status}, groupmilestone={GroupMilestone}", district, status, groupMilestone);
            return null;
        }
    }

    private static string Str(JsonElement el, string name) =>
        el.TryGetProperty(name, out var v) && v.ValueKind != JsonValueKind.Null ? v.ToString() : "";
    private static int Num(JsonElement el, string name) =>
        int.TryParse(Str(el, name), out var n) ? n : 0;
}
