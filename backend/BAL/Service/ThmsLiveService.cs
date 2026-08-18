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
        try
        {
            var client = _factory.CreateClient("external");
            client.Timeout = TimeSpan.FromSeconds(_cfg.TimeoutSeconds);
            using var resp = await client.PostAsync(_cfg.CountUrl, null);
            resp.EnsureSuccessStatusCode();
            using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());

            var rows = new List<HousingDistrictVm>();
            var sno = 0;
            foreach (var el in doc.RootElement.GetProperty("data").EnumerateArray())
            {
                var division = Str(el, "Division");
                var district = Str(el, "District");
                if (string.IsNullOrEmpty(district) || division.Contains("Total", StringComparison.OrdinalIgnoreCase))
                    continue;                                    // skip the Overall Total row
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
            _log.LogInformation("THMS live fetch OK: {Count} phase rows", rows.Count);
            return rows;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "THMS live fetch failed — falling back to database");
            return null;
        }
    }

    public async Task<object?> GetBenListAsync(string district, string status, string groupMilestone)
    {
        try
        {
            var client = _factory.CreateClient("external");
            client.Timeout = TimeSpan.FromSeconds(15);
            var payload = new { district = district ?? "", status = status ?? "", groupmilestone = groupMilestone ?? "" };
            var content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");
            using var resp = await client.PostAsync("https://thmsqa.pixoustech.in/App/api/onedashboard/count-ben", content);
            resp.EnsureSuccessStatusCode();
            var json = await resp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            return JsonSerializer.Deserialize<object>(json);
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
