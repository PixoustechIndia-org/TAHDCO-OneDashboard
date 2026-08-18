using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using BAL.Interface;
using Model.ViewModel;

namespace API.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;
    public AuthController(IAuthService auth) => _auth = auth;

    /// <summary>Authenticate and receive a JWT. Demo: md@tahdco.in / password123</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        var resp = await _auth.LoginAsync(request);
        if (resp is null) return Unauthorized(new { message = "Invalid email or password." });

        HttpContext.Session.SetString("userEmail", resp.User.Email);   // session demo
        return Ok(resp);
    }
}
