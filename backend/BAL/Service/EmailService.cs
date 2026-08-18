using BAL.Interface;
using Microsoft.Extensions.Configuration;
using Model.ViewModel;
using System;
using System.Net;
using System.Net.Mail;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace BAL.Service
{
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<bool> SendEmailAsync(EmailRequest request)
        {
            // FIX: Validate inputs before doing any work
            if (string.IsNullOrWhiteSpace(request.ToEmail))
            {
                _logger.LogWarning("SendEmailAsync called with empty ToEmail");
                return false;
            }

            if (!IsValidEmail(request.ToEmail))
            {
                _logger.LogWarning("SendEmailAsync called with invalid email address: {ToEmail}", request.ToEmail);
                return false;
            }

            try
            {
                var smtpServer = _configuration["EmailConfig:SmtpServer"];
                var portString  = _configuration["EmailConfig:Port"];
                var sslString   = _configuration["EmailConfig:SSL"];
                var email       = _configuration["EmailConfig:Email"];
                var password    = _configuration["EmailConfig:Password"];
                var from        = _configuration["EmailConfig:From"];

                int port = int.TryParse(portString, out var p) ? p : 587;
                bool enableSsl = bool.TryParse(sslString, out var s) ? s : true;

                // FIX: Use 'using' to ensure MailMessage (and its streams) are disposed
                using var message = new MailMessage
                {
                    From = new MailAddress(from ?? email!),
                    Subject = request.Subject ?? "(No Subject)",
                    Body = request.Body ?? "",
                    IsBodyHtml = true
                };

                // FIX: MemoryStream is owned by MailMessage — disposed when message is disposed
                if (!string.IsNullOrWhiteSpace(request.AttachmentBase64) &&
                    !string.IsNullOrWhiteSpace(request.AttachmentFileName))
                {
                    var fileBytes = Convert.FromBase64String(request.AttachmentBase64);
                    var stream = new System.IO.MemoryStream(fileBytes);
                    message.Attachments.Add(new Attachment(stream, request.AttachmentFileName,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
                }

                message.To.Add(new MailAddress(request.ToEmail));

                using var client = new SmtpClient(smtpServer, port)
                {
                    Credentials = new NetworkCredential(email, password),
                    EnableSsl = enableSsl
                };

                await client.SendMailAsync(message);
                _logger.LogInformation("Email sent successfully to {ToEmail}", request.ToEmail);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending email to {ToEmail}", request.ToEmail);
                return false;
            }
        }

        // FIX: Proper email validation helper
        private static bool IsValidEmail(string email)
        {
            try { var _ = new MailAddress(email); return true; }
            catch { return false; }
        }
    }
}
