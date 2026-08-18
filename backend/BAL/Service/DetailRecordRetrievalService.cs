using System.Text.Json;
using BAL.Interface;
using DAL;
using Model.ViewModel;

namespace BAL.Service;

/// <summary>See <see cref="IDetailRecordRetrievalService"/>.</summary>
public class DetailRecordRetrievalService : IDetailRecordRetrievalService
{
    private readonly IDetailCacheRepository _repo;

    public DetailRecordRetrievalService(IDetailCacheRepository repo) => _repo = repo;

    public async Task<DetailRetrievalResultDto> RetrieveAsync(string query, string? module = null, string? district = null,
        string? division = null, string? metric = null, int topK = 8)
    {
        // STRUCTURED: caller already supplied enough dimensions to filter precisely (e.g. the
        // frontend passed the active district/metric filters alongside a vague free-text query)
        // -> filter first, don't force a keyword match on top of an already-narrow result set.
        var hasStructuredFilter = !string.IsNullOrWhiteSpace(district) || !string.IsNullOrWhiteSpace(division) || !string.IsNullOrWhiteSpace(metric);
        var keyword = hasStructuredFilter ? null : ExtractKeyword(query);
        var mode = hasStructuredFilter ? "STRUCTURED" : "KEYWORD";

        var rows = await _repo.SearchRecordsAsync(module, district, division, metric, keyword, limit: Math.Clamp(topK, 1, 50));
        var records = rows.Select(ToRetrievedRecord).ToList();

        return new DetailRetrievalResultDto
        {
            Query = query,
            Mode = mode,
            TotalMatches = records.Count,
            Records = records,
            AnyStale = records.Any(r => r.Stale)
        };
    }

    private static RetrievedDetailRecordDto ToRetrievedRecord(DetailRecordRow row) => new()
    {
        Module = row.Module,
        District = row.District,
        Division = row.Division,
        Metric = row.Metric,
        Data = DeserializeData(row.RecordData),
        Stale = row.IsStale,
        LastSuccessAt = row.LastSuccessAt
    };

    private static Dictionary<string, object?> DeserializeData(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, object?>>(json) ?? new Dictionary<string, object?>();
        }
        catch
        {
            return new Dictionary<string, object?>(); // malformed stored JSON must never crash the assistant
        }
    }

    /// <summary>Strips the most common English question words so the LIKE search matches on the
    /// substantive terms (district/scheme/status names) rather than failing to match anything
    /// because the raw sentence never appears verbatim in search_text.</summary>
    private static readonly string[] StopWords =
    {
        "how", "many", "what", "is", "are", "the", "in", "of", "for", "show", "me", "list",
        "which", "tell", "about", "please", "a", "an", "to", "count", "total", "give"
    };

    private static string? ExtractKeyword(string query)
    {
        if (string.IsNullOrWhiteSpace(query)) return null;
        var terms = query
            .Split(new[] { ' ', '\t', '\n', ',', '?', '.', '!' }, StringSplitOptions.RemoveEmptyEntries)
            .Where(t => t.Length > 2 && !StopWords.Contains(t.ToLowerInvariant()))
            .ToList();
        return terms.Count == 0 ? null : string.Join(" ", terms.Take(6));
    }
}
