using Model.ViewModel;

namespace BAL.Interface;

public interface IAuthService
{
    Task<LoginResponse?> LoginAsync(LoginRequest request);
}
