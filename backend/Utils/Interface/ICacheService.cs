namespace Utils.Interface;

public interface ICacheService
{
    Task<T> GetOrCreateAsync<T>(string key, TimeSpan ttl, Func<Task<T>> factory);
    void Remove(string key);
}
