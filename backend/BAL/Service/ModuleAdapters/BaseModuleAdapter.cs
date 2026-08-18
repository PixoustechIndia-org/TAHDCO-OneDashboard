using BAL.Interface;
using Microsoft.Extensions.Options;
using Model.ViewModel;

namespace BAL.Service.ModuleAdapters;

/// <summary>
/// Shared plumbing for every <see cref="IDashboardModuleAdapter"/> implementation:
/// endpoint config lookup (from appsettings' ModuleApiConfig section — never a hard-coded
/// URL in a module file) and the deterministic cache-key builder used by all 7 modules.
/// </summary>
public abstract class BaseModuleAdapter
{
    protected readonly IResilientApiClient Client;
    protected readonly ModuleApiEndpointOptions Endpoint;

    protected BaseModuleAdapter(IResilientApiClient client, IOptions<ModuleApiConfigOptions> config, string module)
    {
        Client = client;
        Endpoint = config.Value.For(module);
    }

    protected string NewCorrelationId() => Guid.NewGuid().ToString();

    /// <summary>module|operation|dimension1|dimension2|... — spec section 7. Every dimension
    /// that can distinguish two rows sharing the same numeric count must be included; a bare
    /// district or a bare count value is never enough on its own.</summary>
    protected static string BuildCacheKey(string module, string operation, params object?[] dimensions) =>
        string.Join("|", new[] { module, operation }.Concat(dimensions.Select(NormalizeKeyPart)));

    private static string NormalizeKeyPart(object? part)
    {
        switch (part)
        {
            case null:
                return "-";
            case string s:
                return string.IsNullOrWhiteSpace(s) ? "-" : s.Trim();
            case System.Collections.IEnumerable enumerable and not string:
                var items = enumerable.Cast<object?>().Select(o => o?.ToString() ?? "").Where(o => o.Length > 0).OrderBy(o => o, StringComparer.Ordinal);
                var joined = string.Join(",", items);
                return joined.Length == 0 ? "-" : joined;
            default:
                return part.ToString() ?? "-";
        }
    }

    /// <summary>Pull a filter value out of the clickContext/filters dictionary, trying a few
    /// case variants — dashboard filter objects in this codebase are a mix of camelCase
    /// (frontend) and PascalCase (backend DTOs).</summary>
    protected static T? GetFilter<T>(Dictionary<string, object?> filters, string key, T? fallback = default)
    {
        foreach (var candidate in new[] { key, char.ToUpperInvariant(key[0]) + key[1..], char.ToLowerInvariant(key[0]) + key[1..] })
        {
            if (filters.TryGetValue(candidate, out var v) && v is not null)
            {
                try
                {
                    if (v is T typed) return typed;
                    return (T?)Convert.ChangeType(v, typeof(T));
                }
                catch { /* fall through to next candidate / fallback */ }
            }
        }
        return fallback;
    }

    protected static string?[] GetFilterArray(Dictionary<string, object?> filters, string key)
    {
        foreach (var candidate in new[] { key, char.ToUpperInvariant(key[0]) + key[1..] })
        {
            if (filters.TryGetValue(candidate, out var v) && v is System.Collections.IEnumerable en and not string)
                return en.Cast<object?>().Select(o => o?.ToString()).ToArray();
            if (filters.TryGetValue(candidate, out var single) && single is string s)
                return new[] { s };
        }
        return Array.Empty<string?>();
    }
}
