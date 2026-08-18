namespace BAL.Interface;

/// <summary>Thrown by <see cref="IResilientApiClient"/> after retries are exhausted (or on a
/// non-retryable error). The message is always sanitized/generic — callers may log
/// <see cref="Detail"/> internally but must never surface it to end users or the LLM
/// (spec section 10/15: no stack traces, no raw exception text reaching the UI/AI).</summary>
public class ExternalApiException : Exception
{
    public int? HttpStatus { get; }
    public bool Timeout { get; }
    public string Detail { get; }

    public ExternalApiException(string message, string detail, int? httpStatus = null, bool timeout = false, Exception? inner = null)
        : base(message, inner)
    {
        Detail = detail;
        HttpStatus = httpStatus;
        Timeout = timeout;
    }
}

/// <summary>
/// Reusable HTTP client wrapper for every upstream project API (spec section 20).
/// Centralizes base concerns so no adapter re-implements them: timeout, bounded retry
/// for transient failures only (never retries 4xx), correlation-ID propagation, and
/// structured before/after logging. Module adapters are the only callers — nothing
/// above them ever touches HttpClient directly.
/// </summary>
public interface IResilientApiClient
{
    Task<string> PostJsonAsync(string url, object payload, string correlationId, int timeoutSeconds = 15, int maxRetries = 2, CancellationToken ct = default);

    Task<string> GetAsync(string url, IDictionary<string, string?>? queryParams, string correlationId, int timeoutSeconds = 15, int maxRetries = 2, CancellationToken ct = default);
}
