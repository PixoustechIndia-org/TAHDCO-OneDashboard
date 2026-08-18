namespace API.Infrastructure.Services;

public interface IExternalApiClient
{
    Task<string> GetAsync(string url);
}

/// <summary>Sample IHttpClientFactory consumer for calling upstream field systems
/// (TIPS / THMS / TAMS ...) when live integration replaces seeded data.</summary>
public class ExternalApiClient : IExternalApiClient
{
    private readonly IHttpClientFactory _factory;
    public ExternalApiClient(IHttpClientFactory factory) => _factory = factory;

    public async Task<string> GetAsync(string url)
    {
        var client = _factory.CreateClient("external");
        using var resp = await client.GetAsync(url);
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadAsStringAsync();
    }
}
