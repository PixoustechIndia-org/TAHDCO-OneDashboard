using Model.ViewModel;

namespace BAL.Interface;

public interface IAuthService
{
    Task<LoginResponse?> LoginAsync(LoginRequest request);
    Task<(bool Success, string Message)> ChangePasswordAsync(string email, string currentPassword, string newPassword);
}
