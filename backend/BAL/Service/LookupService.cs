using BAL.Interface;
using DAL;
using Utils.Cache.Configuration;
using Utils.Interface;
using Microsoft.Extensions.Options;

namespace BAL.Service;

public class LookupService : ILookupService
{
    private readonly IDapperRepository _db;
    private readonly ICacheService _cache;
    private readonly CacheSettings _cfg;

    public LookupService(IDapperRepository db, ICacheService cache, IOptions<CacheSettings> cfg)
    { _db = db; _cache = cache; _cfg = cfg.Value; }

    public async Task<int> GetFyIdAsync(string? fyLabel)
    {
        var map = await _cache.GetOrCreateAsync("lookup:fy", TimeSpan.FromSeconds(_cfg.LookupSeconds), async () =>
            (await _db.QueryAsync<(int FyId, string Label)>(
                "SELECT fy_id AS FyId, label AS Label FROM financial_year ORDER BY fy_id"))
            .ToList());
        if (!string.IsNullOrWhiteSpace(fyLabel))
        {
            var hit = map.FirstOrDefault(m => m.Label.Equals(fyLabel.Trim(), StringComparison.OrdinalIgnoreCase));
            if (hit.FyId != 0) return hit.FyId;
        }
        return map.First().FyId;                       // default: fy_id=1 = 'FY 2025-26'
    }

    public async Task<object> GetMetaAsync()
    {
        return await _cache.GetOrCreateAsync("lookup:meta", TimeSpan.FromSeconds(_cfg.LookupSeconds), async () =>
        {
            var fys = await _db.QueryAsync<string>("SELECT label FROM financial_year ORDER BY fy_id");
            var divisions = await _db.QueryAsync<string>("SELECT name FROM division ORDER BY division_id");
            var rows = await _db.QueryAsync<(string Division, string District)>(
                @"SELECT dv.name AS Division, d.name AS District
                  FROM district d JOIN division dv ON dv.division_id = d.division_id
                  ORDER BY dv.division_id, d.district_id");
            var byDiv = rows.GroupBy(r => r.Division)
                            .ToDictionary(g => g.Key, g => g.Select(x => x.District).ToArray());
            return (object)new
            {
                generatedAt = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                source = "tahdco_udp (MySQL)",
                financialYears = fys,
                divisions,
                districtsByDivision = byDiv
            };
        });
    }
}
