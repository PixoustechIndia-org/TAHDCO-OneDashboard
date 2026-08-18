using System.Net;
using System.Text;
using System.Text.Json;
using BAL.Interface;
using Microsoft.Extensions.Logging;

namespace BAL.Service;

/// <summary>
/// See <see cref="IResilientApiClient"/>. Uses the pre-registered "external" named
/// HttpClient (already configured in ServiceCollectionExtensions.AddAppServices with a
/// permissive TLS callback for the upstream QA hosts, matching the rest of the codebase's
/// Live*Service classes) so this doesn't introduce a second connection pool.
/// </summary>
public class ResilientApiClient : IResilientApiClient
{
    private readonly IHttpClientFactory _factory;
    private readonly ILogger<ResilientApiClient> _log;

    // 4xx (except 408/429) are the caller's fault, not a transient failure — never retried.
    private static readonly HashSet<int> NonRetryableStatus = new() { 400, 401, 403, 404, 405, 409, 422 };

    public ResilientApiClient(IHttpClientFactory factory, ILogger<ResilientApiClient> log)
    {
        _factory = factory;
        _log = log;
    }

    public async Task<string> PostJsonAsync(string url, object payload, string correlationId, int timeoutSeconds = 15, int maxRetries = 2, CancellationToken ct = default)
    {
        var json = JsonSerializer.Serialize(payload);
        return await SendWithRetryAsync(
            () =>
            {
                var req = new HttpRequestMessage(HttpMethod.Post, url)
                { Content = new StringContent(json, Encoding.UTF8, "application/json") };
                req.Headers.Add("X-Correlation-Id", correlationId);
                return req;
            },
            correlationId, url, timeoutSeconds, maxRetries, ct);
    }

    public async Task<string> GetAsync(string url, IDictionary<string, string?>? queryParams, string correlationId, int timeoutSeconds = 15, int maxRetries = 2, CancellationToken ct = default)
    {
        var finalUrl = BuildUrlWithQuery(url, queryParams);
        return await SendWithRetryAsync(
            () =>
            {
                var req = new HttpRequestMessage(HttpMethod.Get, finalUrl);
                req.Headers.Add("X-Correlation-Id", correlationId);
                return req;
            },
            correlationId, finalUrl, timeoutSeconds, maxRetries, ct);
    }

    /// <summary>Proper query-string builder (spec section 23) — never manual/unsafe string
    /// concatenation. Every value is percent-encoded via Uri.EscapeDataString; null/empty
    /// values are skipped instead of emitting "Key=". Deliberately avoids System.Web
    /// (not available to a plain class-library-SDK project like BAL).</summary>
    public static string BuildUrlWithQuery(string baseUrl, IDictionary<string, string?>? queryParams)
    {
        if (queryParams is null || queryParams.Count == 0) return baseUrl;

        var pairs = queryParams
            .Where(kv => !string.IsNullOrEmpty(kv.Value))
            .Select(kv => $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value!)}")
            .ToList();
        if (pairs.Count == 0) return baseUrl;

        var separator = baseUrl.Contains('?') ? "&" : "?";
        return baseUrl + separator + string.Join("&", pairs);
    }

    private async Task<string> SendWithRetryAsync(Func<HttpRequestMessage> requestFactory, string correlationId, string url, int timeoutSeconds, int maxRetries, CancellationToken ct)
    {
        var client = _factory.CreateClient("external");
        client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);

        Exception? lastError = null;
        int attempt = 0;

        while (attempt <= maxRetries)
        {
            attempt++;
            try
            {
                using var request = requestFactory();
                _log.LogInformation("ExternalApiCall {CorrelationId} attempt {Attempt}/{MaxAttempts} {Method} {Url}",
                    correlationId, attempt, maxRetries + 1, request.Method, url);

                using var response = await client.SendAsync(request, ct);
                var body = await response.Content.ReadAsStringAsync(ct);

                if (response.IsSuccessStatusCode)
                    return body;

                var status = (int)response.StatusCode;
                if (NonRetryableStatus.Contains(status) || attempt > maxRetries)
                {
                    throw new ExternalApiException(
                        $"Upstream API returned {status}.",
                        detail: $"{url} -> HTTP {status}: {Truncate(body, 500)}",
                        httpStatus: status);
                }

                // Transient (5xx, 408, 429) — fall through to retry with backoff.
                lastError = new ExternalApiException($"Upstream API returned {status}.", $"{url} -> HTTP {status}", status);
            }
            catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
            {
                lastError = new ExternalApiException("Upstream API timed out.", $"{url} timed out after {timeoutSeconds}s", timeout: true, inner: ex);
                if (attempt > maxRetries) throw lastError;
            }
            catch (HttpRequestException ex)
            {
                lastError = new ExternalApiException("Upstream API is unreachable.", $"{url} -> {ex.Message}", inner: ex);
                if (attempt > maxRetries) throw lastError;
            }
            catch (ExternalApiException)
            {
                throw; // non-retryable, already logged above
            }

            if (attempt <= maxRetries)
            {
                var delayMs = 200 * (int)Math.Pow(2, attempt - 1); // 200ms, 400ms, 800ms...
                _log.LogWarning("ExternalApiCall {CorrelationId} attempt {Attempt} failed, retrying in {DelayMs}ms: {Error}",
                    correlationId, attempt, delayMs, lastError?.Message);
                await Task.Delay(delayMs, ct);
            }
        }

        throw lastError ?? new ExternalApiException("Upstream API call failed.", $"{url} failed with no captured error");
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max] + "...";
}
