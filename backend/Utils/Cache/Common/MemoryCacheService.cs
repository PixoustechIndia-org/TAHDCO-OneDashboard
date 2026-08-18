using Microsoft.Extensions.Caching.Memory;
using Utils.Interface;

namespace Utils.Cache.Common;

/// <summary>IMemoryCache-backed cache used for dashboard aggregates and lookups.</summary>
public class MemoryCacheService : ICacheService
{
    private readonly IMemoryCache _cache;
    public MemoryCacheService(IMemoryCache cache) => _cache = cache;

    public async Task<T> GetOrCreateAsync<T>(string key, TimeSpan ttl, Func<Task<T>> factory)
    {
        if (_cache.TryGetValue(key, out T? hit) && hit is not null) return hit;
        var value = await factory();
        _cache.Set(key, value, ttl);
        return value;
    }

    public void Remove(string key) => _cache.Remove(key);
}
