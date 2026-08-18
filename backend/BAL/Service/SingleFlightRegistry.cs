using System.Collections.Concurrent;

namespace BAL.Service;

/// <summary>
/// Request de-duplication (spec section 27): if N callers ask for the same cacheKey while
/// a fetch for that exact key is already in flight, only ONE upstream call happens and every
/// caller awaits the same Task. Registered as a Singleton so it de-dupes across the whole
/// process, not per-request. Deliberately in-process only (no distributed lock) — see the
/// architecture doc for the multi-instance follow-up (Redis/DB advisory lock) this leaves open.
/// </summary>
public interface ISingleFlightRegistry
{
    Task<T> RunOnceAsync<T>(string key, Func<Task<T>> factory);
}

public class SingleFlightRegistry : ISingleFlightRegistry
{
    private readonly ConcurrentDictionary<string, Lazy<Task<object?>>> _inFlight = new();

    public async Task<T> RunOnceAsync<T>(string key, Func<Task<T>> factory)
    {
        var lazy = _inFlight.GetOrAdd(key, _ => new Lazy<Task<object?>>(async () =>
        {
            try { return (object?)await factory(); }
            finally { _inFlight.TryRemove(key, out var _); }
        }));

        var result = await lazy.Value;
        return (T)result!;
    }
}
