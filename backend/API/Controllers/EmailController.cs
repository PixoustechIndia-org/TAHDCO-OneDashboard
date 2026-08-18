using BAL.Interface;
using Microsoft.AspNetCore.Mvc;
using Model.ViewModel;
using System.Threading.Tasks;

namespace API.Controllers
{
    [Route("api/v1/[controller]")]
    [ApiController]
    public class EmailController : ControllerBase
    {
        private readonly IEmailService _emailService;

        public EmailController(IEmailService emailService)
        {
            _emailService = emailService;
        }

        [HttpPost("send")]
        public async Task<IActionResult> SendEmail([FromBody] EmailRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.ToEmail))
            {
                return BadRequest(new { status = false, message = "ToEmail is required" });
            }

            var result = await _emailService.SendEmailAsync(request);
            if (result)
            {
                return Ok(new { status = true, message = "Email sent successfully." });
            }

            return StatusCode(500, new { status = false, message = "Failed to send email." });
        }
    }
}
