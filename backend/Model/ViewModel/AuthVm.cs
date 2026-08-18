namespace Model.ViewModel;

public record LoginRequest(string Email, string Password);

public class ProjectPrivilege
{
    public bool View { get; set; }
    public bool Create { get; set; }
    public bool Edit { get; set; }
    public bool Update { get; set; }
    public bool Delete { get; set; }
}

public class UserVm
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Role { get; set; } = "";
    public string Scope { get; set; } = "all";
    public int? DivisionId { get; set; }
    public string? DivisionName { get; set; }
    public int? DistrictId { get; set; }
    public string? DistrictName { get; set; }
    public string[] AppAccess { get; set; } = Array.Empty<string>();
    /// <summary>Per-project Create/Edit/Update/Delete/View flags.</summary>
    public Dictionary<string, ProjectPrivilege> Privileges { get; set; } = new();
    public bool IsActive { get; set; }
    public string? LastLogin { get; set; }
}

public class SaveUserRequest
{
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Password { get; set; }              // required on create
    public string Role { get; set; } = "dm";
    public string? DivisionName { get; set; }
    public string? DistrictName { get; set; }
    public bool IsActive { get; set; } = true;
    public Dictionary<string, ProjectPrivilege> Privileges { get; set; } = new();
}

public class LoginResponse
{
    public string Token { get; set; } = "";
    public UserVm User { get; set; } = new();
}

/// <summary>Row shape read from app_user via Dapper.</summary>
public class AppUserRow
{
    public int UserId { get; set; }
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string PasswordSalt { get; set; } = "";
    public string Role { get; set; } = "";
    public string Scope { get; set; } = "all";
    public int? DivisionId { get; set; }
    public string? DivisionName { get; set; }
    public int? DistrictId { get; set; }
    public string? DistrictName { get; set; }
    public string AppAccess { get; set; } = "";
    public bool IsActive { get; set; }
    public DateTime? LastLogin { get; set; }
}

/// <summary>Row shape read from user_privilege via Dapper.</summary>
public class PrivilegeRow
{
    public int UserId { get; set; }
    public string Project { get; set; } = "";
    public bool CanView { get; set; }
    public bool CanCreate { get; set; }
    public bool CanEdit { get; set; }
    public bool CanUpdate { get; set; }
    public bool CanDelete { get; set; }
}
