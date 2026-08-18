using Model.ViewModel;
using System.Threading.Tasks;

namespace BAL.Interface
{
    public interface IEmailService
    {
        Task<bool> SendEmailAsync(EmailRequest request);
    }
}
