using Model.ViewModel;

namespace BAL.Interface;

public interface IUserService
{
    Task<IEnumerable<UserVm>> GetUsersAsync(string? search);
    Task<UserVm?> GetUserAsync(int id);
    Task<UserVm> CreateAsync(SaveUserRequest req);
    Task<UserVm?> UpdateAsync(int id, SaveUserRequest req);
    Task<bool> DeleteAsync(int id);
}
