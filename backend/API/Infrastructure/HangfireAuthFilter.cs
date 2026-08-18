using Hangfire.Dashboard;
using System.Security.Claims;

namespace API.Infrastructure;

/// <summary>Restricts Hangfire dashboard to authenticated Admin users only.</summary>
public class HangfireAuthFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var httpContext = context.GetHttpContext();
        var user = httpContext.User;
        return user.Identity?.IsAuthenticated == true
            && user.IsInRole("admin");
    }
}
