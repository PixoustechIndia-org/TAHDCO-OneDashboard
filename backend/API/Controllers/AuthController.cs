using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using BAL.Interface;
using Model.ViewModel;

namespace API.Controllers;

[ApiController]
[Route("api/v1/auth")]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;
    public AuthController(IAuthService auth) => _auth = auth;

    /// <summary>Authenticate and receive a JWT. Demo: md@tahdco.in / Password123!</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<object>> Login([FromBody] LoginRequest request)
    {
        LoginResponse? resp = null;
        try
        {
            resp = await _auth.LoginAsync(request);
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("ACCOUNT_INACTIVE"))
        {
            return StatusCode(403, new {
                status = "ACCOUNT_INACTIVE",
                statusCode = 403,
                errorCode = "ACCOUNT_INACTIVE",
                message = "Your account is currently inactive. Please contact the TAHDCO administrator to activate your account."
            });
        }

        if (resp is null)
        {
            return Unauthorized(new {
                status = "UNAUTHORIZED",
                statusCode = 401,
                errorCode = "AUTH_INVALID_OFFICIAL_CREDENTIALS",
                businessDomain = "Identity Governance & Executive Access Management",
                businessTerm = "Executive Authentication & Role-Based Access Control (RBAC)",
                message = "Official executive authentication failed. The provided official email identity or security passkey is invalid or unverified.",
                businessResolution = "Please verify that your official @tahdco.in government email address is registered and that your credentials are correct.",
                securityContext = new {
                    securityProtocol = "TLS 1.3 / OAuth2 JWT Bearer / BCrypt WorkFactor-11",
                    authenticationScope = "Statewide Executive Monitoring, Administrative Divisions & Districts",
                    timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
                }
            });
        }

        HttpContext.Session.SetString("userEmail", resp.User.Email);   // session demo
        return Ok(new {
            status = "SUCCESS",
            statusCode = 200,
            message = "Authentication successful. Executive credentials verified for TAHDCO Unified Dashboard Platform.",
            businessTerm = "User Identity Verification & Access Control",
            user = resp.User,
            token = resp.Token
        });
    }

    /// <summary>Change password for authenticated or identified user.</summary>
    [HttpPost("change-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        var email = req.Email;
        if (string.IsNullOrWhiteSpace(email))
        {
            email = User?.Identity?.Name ?? User?.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;
        }

        if (string.IsNullOrWhiteSpace(email))
            return BadRequest(new { status = "FAILED", message = "User email identity is required to change password." });

        if (string.IsNullOrWhiteSpace(req.CurrentPassword))
            return BadRequest(new { status = "FAILED", message = "Current password is required." });

        if (string.IsNullOrWhiteSpace(req.NewPassword))
            return BadRequest(new { status = "FAILED", message = "New password is required." });

        if (req.NewPassword.Length < 6)
            return BadRequest(new { status = "FAILED", message = "New password must be at least 6 characters long." });

        if (!string.IsNullOrWhiteSpace(req.ConfirmPassword) && req.NewPassword != req.ConfirmPassword)
            return BadRequest(new { status = "FAILED", message = "New password and confirmation password do not match." });

        var (success, msg) = await _auth.ChangePasswordAsync(email, req.CurrentPassword, req.NewPassword);
        if (!success)
            return BadRequest(new { status = "FAILED", message = msg });

        return Ok(new { status = "SUCCESS", message = msg });
    }
}
