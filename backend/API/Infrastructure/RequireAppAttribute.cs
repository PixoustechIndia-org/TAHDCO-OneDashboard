using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace API.Infrastructure;

/// <summary>
/// Grants access when the JWT "apps" claim contains ANY of the listed app codes.
/// Access lists — EE: TIPS,TIME,Patrol360,THMS · GM: Scheme,TELP,TAMS,TOD ·
/// MD/Secretary: all nine apps.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class RequireAppAttribute : Attribute, IAuthorizationFilter
{
    private readonly string[] _apps;
    public RequireAppAttribute(params string[] apps) => _apps = apps;

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;
        if (user.Identity?.IsAuthenticated != true)
        {
            context.Result = new UnauthorizedResult();
            return;
        }
        var granted = (user.FindFirst("apps")?.Value ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (!_apps.Any(a => granted.Contains(a, StringComparer.OrdinalIgnoreCase)))
            context.Result = new ObjectResult(new
            {
                status = 403,
                message = $"Your role does not have access to this module ({string.Join('/', _apps)})."
            })
            { StatusCode = 403 };
    }
}
