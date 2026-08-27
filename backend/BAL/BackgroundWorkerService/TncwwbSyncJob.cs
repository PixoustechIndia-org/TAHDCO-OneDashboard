using Microsoft.Extensions.Logging;
using System.Net.Http;
using System.Text.Json;
using DAL;

namespace BAL.BackgroundWorkerService;

/// <summary>
/// Background job that runs periodically via Hangfire to query external TNCWWB count APIs
/// and sync Member and Scheme registration numbers into local tables.
/// </summary>
public class TncwwbSyncJob
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

    private static readonly Dictionary<string, int> SchemeNameMap = new(StringComparer.OrdinalIgnoreCase)
    {
        { "Marriage Assistance", 10 },
        { "Marriage", 10 },
        { "Maternity Assistance", 11 },
        { "Maternity", 11 },
        { "Education Assistance", 12 },
        { "Education Assistance ", 12 }, // trailing space
        { "Education", 12 },
        { "Purchase of spectacles", 13 },
        { "Purchase of spectacles ", 13 },
        { "Spectacles Assistance", 13 },
        { "Spectacles", 13 },
        { "Old Age Pension (Above 60 years )", 14 },
        { "Old Age Pension", 14 },
        { "Natural Death & Funeral Assistance", 15 },
        { "Natural Death", 15 },
        { "Accident Death & Funeral Assistance", 16 },
        { "Accident Death", 16 }
    };

    private readonly IHttpClientFactory _clientFactory;
    private readonly IDapperRepository _db;
    private readonly ILogger<TncwwbSyncJob> _log;

    public TncwwbSyncJob(IHttpClientFactory clientFactory, IDapperRepository db, ILogger<TncwwbSyncJob> log)
    {
        _clientFactory = clientFactory;
        _db = db;
        _log = log;
    }

    public async Task RunAsync()
    {
        _log.LogInformation("Starting TNCWWB Sync Job to query external API counts...");
        try
        {
            var client = _clientFactory.CreateClient("external");
            client.Timeout = TimeSpan.FromSeconds(30);

            var districtMap = await GetDistrictMappingAsync();
            byte fyId = 1; // FY 2025-26

            await SyncMembersAsync(client, districtMap, fyId);
            await SyncSchemesAsync(client, fyId);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "An error occurred during TNCWWB background synchronization.");
            throw;
        }
    }

    private async Task<Dictionary<string, int>> GetDistrictMappingAsync()
    {
        var districts = await _db.QueryAsync<dynamic>("SELECT district_id, name FROM district");
        var districtMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var d in districts)
        {
            districtMap[d.name] = (int)d.district_id;
        }
        return districtMap;
    }

    private async Task SyncMembersAsync(HttpClient client, Dictionary<string, int> districtMap, byte fyId)
    {
        var memberUrl = "https://testtncwwbv2-qa.pixoustech.app/api/OneDashboard/General?Type=MEMBER&Mode=COUNT";
        _log.LogInformation("Querying TNCWWB Member count API: {Url}", memberUrl);

        var mResp = await client.GetAsync(memberUrl);
        mResp.EnsureSuccessStatusCode();
        var mJson = await mResp.Content.ReadAsStringAsync();

        using var mDoc = JsonDocument.Parse(mJson);
        if (!mDoc.RootElement.TryGetProperty("data", out var mData) || mData.ValueKind != JsonValueKind.Array)
            return;

        int processedCount = 0;
        foreach (var el in mData.EnumerateArray())
        {
            var distName = el.TryGetProperty("district", out var dProp) ? dProp.GetString() : "";
            if (string.IsNullOrWhiteSpace(distName)) continue;

            var normalized = DistNorm.TryGetValue(distName, out var normName) ? normName : distName;
            if (!districtMap.TryGetValue(normalized, out var districtId))
            {
                _log.LogWarning("TNCWWB Member sync: Unknown district name '{DistName}'", distName);
                continue;
            }

            var sql = @"
                INSERT INTO member_district (fy_id, district_id, total_works, save_cnt, dm_pending, hq_pending, card_in_progress, card_issued)
                VALUES (@FyId, @DistrictId, @TotalWorks, @Save, @DmPending, @HqPending, @CardInProgress, @CardIssued)
                ON DUPLICATE KEY UPDATE 
                    total_works = @TotalWorks, save_cnt = @Save, 
                    dm_pending = @DmPending, hq_pending = @HqPending, 
                    card_in_progress = @CardInProgress, card_issued = @CardIssued";

            await _db.ExecuteAsync(sql, new
            {
                FyId = fyId,
                DistrictId = districtId,
                TotalWorks = el.TryGetProperty("totalWorks", out var wProp) ? wProp.GetInt32() : 0,
                Save = el.TryGetProperty("saved", out var sProp) ? sProp.GetInt32() : 0,
                DmPending = el.TryGetProperty("dmPending", out var dmProp) ? dmProp.GetInt32() : 0,
                HqPending = el.TryGetProperty("hqPending", out var hqProp) ? hqProp.GetInt32() : 0,
                CardInProgress = el.TryGetProperty("cardPrinting", out var cpProp) ? cpProp.GetInt32() : 0,
                CardIssued = el.TryGetProperty("cardIssued", out var ciProp) ? ciProp.GetInt32() : 0
            });
            processedCount++;
        }
        _log.LogInformation("Successfully synchronized TNCWWB Member registration counts for {Count} districts.", processedCount);
    }

    private async Task SyncSchemesAsync(HttpClient client, byte fyId)
    {
        var schemeUrl = "https://testtncwwbv2-qa.pixoustech.app/api/OneDashboard/General?Type=Scheme&Mode=COUNT";
        _log.LogInformation("Querying TNCWWB Scheme count API: {Url}", schemeUrl);

        var sResp = await client.GetAsync(schemeUrl);
        sResp.EnsureSuccessStatusCode();
        var sJson = await sResp.Content.ReadAsStringAsync();

        using var sDoc = JsonDocument.Parse(sJson);
        if (!sDoc.RootElement.TryGetProperty("data", out var sData) || sData.ValueKind != JsonValueKind.Array)
            return;

        var aggregates = new Dictionary<int, (int Apply, int DmPending, int HqPending, int PaymentPending)>();

        foreach (var el in sData.EnumerateArray())
        {
            var schemeName = el.TryGetProperty("scheme", out var scProp) ? scProp.GetString() ?? "" : "";
            var subSchemeName = el.TryGetProperty("subScheme", out var subProp) ? subProp.GetString() ?? "" : "";

            int schemeId = ResolveSchemeId(schemeName, subSchemeName);
            if (schemeId == -1) continue;

            int apply = el.TryGetProperty("no_of_scheme_apply", out var aProp) ? aProp.GetInt32() : 0;
            int dmPending = el.TryGetProperty("dmPending", out var dmProp) ? dmProp.GetInt32() : 0;
            int hqPending = el.TryGetProperty("hqPending", out var hqProp) ? hqProp.GetInt32() : 0;
            int paymentPending = el.TryGetProperty("paymentPending", out var payProp) ? payProp.GetInt32() : 0;

            if (aggregates.TryGetValue(schemeId, out var existing))
            {
                aggregates[schemeId] = (existing.Apply + apply, existing.DmPending + dmPending, existing.HqPending + hqPending, existing.PaymentPending + paymentPending);
            }
            else
            {
                aggregates[schemeId] = (apply, dmPending, hqPending, paymentPending);
            }
        }

        foreach (var kvp in aggregates)
        {
            var sql = @"
                INSERT INTO scheme_fy (fy_id, scheme_id, apply_cnt, dm_pending, hq_pending, payment_pending)
                VALUES (@FyId, @SchemeId, @Apply, @DmPending, @HqPending, @PaymentPending)
                ON DUPLICATE KEY UPDATE 
                    apply_cnt = @Apply, dm_pending = @DmPending, 
                    hq_pending = @HqPending, payment_pending = @PaymentPending";

            await _db.ExecuteAsync(sql, new
            {
                FyId = fyId,
                SchemeId = kvp.Key,
                Apply = kvp.Value.Apply,
                DmPending = kvp.Value.DmPending,
                HqPending = kvp.Value.HqPending,
                PaymentPending = kvp.Value.PaymentPending
            });
        }
        _log.LogInformation("Successfully synchronized TNCWWB Scheme assistance counts for {Count} ONO portal schemes.", aggregates.Count);
    }

    private static int ResolveSchemeId(string schemeName, string subSchemeName)
    {
        if (SchemeNameMap.TryGetValue(schemeName.Trim(), out var mappedId) || 
            SchemeNameMap.TryGetValue(subSchemeName.Trim(), out mappedId))
        {
            return mappedId;
        }

        foreach (var kvp in SchemeNameMap)
        {
            if (schemeName.Contains(kvp.Key, StringComparison.OrdinalIgnoreCase) || 
                subSchemeName.Contains(kvp.Key, StringComparison.OrdinalIgnoreCase))
            {
                return kvp.Value;
            }
        }

        return -1;
    }
}
