using System.Text.Json;

namespace BAL.Service.ModuleAdapters;

/// <summary>
/// Best-effort, shape-tolerant JSON -> row-list normalization shared by every module
/// adapter. Every upstream API in this integration returns a different envelope
/// (some wrap rows in "data", some in "result"/"rows"/"Items", some return a bare
/// array, some paginate with a nested "records" key) and none of the actual response
/// bodies were available to sample from this environment (the upstream QA hosts are
/// network-blocked here — see Module API Integration / SQL Injection Test tabs in the
/// QA report for the same restriction). Rather than guess exact field names and risk
/// silently dropping real data, this walks the JSON generically: it finds the row
/// array wherever it lives, and flattens each row into a string-keyed dictionary so
/// NO field is lost even if this code has never seen that field name before.
///
/// Each adapter's NormalizeDetailResponse/NormalizeCountResponse then does the
/// module-specific part on top of this: picking out district/division/metric/value
/// by trying a short list of likely key names. Once QA captures one real response per
/// module, tighten <see cref="TryGetString"/>'s candidate key lists to the exact
/// field names and this class needs no other change.
/// </summary>
public static class JsonNormalizationHelper
{
    private static readonly string[] RowArrayCandidateKeys =
        { "data", "Data", "result", "Result", "results", "Results", "rows", "Rows", "records", "Records", "items", "Items", "list", "List" };

    /// <summary>Locate the row array inside an arbitrarily-wrapped JSON response.</summary>
    public static List<JsonElement> ExtractRows(string rawJson)
    {
        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(rawJson) ? "{}" : rawJson);
        var root = doc.RootElement.Clone();
        return ExtractRows(root);
    }

    private static List<JsonElement> ExtractRows(JsonElement root)
    {
        if (root.ValueKind == JsonValueKind.Array)
            return root.EnumerateArray().Select(e => e.Clone()).ToList();

        if (root.ValueKind == JsonValueKind.Object)
        {
            foreach (var key in RowArrayCandidateKeys)
            {
                if (root.TryGetProperty(key, out var val))
                {
                    if (val.ValueKind == JsonValueKind.Array)
                        return val.EnumerateArray().Select(e => e.Clone()).ToList();
                    if (val.ValueKind == JsonValueKind.Object)
                        return ExtractRows(val); // one more level of wrapping (e.g. { data: { rows: [...] } })
                }
            }
            // No recognizable wrapper and not itself an array: treat the whole object as a single row
            // (covers COUNT summary endpoints that return one object, not a list).
            return new List<JsonElement> { root };
        }

        return new List<JsonElement>();
    }

    /// <summary>Flatten one JSON row into a Dictionary&lt;string, object?&gt; so no field is lost,
    /// regardless of whether this adapter recognizes the field name.</summary>
    public static Dictionary<string, object?> ToDictionary(JsonElement row)
    {
        var dict = new Dictionary<string, object?>();
        if (row.ValueKind != JsonValueKind.Object) { dict["value"] = ElementToObject(row); return dict; }
        foreach (var prop in row.EnumerateObject())
            dict[prop.Name] = ElementToObject(prop.Value);
        return dict;
    }

    private static object? ElementToObject(JsonElement el) => el.ValueKind switch
    {
        JsonValueKind.String => el.GetString(),
        JsonValueKind.Number => el.TryGetInt64(out var l) ? l : el.GetDouble(),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Null => null,
        JsonValueKind.Array => el.EnumerateArray().Select(ElementToObject).ToList(),
        JsonValueKind.Object => el.EnumerateObject().ToDictionary(p => p.Name, p => ElementToObject(p.Value)),
        _ => null
    };

    /// <summary>Try a list of candidate keys (case-insensitive) and return the first string value found.</summary>
    public static string? TryGetString(Dictionary<string, object?> row, params string[] candidateKeys)
    {
        foreach (var key in candidateKeys)
        {
            var match = row.Keys.FirstOrDefault(k => string.Equals(k, key, StringComparison.OrdinalIgnoreCase));
            if (match is not null && row[match] is not null)
                return row[match]!.ToString();
        }
        return null;
    }

    public static long TryGetLong(Dictionary<string, object?> row, params string[] candidateKeys)
    {
        var s = TryGetString(row, candidateKeys);
        return long.TryParse(s, out var v) ? v : 0;
    }
}
