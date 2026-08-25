namespace Model.ViewModel;

public class RoleVm
{
    public int RoleId { get; set; }
    public string RoleCode { get; set; } = "";
    public string RoleName { get; set; } = "";
    public string? Description { get; set; }
    public string Scope { get; set; } = "all"; // all | division | district
    public bool IsSystem { get; set; }
    public bool IsActive { get; set; } = true;
    public int UserCount { get; set; }
    public List<string> AssignedProjects { get; set; } = new();
    public DateTime? CreatedAt { get; set; }
}

public class SaveRoleRequest
{
    public string RoleCode { get; set; } = "";
    public string RoleName { get; set; } = "";
    public string? Description { get; set; }
    public string Scope { get; set; } = "all";
    public bool IsActive { get; set; } = true;
    public List<string> ProjectCodes { get; set; } = new();
}

public class ProjectVm
{
    public int ProjectId { get; set; }
    public string ProjectCode { get; set; } = "";
    public string ProjectName { get; set; } = "";
    public string Category { get; set; } = "Engineering"; // Engineering | Welfare | TNCWWN | Monitoring | Operations | Admin
    public string? Description { get; set; }
    public string? ApiEndpoint { get; set; }
    public string? Icon { get; set; } = "pi-folder";
    public string Status { get; set; } = "Active"; // Active | Inactive | Maintenance
    public bool IsActive { get; set; } = true;
    public int ActiveUserCount { get; set; }
    public int ActiveRoleCount { get; set; }
    public DateTime? CreatedAt { get; set; }
}

public class SaveProjectRequest
{
    public string ProjectCode { get; set; } = "";
    public string ProjectName { get; set; } = "";
    public string Category { get; set; } = "Engineering";
    public string? Description { get; set; }
    public string? ApiEndpoint { get; set; }
    public string? Icon { get; set; } = "pi-folder";
    public string Status { get; set; } = "Active";
    public bool IsActive { get; set; } = true;
}

public class ProjectMappingVm
{
    public int MappingId { get; set; }
    public string MappingType { get; set; } = "USER"; // USER | ROLE
    public int? EntityId { get; set; }
    public string EntityCode { get; set; } = ""; // email or role_code
    public string EntityName { get; set; } = ""; // full_name or role_name
    public int? ProjectId { get; set; }
    public string ProjectCode { get; set; } = "";
    public string ProjectName { get; set; } = "";
    public bool CanView { get; set; } = true;
    public bool CanCreate { get; set; }
    public bool CanEdit { get; set; }
    public bool CanUpdate { get; set; }
    public bool CanDelete { get; set; }
    public string Status { get; set; } = "Active";
    public string? AssignedBy { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class SaveProjectMappingRequest
{
    public int? MappingId { get; set; }
    public string MappingType { get; set; } = "USER"; // USER | ROLE
    public string EntityCode { get; set; } = "";
    public string EntityName { get; set; } = "";
    public string ProjectCode { get; set; } = "";
    public string ProjectName { get; set; } = "";
    public bool CanView { get; set; } = true;
    public bool CanCreate { get; set; }
    public bool CanEdit { get; set; }
    public bool CanUpdate { get; set; }
    public bool CanDelete { get; set; }
    public string Status { get; set; } = "Active";
    public string? AssignedBy { get; set; }
}

public class BatchMappingRequest
{
    public string MappingType { get; set; } = "USER"; // USER | ROLE
    public string EntityCode { get; set; } = "";
    public string EntityName { get; set; } = "";
    public List<SaveProjectMappingRequest> Mappings { get; set; } = new();
}
