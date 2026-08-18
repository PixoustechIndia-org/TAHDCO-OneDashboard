using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Net.Http;
using System.Text.Json;
using BAL.Service;
using DAL;

namespace BAL.BackgroundWorkerService;

public class HousingSyncJob
{
    private static readonly Dictionary<string, string> DistNorm = new(StringComparer.OrdinalIgnoreCase)
    {
        { "Kanchipuram", "Kancheepuram" },
        { "Thiruvallur", "Tiruvallur" },
        { "Thiruvannamalai", "Tiruvannamalai" },
        { "Trichy", "Thiruchirappalli" },
        { "Tirapathur", "Tirupathur" },
        { "Viluppuram", "Villupuram" }
    };

    private readonly IHttpClientFactory _clientFactory;
    private readonly IDapperRepository _db;
    private readonly ThmsSettings _cfg;
    private readonly ILogger<HousingSyncJob> _log;

    public HousingSyncJob(IHttpClientFactory clientFactory, IDapperRepository db, IOptions<ThmsSettings> cfg, ILogger<HousingSyncJob> log)
    {
        _clientFactory = clientFactory;
        _db = db;
        _cfg = cfg.Value;
        _log = log;
    }

    public async Task RunAsync()
    {
        _log.LogInformation("Starting nightly HousingSyncJob to synchronize THMS QA data...");
        try
        {
            var client = _clientFactory.CreateClient("external");
            client.Timeout = TimeSpan.FromSeconds(_cfg.TimeoutSeconds);
            
            using var resp = await client.PostAsync(_cfg.CountUrl, null);
            resp.EnsureSuccessStatusCode();
            
            var jsonStr = await resp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(jsonStr);
            
            var root = doc.RootElement;
            var status = root.TryGetProperty("status", out var sProp) && sProp.GetBoolean();
            if (!status)
            {
                _log.LogWarning("THMS API returned status = false. Aborting synchronization.");
                return;
            }

            var dateStr = root.TryGetProperty("date", out var dProp) ? dProp.GetString() ?? "" : "";
            
            // Determine Financial Year ID
            byte fyId = 1; // Default to 1 (FY 2025-26)
            if (DateTime.TryParseExact(dateStr, "dd-MM-yyyy", null, System.Globalization.DateTimeStyles.None, out var date))
            {
                var year = date.Year;
                var month = date.Month;
                var label = month >= 4 ? $"FY {year}-{(year + 1) % 100:D2}" : $"FY {year - 1}-{year % 100:D2}";
                
                var dbFyId = await _db.QueryFirstOrDefaultAsync<byte?>("SELECT fy_id FROM financial_year WHERE label = @Label", new { Label = label });
                if (dbFyId.HasValue)
                {
                    fyId = dbFyId.Value;
                }
                else
                {
                    var maxFyId = await _db.QueryFirstOrDefaultAsync<byte?>("SELECT MAX(fy_id) FROM financial_year");
                    if (maxFyId.HasValue)
                    {
                        fyId = maxFyId.Value;
                    }
                }
            }
            
            _log.LogInformation("Housing sync target Financial Year ID: {FyId}", fyId);

            // Fetch district mapping from database
            var districts = await _db.QueryAsync<dynamic>("SELECT district_id, name FROM district");
            var districtMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (var d in districts)
            {
                districtMap[d.name] = (int)d.district_id;
            }

            var rowsToInsert = new List<dynamic>();
            var dataProp = root.GetProperty("data");
            
            foreach (var el in dataProp.EnumerateArray())
            {
                var distName = Str(el, "District");
                var phase = Str(el, "PhaseAssignment");
                
                if (string.IsNullOrWhiteSpace(distName) || string.IsNullOrWhiteSpace(phase) ||
                    distName.Contains("Total", StringComparison.OrdinalIgnoreCase))
                {
                    continue; // Skip summary / overall total rows
                }

                // Apply spelling normalization to match database district names
                var normalizedDistName = DistNorm.TryGetValue(distName, out var normName) ? normName : distName;

                if (!districtMap.TryGetValue(normalizedDistName, out var districtId))
                {
                    _log.LogWarning("District name '{DistName}' (Normalized: '{Normalized}') could not be resolved to district ID. Skipping.", distName, normalizedDistName);
                    continue;
                }

                rowsToInsert.Add(new
                {
                    FyId = fyId,
                    DistrictId = districtId,
                    Phase = phase,
                    TotalHouses = Num(el, "TotalHouses"),
                    Started = Num(el, "Started"),
                    NotStarted = Num(el, "NotStarted"),
                    Completed = Num(el, "Completed"),
                    GradBeam = Num(el, "Grade Beam"),
                    Basement = Num(el, "Basement Level"),
                    LintelLevel = Num(el, "Lintel LEVEL"),
                    RoofLevel = Num(el, "ROOF LEVEL")
                });
            }

            if (rowsToInsert.Count == 0)
            {
                _log.LogWarning("No valid housing rows found in API response to synchronize.");
                return;
            }

            // Sync database: clear old entries for the targeted FY and insert new ones
            await _db.ExecuteAsync("DELETE FROM housing_district WHERE fy_id = @FyId", new { FyId = fyId });
            
            var insertSql = @"
                INSERT INTO housing_district (fy_id, district_id, phase, total_houses, started, not_started, completed, grad_beam, basement, lintel_level, roof_level)
                VALUES (@FyId, @DistrictId, @Phase, @TotalHouses, @Started, @NotStarted, @Completed, @GradBeam, @Basement, @LintelLevel, @RoofLevel)";
                
            await _db.ExecuteAsync(insertSql, rowsToInsert);
            
            _log.LogInformation("Successfully synchronized {RowCount} housing rows for FY ID {FyId}.", rowsToInsert.Count, fyId);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "An error occurred during nightly housing synchronization.");
            throw;
        }
    }

    private static string Str(JsonElement el, string name) =>
        el.TryGetProperty(name, out var v) && v.ValueKind != JsonValueKind.Null ? v.ToString() : "";

    private static int Num(JsonElement el, string name) =>
        int.TryParse(Str(el, name), out var n) ? n : 0;
}
