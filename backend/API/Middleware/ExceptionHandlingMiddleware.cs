using System.Net;
using System.Text.Json;

namespace API.Middleware;

/// <summary>Converts unhandled exceptions into a consistent JSON problem payload.</summary>
public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _log;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> log)
    { _next = next; _log = log; }

    public async Task InvokeAsync(HttpContext context)
    {
        try { await _next(context); }
        catch (Exception ex)
        {
            _log.LogError(ex, "Unhandled exception on {Path}", context.Request.Path);
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                status = 500,
                message = "An unexpected error occurred. The incident has been logged.",
                traceId = context.TraceIdentifier
            }));
        }
    }
}
