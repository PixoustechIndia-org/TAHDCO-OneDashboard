using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DAL;
using Model.ViewModel;
using MiniExcelLibs;
using System.Data;
using Dapper;
using System.Linq;

namespace API.Controllers;

[ApiController]
[Route("api/v1/configuration")]
[Authorize(Roles = "admin,md")]
public class ConfigurationController : ControllerBase
{
    private readonly IDapperRepository _db;
    public ConfigurationController(IDapperRepository db) => _db = db;

    private async Task EnsureTablesAsync()
    {
        try
        {
            await _db.ExecuteAsync(@"
                CREATE TABLE IF NOT EXISTS local_body_mapping (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    sno INT NULL,
                    state VARCHAR(100) NULL,
                    division VARCHAR(100) NULL,
                    district VARCHAR(100) NULL,
                    local_body VARCHAR(100) NULL,
                    local_body_name VARCHAR(255) NULL,
                    block VARCHAR(100) NULL,
                    village_panchayat VARCHAR(255) NULL,
                    corporation VARCHAR(255) NULL,
                    town_panchayat VARCHAR(255) NULL,
                    municipality VARCHAR(255) NULL,
                    gcc VARCHAR(255) NULL,
                    cmwssb VARCHAR(255) NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );");

            await _db.ExecuteAsync(@"
                CREATE TABLE IF NOT EXISTS app_role (
                    role_id INT AUTO_INCREMENT PRIMARY KEY,
                    role_code VARCHAR(50) NOT NULL UNIQUE,
                    role_name VARCHAR(100) NOT NULL,
                    description VARCHAR(255) NULL,
                    scope VARCHAR(30) NOT NULL DEFAULT 'all',
                    is_system TINYINT(1) NOT NULL DEFAULT 0,
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                );");

            await _db.ExecuteAsync(@"
                CREATE TABLE IF NOT EXISTS app_project (
                    project_id INT AUTO_INCREMENT PRIMARY KEY,
                    project_code VARCHAR(50) NOT NULL UNIQUE,
                    project_name VARCHAR(100) NOT NULL,
                    category VARCHAR(50) NOT NULL,
                    description VARCHAR(255) NULL,
                    api_endpoint VARCHAR(255) NULL,
                    icon VARCHAR(50) NULL DEFAULT 'pi-folder',
                    status VARCHAR(20) NOT NULL DEFAULT 'Active',
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                );");

            await _db.ExecuteAsync(@"
                CREATE TABLE IF NOT EXISTS app_project_mapping (
                    mapping_id INT AUTO_INCREMENT PRIMARY KEY,
                    mapping_type VARCHAR(20) NOT NULL,
                    entity_id INT NULL,
                    entity_code VARCHAR(100) NOT NULL,
                    entity_name VARCHAR(150) NOT NULL,
                    project_id INT NULL,
                    project_code VARCHAR(50) NOT NULL,
                    project_name VARCHAR(100) NOT NULL,
                    can_view TINYINT(1) NOT NULL DEFAULT 1,
                    can_create TINYINT(1) NOT NULL DEFAULT 0,
                    can_edit TINYINT(1) NOT NULL DEFAULT 0,
                    can_update TINYINT(1) NOT NULL DEFAULT 0,
                    can_delete TINYINT(1) NOT NULL DEFAULT 0,
                    status VARCHAR(20) NOT NULL DEFAULT 'Active',
                    assigned_by VARCHAR(100) NULL DEFAULT 'System Admin',
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_mapping_entity_project (mapping_type, entity_code, project_code)
                );");
        }
        catch { }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 1. ROLE MANAGEMENT ENDPOINTS
    // ════════════════════════════════════════════════════════════════════════

    [HttpGet("roles")]
    [AllowAnonymous]
    public async Task<IActionResult> GetRoles([FromQuery] string? search)
    {
        try
        {
            await EnsureTablesAsync();
            var sql = @"
                SELECT r.role_id AS RoleId, r.role_code AS RoleCode, r.role_name AS RoleName,
                       r.description AS Description, r.scope AS Scope, r.is_system AS IsSystem,
                       r.is_active AS IsActive, r.created_at AS CreatedAt,
                       COUNT(DISTINCT u.user_id) AS UserCount
                FROM app_role r
                LEFT JOIN app_user u ON (u.role = r.role_code OR u.role = r.role_name)
                WHERE 1=1";

            var p = new DynamicParameters();
            if (!string.IsNullOrWhiteSpace(search))
            {
                sql += " AND (r.role_code LIKE @Q OR r.role_name LIKE @Q OR r.description LIKE @Q)";
                p.Add("Q", $"%{search}%");
            }
            sql += " GROUP BY r.role_id, r.role_code, r.role_name, r.description, r.scope, r.is_system, r.is_active, r.created_at ORDER BY r.is_system DESC, r.role_id ASC";

            var roles = (await _db.QueryAsync<RoleVm>(sql, p)).ToList();
            if (roles.Count == 0)
            {
                await SeedDefaultRolesAsync();
                roles = (await _db.QueryAsync<RoleVm>(sql, p)).ToList();
            }

            foreach (var r in roles)
            {
                var prjSql = "SELECT project_code FROM app_project_mapping WHERE mapping_type='ROLE' AND entity_code=@Code AND can_view=1";
                r.AssignedProjects = (await _db.QueryAsync<string>(prjSql, new { Code = r.RoleCode })).ToList();
            }

            return Ok(roles);
        }
        catch (Exception)
        {
            return Ok(GetSeedRoles(search));
        }
    }

    [HttpPost("roles")]
    [AllowAnonymous]
    public async Task<IActionResult> CreateRole([FromBody] SaveRoleRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.RoleCode) || string.IsNullOrWhiteSpace(req.RoleName))
            return BadRequest(new { message = "Role Code and Role Name are required." });

        try
        {
            await EnsureTablesAsync();
            var exists = await _db.QueryFirstOrDefaultAsync<int?>("SELECT role_id FROM app_role WHERE role_code=@Code", new { Code = req.RoleCode.Trim().ToLower() });
            if (exists.HasValue)
                return BadRequest(new { message = $"Role with code '{req.RoleCode}' already exists." });

            var roleCode = req.RoleCode.Trim().ToLower();
            var insertSql = @"
                INSERT INTO app_role (role_code, role_name, description, scope, is_system, is_active)
                VALUES (@RoleCode, @RoleName, @Description, @Scope, 0, @IsActive);
                SELECT LAST_INSERT_ID();";

            var roleId = await _db.QuerySingleAsync<int>(insertSql, new
            {
                RoleCode = roleCode,
                RoleName = req.RoleName.Trim(),
                Description = req.Description,
                Scope = req.Scope ?? "all",
                IsActive = req.IsActive ? 1 : 0
            });

            if (req.ProjectCodes != null && req.ProjectCodes.Count > 0)
            {
                foreach (var prj in req.ProjectCodes)
                {
                    await _db.ExecuteAsync(@"
                        INSERT INTO app_project_mapping (mapping_type, entity_code, entity_name, project_code, project_name, can_view, can_create, can_edit, can_update, can_delete, status)
                        VALUES ('ROLE', @RoleCode, @RoleName, @ProjectCode, @ProjectCode, 1, 1, 1, 1, 0, 'Active')
                        ON DUPLICATE KEY UPDATE can_view=1;", new
                    {
                        RoleCode = roleCode,
                        RoleName = req.RoleName.Trim(),
                        ProjectCode = prj
                    });
                }
            }

            return Ok(new { message = $"Role '{req.RoleName}' created successfully.", roleId });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to create role", error = ex.Message });
        }
    }

    [HttpPut("roles/{id:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> UpdateRole(int id, [FromBody] SaveRoleRequest req)
    {
        try
        {
            await EnsureTablesAsync();
            var updateSql = @"
                UPDATE app_role
                SET role_name=@RoleName, description=@Description, scope=@Scope, is_active=@IsActive
                WHERE role_id=@Id";

            await _db.ExecuteAsync(updateSql, new
            {
                Id = id,
                RoleName = req.RoleName.Trim(),
                Description = req.Description,
                Scope = req.Scope ?? "all",
                IsActive = req.IsActive ? 1 : 0
            });

            return Ok(new { message = "Role updated successfully." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to update role", error = ex.Message });
        }
    }

    [HttpDelete("roles/{id:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> DeleteRole(int id)
    {
        try
        {
            await EnsureTablesAsync();
            var role = await _db.QueryFirstOrDefaultAsync<RoleVm>("SELECT role_id AS RoleId, role_code AS RoleCode, is_system AS IsSystem FROM app_role WHERE role_id=@Id", new { Id = id });
            if (role == null) return NotFound(new { message = "Role not found." });
            if (role.IsSystem) return BadRequest(new { message = "Core system roles cannot be deleted." });

            await _db.ExecuteAsync("DELETE FROM app_project_mapping WHERE mapping_type='ROLE' AND entity_code=@Code", new { Code = role.RoleCode });
            await _db.ExecuteAsync("DELETE FROM app_role WHERE role_id=@Id", new { Id = id });

            return Ok(new { message = "Role and associated mappings deleted successfully." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to delete role", error = ex.Message });
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. PROJECT MANAGEMENT ENDPOINTS (Engineering, Welfare, TNCWWN, etc.)
    // ════════════════════════════════════════════════════════════════════════

    [HttpGet("projects")]
    [AllowAnonymous]
    public async Task<IActionResult> GetProjects([FromQuery] string? search, [FromQuery] string? category)
    {
        try
        {
            await EnsureTablesAsync();
            var sql = @"
                SELECT p.project_id AS ProjectId, p.project_code AS ProjectCode, p.project_name AS ProjectName,
                       p.category AS Category, p.description AS Description, p.api_endpoint AS ApiEndpoint,
                       p.icon AS Icon, p.status AS Status, p.is_active AS IsActive, p.created_at AS CreatedAt,
                       COUNT(DISTINCT CASE WHEN m.mapping_type='USER' THEN m.entity_code END) AS ActiveUserCount,
                       COUNT(DISTINCT CASE WHEN m.mapping_type='ROLE' THEN m.entity_code END) AS ActiveRoleCount
                FROM app_project p
                LEFT JOIN app_project_mapping m ON (m.project_code = p.project_code AND m.can_view = 1)
                WHERE 1=1";

            var dyn = new DynamicParameters();
            if (!string.IsNullOrWhiteSpace(search))
            {
                sql += " AND (p.project_code LIKE @Q OR p.project_name LIKE @Q OR p.description LIKE @Q OR p.category LIKE @Q)";
                dyn.Add("Q", $"%{search}%");
            }
            if (!string.IsNullOrWhiteSpace(category) && category != "All")
            {
                sql += " AND p.category = @Cat";
                dyn.Add("Cat", category);
            }
            sql += " GROUP BY p.project_id, p.project_code, p.project_name, p.category, p.description, p.api_endpoint, p.icon, p.status, p.is_active, p.created_at ORDER BY p.project_id ASC";

            var projects = (await _db.QueryAsync<ProjectVm>(sql, dyn)).ToList();
            if (projects.Count == 0)
            {
                await SeedDefaultProjectsAsync();
                projects = (await _db.QueryAsync<ProjectVm>(sql, dyn)).ToList();
            }

            return Ok(projects);
        }
        catch (Exception)
        {
            return Ok(GetSeedProjects(search, category));
        }
    }

    [HttpPost("projects")]
    [AllowAnonymous]
    public async Task<IActionResult> CreateProject([FromBody] SaveProjectRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.ProjectCode) || string.IsNullOrWhiteSpace(req.ProjectName))
            return BadRequest(new { message = "Project Code and Project Name are required." });

        try
        {
            await EnsureTablesAsync();
            var exists = await _db.QueryFirstOrDefaultAsync<int?>("SELECT project_id FROM app_project WHERE project_code=@Code", new { Code = req.ProjectCode.Trim().ToUpper() });
            if (exists.HasValue)
                return BadRequest(new { message = $"Project with code '{req.ProjectCode}' already exists." });

            var projectCode = req.ProjectCode.Trim().ToUpper();
            var insertSql = @"
                INSERT INTO app_project (project_code, project_name, category, description, api_endpoint, icon, status, is_active)
                VALUES (@ProjectCode, @ProjectName, @Category, @Description, @ApiEndpoint, @Icon, @Status, @IsActive);
                SELECT LAST_INSERT_ID();";

            var id = await _db.QuerySingleAsync<int>(insertSql, new
            {
                ProjectCode = projectCode,
                ProjectName = req.ProjectName.Trim(),
                Category = req.Category ?? "Engineering",
                Description = req.Description,
                ApiEndpoint = req.ApiEndpoint,
                Icon = string.IsNullOrWhiteSpace(req.Icon) ? "pi-folder" : req.Icon,
                Status = req.Status ?? "Active",
                IsActive = req.IsActive ? 1 : 0
            });

            return Ok(new { message = $"Project '{req.ProjectName}' created successfully.", projectId = id });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to create project", error = ex.Message });
        }
    }

    [HttpPut("projects/{id:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> UpdateProject(int id, [FromBody] SaveProjectRequest req)
    {
        try
        {
            await EnsureTablesAsync();
            var updateSql = @"
                UPDATE app_project
                SET project_name=@ProjectName, category=@Category, description=@Description,
                    api_endpoint=@ApiEndpoint, icon=@Icon, status=@Status, is_active=@IsActive
                WHERE project_id=@Id";

            await _db.ExecuteAsync(updateSql, new
            {
                Id = id,
                ProjectName = req.ProjectName.Trim(),
                Category = req.Category ?? "Engineering",
                Description = req.Description,
                ApiEndpoint = req.ApiEndpoint,
                Icon = string.IsNullOrWhiteSpace(req.Icon) ? "pi-folder" : req.Icon,
                Status = req.Status ?? "Active",
                IsActive = req.IsActive ? 1 : 0
            });

            return Ok(new { message = "Project updated successfully." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to update project", error = ex.Message });
        }
    }

    [HttpDelete("projects/{id:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> DeleteProject(int id)
    {
        try
        {
            await EnsureTablesAsync();
            var prj = await _db.QueryFirstOrDefaultAsync<ProjectVm>("SELECT project_id AS ProjectId, project_code AS ProjectCode FROM app_project WHERE project_id=@Id", new { Id = id });
            if (prj == null) return NotFound(new { message = "Project not found." });

            await _db.ExecuteAsync("DELETE FROM app_project_mapping WHERE project_code=@Code", new { Code = prj.ProjectCode });
            await _db.ExecuteAsync("DELETE FROM app_project WHERE project_id=@Id", new { Id = id });

            return Ok(new { message = "Project and associated mappings removed successfully." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to delete project", error = ex.Message });
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. PROJECT MAPPING ENDPOINTS (Map User/Role to Projects with CRUD Validation)
    // ════════════════════════════════════════════════════════════════════════

    [HttpGet("project-mappings")]
    [AllowAnonymous]
    public async Task<IActionResult> GetProjectMappings([FromQuery] string? type, [FromQuery] string? project, [FromQuery] string? search)
    {
        try
        {
            await EnsureTablesAsync();
            var sql = @"
                SELECT mapping_id AS MappingId, mapping_type AS MappingType, entity_id AS EntityId,
                       entity_code AS EntityCode, entity_name AS EntityName, project_id AS ProjectId,
                       project_code AS ProjectCode, project_name AS ProjectName, can_view AS CanView,
                       can_create AS CanCreate, can_edit AS CanEdit, can_update AS CanUpdate,
                       can_delete AS CanDelete, status AS Status, assigned_by AS AssignedBy,
                       created_at AS CreatedAt, updated_at AS UpdatedAt
                FROM app_project_mapping
                WHERE 1=1";

            var p = new DynamicParameters();
            if (!string.IsNullOrWhiteSpace(type) && type != "ALL")
            {
                sql += " AND mapping_type = @Type";
                p.Add("Type", type.ToUpper());
            }
            if (!string.IsNullOrWhiteSpace(project) && project != "ALL")
            {
                sql += " AND project_code = @Prj";
                p.Add("Prj", project);
            }
            if (!string.IsNullOrWhiteSpace(search))
            {
                sql += " AND (entity_name LIKE @Q OR entity_code LIKE @Q OR project_name LIKE @Q OR project_code LIKE @Q)";
                p.Add("Q", $"%{search}%");
            }
            sql += " ORDER BY mapping_type ASC, entity_name ASC, project_code ASC";

            var list = (await _db.QueryAsync<ProjectMappingVm>(sql, p)).ToList();
            if (list.Count == 0 && string.IsNullOrWhiteSpace(search))
            {
                await SeedDefaultMappingsAsync();
                list = (await _db.QueryAsync<ProjectMappingVm>(sql, p)).ToList();
            }

            return Ok(list);
        }
        catch (Exception)
        {
            return Ok(GetSeedMappings(type, project, search));
        }
    }

    [HttpPost("project-mappings")]
    [AllowAnonymous]
    public async Task<IActionResult> CreateProjectMapping([FromBody] SaveProjectMappingRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.EntityCode) || string.IsNullOrWhiteSpace(req.ProjectCode))
            return BadRequest(new { message = "Entity and Project are required for mapping." });

        try
        {
            await EnsureTablesAsync();
            var upsertSql = @"
                INSERT INTO app_project_mapping (mapping_type, entity_code, entity_name, project_code, project_name, can_view, can_create, can_edit, can_update, can_delete, status, assigned_by)
                VALUES (@MappingType, @EntityCode, @EntityName, @ProjectCode, @ProjectName, @CanView, @CanCreate, @CanEdit, @CanUpdate, @CanDelete, @Status, @AssignedBy)
                ON DUPLICATE KEY UPDATE
                    entity_name = VALUES(entity_name),
                    project_name = VALUES(project_name),
                    can_view = VALUES(can_view),
                    can_create = VALUES(can_create),
                    can_edit = VALUES(can_edit),
                    can_update = VALUES(can_update),
                    can_delete = VALUES(can_delete),
                    status = VALUES(status),
                    assigned_by = VALUES(assigned_by);";

            await _db.ExecuteAsync(upsertSql, new
            {
                MappingType = req.MappingType?.ToUpper() ?? "USER",
                EntityCode = req.EntityCode.Trim(),
                EntityName = string.IsNullOrWhiteSpace(req.EntityName) ? req.EntityCode : req.EntityName.Trim(),
                ProjectCode = req.ProjectCode.Trim().ToUpper(),
                ProjectName = string.IsNullOrWhiteSpace(req.ProjectName) ? req.ProjectCode : req.ProjectName.Trim(),
                CanView = req.CanView ? 1 : 0,
                CanCreate = req.CanCreate ? 1 : 0,
                CanEdit = req.CanEdit ? 1 : 0,
                CanUpdate = req.CanUpdate ? 1 : 0,
                CanDelete = req.CanDelete ? 1 : 0,
                Status = req.Status ?? "Active",
                AssignedBy = req.AssignedBy ?? "System Admin"
            });

            if (string.Equals(req.MappingType, "USER", StringComparison.OrdinalIgnoreCase))
            {
                var userId = await _db.QueryFirstOrDefaultAsync<int?>("SELECT user_id FROM app_user WHERE email=@Email", new { Email = req.EntityCode });
                if (userId.HasValue)
                {
                    await _db.ExecuteAsync(@"
                        INSERT INTO user_privilege (user_id, project, can_view, can_create, can_edit, can_update, can_delete)
                        VALUES (@UserId, @Project, @CanView, @CanCreate, @CanEdit, @CanUpdate, @CanDelete)
                        ON DUPLICATE KEY UPDATE
                            can_view=VALUES(can_view), can_create=VALUES(can_create), can_edit=VALUES(can_edit),
                            can_update=VALUES(can_update), can_delete=VALUES(can_delete);", new
                    {
                        UserId = userId.Value,
                        Project = req.ProjectCode,
                        CanView = req.CanView ? 1 : 0,
                        CanCreate = req.CanCreate ? 1 : 0,
                        CanEdit = req.CanEdit ? 1 : 0,
                        CanUpdate = req.CanUpdate ? 1 : 0,
                        CanDelete = req.CanDelete ? 1 : 0
                    });
                }
            }

            return Ok(new { message = $"Project '{req.ProjectCode}' mapped to {req.EntityName} successfully." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to save project mapping", error = ex.Message });
        }
    }

    [HttpPost("project-mappings/batch")]
    [AllowAnonymous]
    public async Task<IActionResult> BatchMapProjects([FromBody] BatchMappingRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.EntityCode) || req.Mappings == null || req.Mappings.Count == 0)
            return BadRequest(new { message = "Entity code and at least one project mapping are required." });

        try
        {
            await EnsureTablesAsync();
            foreach (var m in req.Mappings)
            {
                m.MappingType = req.MappingType;
                m.EntityCode = req.EntityCode;
                m.EntityName = req.EntityName;
                await CreateProjectMapping(m);
            }
            return Ok(new { message = $"{req.Mappings.Count} project mappings applied successfully." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Batch mapping failed", error = ex.Message });
        }
    }

    [HttpPut("project-mappings/{id:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> UpdateProjectMapping(int id, [FromBody] SaveProjectMappingRequest req)
    {
        try
        {
            await EnsureTablesAsync();
            var updateSql = @"
                UPDATE app_project_mapping
                SET can_view=@CanView, can_create=@CanCreate, can_edit=@CanEdit,
                    can_update=@CanUpdate, can_delete=@CanDelete, status=@Status, assigned_by=@AssignedBy
                WHERE mapping_id=@Id";

            await _db.ExecuteAsync(updateSql, new
            {
                Id = id,
                CanView = req.CanView ? 1 : 0,
                CanCreate = req.CanCreate ? 1 : 0,
                CanEdit = req.CanEdit ? 1 : 0,
                CanUpdate = req.CanUpdate ? 1 : 0,
                CanDelete = req.CanDelete ? 1 : 0,
                Status = req.Status ?? "Active",
                AssignedBy = req.AssignedBy ?? "System Admin"
            });

            return Ok(new { message = "Project mapping updated successfully." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to update project mapping", error = ex.Message });
        }
    }

    [HttpDelete("project-mappings/{id:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> DeleteProjectMapping(int id)
    {
        try
        {
            await EnsureTablesAsync();
            await _db.ExecuteAsync("DELETE FROM app_project_mapping WHERE mapping_id=@Id", new { Id = id });
            return Ok(new { message = "Project mapping deleted successfully." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to delete mapping", error = ex.Message });
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. LOCAL BODY MAPPING ENDPOINTS
    // ════════════════════════════════════════════════════════════════════════

    [HttpGet("records")]
    [AllowAnonymous]
    public async Task<IActionResult> GetRecords([FromQuery] string? search, [FromQuery] string? district, [FromQuery] string? division)
    {
        try
        {
            await EnsureTablesAsync();

            var sql = @"
                SELECT id AS Id, sno AS Sno, state AS State, division AS Division, district AS District,
                       local_body AS LocalBody, local_body_name AS LocalBodyName, block AS Block,
                       village_panchayat AS VillagePanchayat, corporation AS Corporation,
                       town_panchayat AS TownPanchayat, municipality AS Municipality,
                       gcc AS Gcc, cmwssb AS Cmwssb
                FROM local_body_mapping WHERE 1=1";
            
            var p = new DynamicParameters();
            if (!string.IsNullOrWhiteSpace(search))
            {
                sql += @" AND (state LIKE @Q OR division LIKE @Q OR district LIKE @Q 
                              OR local_body_name LIKE @Q OR block LIKE @Q OR village_panchayat LIKE @Q 
                              OR municipality LIKE @Q OR corporation LIKE @Q OR town_panchayat LIKE @Q)";
                p.Add("Q", $"%{search}%");
            }
            if (!string.IsNullOrWhiteSpace(district) && district != "All Districts")
            {
                sql += " AND district = @Dist";
                p.Add("Dist", district);
            }
            if (!string.IsNullOrWhiteSpace(division) && division != "All Divisions")
            {
                sql += " AND division = @Div";
                p.Add("Div", division);
            }

            sql += " ORDER BY id";
            var records = (await _db.QueryAsync<LocalBodyMappingVm>(sql, p)).ToList();

            // If table is completely empty, seed initial baseline 38-district Tamil Nadu Local Body mappings
            if (records.Count == 0 && string.IsNullOrWhiteSpace(search))
            {
                await SeedDefaultRecordsAsync();
                records = (await _db.QueryAsync<LocalBodyMappingVm>(sql, p)).ToList();
            }

            return Ok(records);
        }
        catch (Exception)
        {
            // Database is offline - return the 38-district in-memory dataset
            return Ok(Get38DistrictSeedList(search, district, division));
        }
    }

    [HttpPost("records")]
    [AllowAnonymous]
    public async Task<IActionResult> AddRecord([FromBody] LocalBodyMappingVm model)
    {
        await EnsureTablesAsync();
        var insertSql = @"
            INSERT INTO local_body_mapping (sno, state, division, district, local_body, local_body_name, block, village_panchayat, corporation, town_panchayat, municipality, gcc, cmwssb)
            VALUES (@Sno, @State, @Division, @District, @LocalBody, @LocalBodyName, @Block, @VillagePanchayat, @Corporation, @TownPanchayat, @Municipality, @Gcc, @Cmwssb)";
        
        await _db.ExecuteAsync(insertSql, model);
        return Ok(new { message = "Record added successfully." });
    }

    [HttpPut("records/{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> UpdateRecord(int id, [FromBody] LocalBodyMappingVm model)
    {
        await EnsureTablesAsync();
        model.Id = id;
        var updateSql = @"
            UPDATE local_body_mapping 
            SET sno=@Sno, state=@State, division=@Division, district=@District,
                local_body=@LocalBody, local_body_name=@LocalBodyName, block=@Block,
                village_panchayat=@VillagePanchayat, corporation=@Corporation,
                town_panchayat=@TownPanchayat, municipality=@Municipality, gcc=@Gcc, cmwssb=@Cmwssb
            WHERE id = @Id";
        
        await _db.ExecuteAsync(updateSql, model);
        return Ok(new { message = "Record updated successfully." });
    }

    [HttpDelete("records/{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> DeleteRecord(int id)
    {
        await EnsureTablesAsync();
        await _db.ExecuteAsync("DELETE FROM local_body_mapping WHERE id = @Id", new { Id = id });
        return Ok(new { message = "Record deleted successfully." });
    }

    [HttpDelete("records")]
    [AllowAnonymous]
    public async Task<IActionResult> ClearRecords()
    {
        await EnsureTablesAsync();
        await _db.ExecuteAsync("TRUNCATE TABLE local_body_mapping");
        return Ok(new { message = "All records cleared successfully." });
    }

    [HttpPost("import")]
    [AllowAnonymous]
    public async Task<IActionResult> Import(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file uploaded." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx" && ext != ".xls")
            return BadRequest(new { message = "Only Excel files (.xlsx, .xls) are allowed." });

        try
        {
            await EnsureTablesAsync();
            using var stream = file.OpenReadStream();
            var rows = MiniExcel.Query(stream).Cast<IDictionary<string, object>>().ToList();
            
            var list = new List<LocalBodyMappingVm>();
            int idx = 1;
            foreach (var dict in rows)
            {
                string GetVal(string keyPattern)
                {
                    var matchKey = dict.Keys.FirstOrDefault(k => 
                        k.Equals(keyPattern, StringComparison.OrdinalIgnoreCase) || 
                        k.Replace(" ", "").Equals(keyPattern.Replace(" ", ""), StringComparison.OrdinalIgnoreCase)
                    );
                    if (matchKey != null)
                        return dict[matchKey]?.ToString()?.Trim() ?? "";
                    return "";
                }
                
                int? GetIntVal(string keyPattern)
                {
                    var valStr = GetVal(keyPattern);
                    if (int.TryParse(valStr, out var i))
                        return i;
                    return null;
                }

                var sno = GetIntVal("sno") ?? idx++;
                var state = GetVal("State");
                var division = GetVal("Division");
                var district = GetVal("District");
                var localBody = GetVal("Local body");
                var localBodyName = GetVal("name of the localbody");
                var block = GetVal("BLOCK");
                var villagePanchayat = GetVal("Village pancayet");
                var corporation = GetVal("Corrpration");
                var townPanchayat = GetVal("townpanyptet");
                var municipality = GetVal("Muncipality");
                var gcc = GetVal("GCC");
                var cmwssb = GetVal("CMws");

                if (string.IsNullOrWhiteSpace(state) && string.IsNullOrWhiteSpace(division) && 
                    string.IsNullOrWhiteSpace(district) && string.IsNullOrWhiteSpace(localBodyName))
                    continue;

                list.Add(new LocalBodyMappingVm
                {
                    Sno = sno,
                    State = string.IsNullOrWhiteSpace(state) ? "Tamil Nadu" : state,
                    Division = division,
                    District = district,
                    LocalBody = localBody,
                    LocalBodyName = localBodyName,
                    Block = block,
                    VillagePanchayat = villagePanchayat,
                    Corporation = corporation,
                    TownPanchayat = townPanchayat,
                    Municipality = municipality,
                    Gcc = gcc,
                    Cmwssb = cmwssb
                });
            }

            if (list.Count == 0)
                return BadRequest(new { message = "No valid records found in the Excel file." });

            await _db.ExecuteAsync("TRUNCATE TABLE local_body_mapping");
            
            var insertSql = @"
                INSERT INTO local_body_mapping (sno, state, division, district, local_body, local_body_name, block, village_panchayat, corporation, town_panchayat, municipality, gcc, cmwssb)
                VALUES (@Sno, @State, @Division, @District, @LocalBody, @LocalBodyName, @Block, @VillagePanchayat, @Corporation, @TownPanchayat, @Municipality, @Gcc, @Cmwssb)";
                
            await _db.ExecuteAsync(insertSql, list);

            return Ok(new { message = $"{list.Count} records imported successfully.", count = list.Count });
        }
        catch (System.Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred during import.", error = ex.Message });
        }
    }

    private async Task SeedDefaultRolesAsync()
    {
        var seedList = GetSeedRoles(null);
        foreach (var r in seedList)
        {
            await _db.ExecuteAsync(@"
                INSERT INTO app_role (role_code, role_name, description, scope, is_system, is_active)
                VALUES (@RoleCode, @RoleName, @Description, @Scope, @IsSystem, @IsActive)
                ON DUPLICATE KEY UPDATE role_name=VALUES(role_name);", r);
        }
    }

    private async Task SeedDefaultProjectsAsync()
    {
        var seedList = GetSeedProjects(null, null);
        foreach (var p in seedList)
        {
            await _db.ExecuteAsync(@"
                INSERT INTO app_project (project_code, project_name, category, description, api_endpoint, icon, status, is_active)
                VALUES (@ProjectCode, @ProjectName, @Category, @Description, @ApiEndpoint, @Icon, @Status, @IsActive)
                ON DUPLICATE KEY UPDATE project_name=VALUES(project_name);", p);
        }
    }

    private async Task SeedDefaultMappingsAsync()
    {
        var seedList = GetSeedMappings(null, null, null);
        foreach (var m in seedList)
        {
            await _db.ExecuteAsync(@"
                INSERT INTO app_project_mapping (mapping_type, entity_code, entity_name, project_code, project_name, can_view, can_create, can_edit, can_update, can_delete, status)
                VALUES (@MappingType, @EntityCode, @EntityName, @ProjectCode, @ProjectName, @CanView, @CanCreate, @CanEdit, @CanUpdate, @CanDelete, @Status)
                ON DUPLICATE KEY UPDATE can_view=VALUES(can_view);", m);
        }
    }

    public static List<RoleVm> GetSeedRoles(string? search)
    {
        var roles = new List<RoleVm>
        {
            new() { RoleId = 1, RoleCode = "admin", RoleName = "Application Admin", Description = "Full administrative access to all configuration and security settings", Scope = "all", IsSystem = true, IsActive = true, UserCount = 1, AssignedProjects = new() { "ENG", "WELFARE", "TNCWWN", "TIPS", "TIME", "THMS", "TAMS", "SCHEME", "TELP", "TOD", "ONEPORTAL", "PATROL360" } },
            new() { RoleId = 2, RoleCode = "md", RoleName = "Managing Director", Description = "Strategic oversight of corporation-wide projects and KPIs", Scope = "all", IsSystem = true, IsActive = true, UserCount = 1, AssignedProjects = new() { "ENG", "WELFARE", "TNCWWN", "TIPS", "TIME", "THMS", "TAMS", "SCHEME", "TELP", "TOD", "ONEPORTAL", "PATROL360" } },
            new() { RoleId = 3, RoleCode = "secretary", RoleName = "Secretary", Description = "Government oversight and high-level performance reporting", Scope = "all", IsSystem = true, IsActive = true, UserCount = 1, AssignedProjects = new() { "ENG", "WELFARE", "TNCWWN", "TIPS", "TIME", "THMS", "TAMS", "SCHEME", "TELP", "TOD", "ONEPORTAL", "PATROL360" } },
            new() { RoleId = 4, RoleCode = "ce", RoleName = "Chief Engineer", Description = "Statewide engineering, tender, housing, and surveillance monitoring", Scope = "all", IsSystem = true, IsActive = true, UserCount = 1, AssignedProjects = new() { "ENG", "TIPS", "TIME", "PATROL360", "THMS" } },
            new() { RoleId = 5, RoleCode = "gm", RoleName = "General Manager", Description = "Corporate management across welfare schemes, loans, and training", Scope = "all", IsSystem = true, IsActive = true, UserCount = 1, AssignedProjects = new() { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD" } },
            new() { RoleId = 6, RoleCode = "ee", RoleName = "Executive Engineer", Description = "Division-level engineering, tender execution, and progress tracking", Scope = "division", IsSystem = true, IsActive = true, UserCount = 9, AssignedProjects = new() { "ENG", "TIPS", "TIME", "PATROL360", "THMS" } },
            new() { RoleId = 7, RoleCode = "dm", RoleName = "District Manager", Description = "District-level welfare, schemes, loans, and field operational execution", Scope = "district", IsSystem = true, IsActive = true, UserCount = 37, AssignedProjects = new() { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWN" } },
            new() { RoleId = 8, RoleCode = "eng_lead", RoleName = "Engineering Project Lead", Description = "Dedicated lead for engineering and infrastructure projects", Scope = "all", IsSystem = false, IsActive = true, UserCount = 2, AssignedProjects = new() { "ENG", "TIPS", "TIME", "PATROL360", "THMS" } },
            new() { RoleId = 9, RoleCode = "welfare_officer", RoleName = "Welfare Officer", Description = "Coordinates TAHDCO welfare schemes and loan distributions", Scope = "district", IsSystem = false, IsActive = true, UserCount = 4, AssignedProjects = new() { "WELFARE", "SCHEME", "TELP" } },
            new() { RoleId = 10, RoleCode = "tncwwn_coord", RoleName = "TNCWWN Coordinator", Description = "Oversees Construction Workers Welfare Board integrations", Scope = "all", IsSystem = false, IsActive = true, UserCount = 2, AssignedProjects = new() { "TNCWWN", "ONEPORTAL" } }
        };

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            roles = roles.Where(r => r.RoleCode.ToLower().Contains(q) || r.RoleName.ToLower().Contains(q) || (r.Description ?? "").ToLower().Contains(q)).ToList();
        }
        return roles;
    }

    public static List<ProjectVm> GetSeedProjects(string? search, string? category)
    {
        var projects = new List<ProjectVm>
        {
            new() { ProjectId = 1, ProjectCode = "ENG", ProjectName = "Engineering", Category = "Engineering", Description = "Unified Engineering project umbrella for construction, tenders and infrastructure", ApiEndpoint = "https://time.tahdco.com/api/Report/OneDashboard_Work_Get", Icon = "pi-wrench", Status = "Active", IsActive = true, ActiveUserCount = 12, ActiveRoleCount = 4 },
            new() { ProjectId = 2, ProjectCode = "WELFARE", ProjectName = "Welfare", Category = "Welfare", Description = "Unified Welfare project umbrella for schemes, subsidies and community upliftment", ApiEndpoint = "https://scst.pixous.info/Report/GetSchemeSummary", Icon = "pi-heart", Status = "Active", IsActive = true, ActiveUserCount = 42, ActiveRoleCount = 5 },
            new() { ProjectId = 3, ProjectCode = "TNCWWN", ProjectName = "TNCWWN", Category = "Welfare Board", Description = "Tamil Nadu Construction Workers Welfare Board integrated tracking", ApiEndpoint = "https://testtncwwbv2-qa.pixoustech.app/api/OneDashboard/General", Icon = "pi-id-card", Status = "Active", IsActive = true, ActiveUserCount = 39, ActiveRoleCount = 4 },
            new() { ProjectId = 4, ProjectCode = "TIPS", ProjectName = "TIPS Tender System", Category = "Engineering", Description = "Tamil Nadu Infrastructure Procurement & Tender Management System", ApiEndpoint = "https://time.tahdco.com/api/Dashboard/Get_Mbook_Tender_Status", Icon = "pi-file-edit", Status = "Active", IsActive = true, ActiveUserCount = 12, ActiveRoleCount = 4 },
            new() { ProjectId = 5, ProjectCode = "TIME", ProjectName = "TIME Work Progress", Category = "Engineering", Description = "TAHDCO Infrastructure Monitoring & Measurement Book Execution", ApiEndpoint = "https://time.tahdco.com/api/Report/OneDashboard_Work_Get", Icon = "pi-clock", Status = "Active", IsActive = true, ActiveUserCount = 12, ActiveRoleCount = 4 },
            new() { ProjectId = 6, ProjectCode = "PATROL360", ProjectName = "Patrol 360 Surveillance", Category = "Engineering", Description = "Real-time CCTV & site drone patrol live streaming monitoring", ApiEndpoint = "https://time.tahdco.com/api/Report/OneDashboard_Work_Get", Icon = "pi-video", Status = "Active", IsActive = true, ActiveUserCount = 12, ActiveRoleCount = 4 },
            new() { ProjectId = 7, ProjectCode = "THMS", ProjectName = "THMS Housing System", Category = "Engineering", Description = "TAHDCO Housing Management System for beneficiary housing phases", ApiEndpoint = "https://thmsqa.pixoustech.in/App/api/onedashboard/count", Icon = "pi-building", Status = "Active", IsActive = true, ActiveUserCount = 12, ActiveRoleCount = 4 },
            new() { ProjectId = 8, ProjectCode = "TAMS", ProjectName = "TAMS Skill & Attendance", Category = "Welfare", Description = "TAHDCO Attendance & Vocational Training Management System", ApiEndpoint = "https://tamsqa.pixoustech.in/App/api/attendance/report-details", Icon = "pi-graduation-cap", Status = "Active", IsActive = true, ActiveUserCount = 40, ActiveRoleCount = 4 },
            new() { ProjectId = 9, ProjectCode = "SCHEME", ProjectName = "TAHDCO Special Schemes", Category = "Welfare", Description = "SC/ST Special Central Assistance & State development schemes", ApiEndpoint = "https://scst.pixous.info/Report/GetSchemeSummary", Icon = "pi-wallet", Status = "Active", IsActive = true, ActiveUserCount = 40, ActiveRoleCount = 4 },
            new() { ProjectId = 10, ProjectCode = "TELP", ProjectName = "TELP Financial Loans", Category = "Welfare", Description = "TAHDCO Economic & Livelihood Promotion Loan Portal", ApiEndpoint = "https://qatelp.pixous.info/api/Report/DistrictWise_ApplicationSummary", Icon = "pi-book", Status = "Active", IsActive = true, ActiveUserCount = 40, ActiveRoleCount = 4 },
            new() { ProjectId = 11, ProjectCode = "TOD", ProjectName = "TOD Task & Diary System", Category = "Operations", Description = "TAHDCO Officer Diary & Field Task Inspection Module", ApiEndpoint = "https://tod.tahdco.app/api/Dashboard/UserTaskStatusSummaryList", Icon = "pi-calendar", Status = "Active", IsActive = true, ActiveUserCount = 40, ActiveRoleCount = 4 },
            new() { ProjectId = 12, ProjectCode = "ONEPORTAL", ProjectName = "One Portal Aggregator", Category = "Unified Dashboard", Description = "Central Multi-Module Aggregator & Reporting Engine", ApiEndpoint = "https://testtncwwbv2-qa.pixoustech.app/api/OneDashboard/General", Icon = "pi-th-large", Status = "Active", IsActive = true, ActiveUserCount = 45, ActiveRoleCount = 5 }
        };

        var filtered = projects.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(category) && category != "All")
            filtered = filtered.Where(p => p.Category.Equals(category, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            filtered = filtered.Where(p => p.ProjectCode.ToLower().Contains(q) || p.ProjectName.ToLower().Contains(q) || (p.Description ?? "").ToLower().Contains(q));
        }
        return filtered.ToList();
    }

    public static List<ProjectMappingVm> GetSeedMappings(string? type, string? project, string? search)
    {
        var list = new List<ProjectMappingVm>
        {
            new() { MappingId = 1, MappingType = "ROLE", EntityCode = "admin", EntityName = "Application Admin", ProjectCode = "ENG", ProjectName = "Engineering", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = true, Status = "Active" },
            new() { MappingId = 2, MappingType = "ROLE", EntityCode = "admin", EntityName = "Application Admin", ProjectCode = "WELFARE", ProjectName = "Welfare", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = true, Status = "Active" },
            new() { MappingId = 3, MappingType = "ROLE", EntityCode = "admin", EntityName = "Application Admin", ProjectCode = "TNCWWN", ProjectName = "TNCWWN", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = true, Status = "Active" },
            new() { MappingId = 4, MappingType = "ROLE", EntityCode = "admin", EntityName = "Application Admin", ProjectCode = "TIPS", ProjectName = "TIPS Tender System", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = true, Status = "Active" },
            new() { MappingId = 5, MappingType = "ROLE", EntityCode = "admin", EntityName = "Application Admin", ProjectCode = "TIME", ProjectName = "TIME Work Progress", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = true, Status = "Active" },
            new() { MappingId = 6, MappingType = "ROLE", EntityCode = "admin", EntityName = "Application Admin", ProjectCode = "PATROL360", ProjectName = "Patrol 360 Surveillance", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = true, Status = "Active" },
            new() { MappingId = 7, MappingType = "ROLE", EntityCode = "admin", EntityName = "Application Admin", ProjectCode = "THMS", ProjectName = "THMS Housing System", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = true, Status = "Active" },
            new() { MappingId = 8, MappingType = "ROLE", EntityCode = "admin", EntityName = "Application Admin", ProjectCode = "TAMS", ProjectName = "TAMS Skill & Attendance", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = true, Status = "Active" },
            new() { MappingId = 9, MappingType = "ROLE", EntityCode = "admin", EntityName = "Application Admin", ProjectCode = "SCHEME", ProjectName = "TAHDCO Special Schemes", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = true, Status = "Active" },
            new() { MappingId = 10, MappingType = "ROLE", EntityCode = "admin", EntityName = "Application Admin", ProjectCode = "TELP", ProjectName = "TELP Financial Loans", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = true, Status = "Active" },
            new() { MappingId = 11, MappingType = "ROLE", EntityCode = "admin", EntityName = "Application Admin", ProjectCode = "TOD", ProjectName = "TOD Task & Diary System", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = true, Status = "Active" },
            new() { MappingId = 12, MappingType = "ROLE", EntityCode = "admin", EntityName = "Application Admin", ProjectCode = "ONEPORTAL", ProjectName = "One Portal Aggregator", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = true, Status = "Active" },

            new() { MappingId = 13, MappingType = "ROLE", EntityCode = "ce", EntityName = "Chief Engineer", ProjectCode = "ENG", ProjectName = "Engineering", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = false, Status = "Active" },
            new() { MappingId = 14, MappingType = "ROLE", EntityCode = "ce", EntityName = "Chief Engineer", ProjectCode = "TIPS", ProjectName = "TIPS Tender System", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = false, Status = "Active" },
            new() { MappingId = 15, MappingType = "ROLE", EntityCode = "ce", EntityName = "Chief Engineer", ProjectCode = "TIME", ProjectName = "TIME Work Progress", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = false, Status = "Active" },
            new() { MappingId = 16, MappingType = "ROLE", EntityCode = "ce", EntityName = "Chief Engineer", ProjectCode = "PATROL360", ProjectName = "Patrol 360 Surveillance", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = false, Status = "Active" },
            new() { MappingId = 17, MappingType = "ROLE", EntityCode = "ce", EntityName = "Chief Engineer", ProjectCode = "THMS", ProjectName = "THMS Housing System", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = false, Status = "Active" },

            new() { MappingId = 18, MappingType = "ROLE", EntityCode = "gm", EntityName = "General Manager", ProjectCode = "WELFARE", ProjectName = "Welfare", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = false, Status = "Active" },
            new() { MappingId = 19, MappingType = "ROLE", EntityCode = "gm", EntityName = "General Manager", ProjectCode = "SCHEME", ProjectName = "TAHDCO Special Schemes", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = false, Status = "Active" },
            new() { MappingId = 20, MappingType = "ROLE", EntityCode = "gm", EntityName = "General Manager", ProjectCode = "TELP", ProjectName = "TELP Financial Loans", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = false, Status = "Active" },
            new() { MappingId = 21, MappingType = "ROLE", EntityCode = "gm", EntityName = "General Manager", ProjectCode = "TAMS", ProjectName = "TAMS Skill & Attendance", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = false, Status = "Active" },
            new() { MappingId = 22, MappingType = "ROLE", EntityCode = "gm", EntityName = "General Manager", ProjectCode = "TOD", ProjectName = "TOD Task & Diary System", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = false, Status = "Active" },

            new() { MappingId = 23, MappingType = "ROLE", EntityCode = "tncwwn_coord", EntityName = "TNCWWN Coordinator", ProjectCode = "TNCWWN", ProjectName = "TNCWWN", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = false, Status = "Active" },
            new() { MappingId = 24, MappingType = "ROLE", EntityCode = "tncwwn_coord", EntityName = "TNCWWN Coordinator", ProjectCode = "ONEPORTAL", ProjectName = "One Portal Aggregator", CanView = true, CanCreate = true, CanEdit = true, CanUpdate = true, CanDelete = false, Status = "Active" }
        };

        var filtered = list.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(type) && type != "ALL")
            filtered = filtered.Where(m => m.MappingType.Equals(type, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(project) && project != "ALL")
            filtered = filtered.Where(m => m.ProjectCode.Equals(project, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            filtered = filtered.Where(m => m.EntityName.ToLower().Contains(q) || m.EntityCode.ToLower().Contains(q) || m.ProjectName.ToLower().Contains(q) || m.ProjectCode.ToLower().Contains(q));
        }
        return filtered.ToList();
    }

    private async Task SeedDefaultRecordsAsync()
    {
        var seedList = Get38DistrictSeedList(null, null, null);
        var insertSql = @"
            INSERT INTO local_body_mapping (sno, state, division, district, local_body, local_body_name, block, village_panchayat, corporation, town_panchayat, municipality, gcc, cmwssb)
            VALUES (@Sno, @State, @Division, @District, @LocalBody, @LocalBodyName, @Block, @VillagePanchayat, @Corporation, @TownPanchayat, @Municipality, @Gcc, @Cmwssb)";
        await _db.ExecuteAsync(insertSql, seedList);
    }

    public static List<LocalBodyMappingVm> Get38DistrictSeedList(string? search, string? district, string? division)
    {
        var rawData = new[]
        {
            // 1. Ariyalur (Trichy)
            ("Trichy", "Ariyalur", "Municipality", "Ariyalur Municipality", "Ariyalur Block", "-", "-", "-", "Ariyalur", "-", "-"),
            ("Trichy", "Ariyalur", "Municipality", "Jayankondam Municipality", "Jayankondam Block", "-", "-", "-", "Jayankondam", "-", "-"),
            ("Trichy", "Ariyalur", "Town Panchayat", "Varadarajanpettai Town Panchayat", "Andimadam Block", "-", "-", "Varadarajanpettai", "-", "-", "-"),
            ("Trichy", "Ariyalur", "Village Panchayat", "Kallankurichi Village Panchayat", "Ariyalur Block", "Kallankurichi", "-", "-", "-", "-", "-"),
            ("Trichy", "Ariyalur", "Village Panchayat", "T.Palur Village Panchayat", "T.Palur Block", "T.Palur", "-", "-", "-", "-", "-"),

            // 2. Chengalpattu (Chennai)
            ("Chennai", "Chengalpattu", "Corporation", "Tambaram City Municipal Corporation", "St. Thomas Mount Block", "-", "Tambaram", "-", "Tambaram", "-", "-"),
            ("Chennai", "Chengalpattu", "Municipality", "Chengalpattu Municipality", "Chengalpattu Block", "-", "-", "-", "Chengalpattu", "-", "-"),
            ("Chennai", "Chengalpattu", "Municipality", "Maraimalai Nagar Municipality", "Kattankulathur Block", "-", "-", "-", "Maraimalai Nagar", "-", "-"),
            ("Chennai", "Chengalpattu", "Town Panchayat", "Thiruporur Town Panchayat", "Thiruporur Block", "-", "-", "Thiruporur", "-", "-", "-"),
            ("Chennai", "Chengalpattu", "Town Panchayat", "Mamallapuram Town Panchayat", "Thirukalukundram Block", "-", "-", "Mamallapuram", "-", "-", "-"),
            ("Chennai", "Chengalpattu", "Village Panchayat", "Alapakkam Village Panchayat", "Chengalpattu Block", "Alapakkam", "-", "-", "-", "-", "-"),

            // 3. Chennai (Chennai)
            ("Chennai", "Chennai", "Corporation", "Greater Chennai Corporation - North (Zones 1-5)", "Royapuram / Tondiarpet Block", "-", "GCC", "-", "-", "Yes", "Yes"),
            ("Chennai", "Chennai", "Corporation", "Greater Chennai Corporation - Central (Zones 6-10)", "Anna Nagar / Teynampet Block", "-", "GCC", "-", "-", "Yes", "Yes"),
            ("Chennai", "Chennai", "Corporation", "Greater Chennai Corporation - South (Zones 11-15)", "Adyar / Sholinganallur Block", "-", "GCC", "-", "-", "Yes", "Yes"),
            ("Chennai", "Chennai", "Municipality", "Alandur Urban Zone", "Alandur Block", "-", "GCC", "-", "Alandur", "Yes", "Yes"),

            // 4. Coimbatore (Coimbatore)
            ("Coimbatore", "Coimbatore", "Corporation", "Coimbatore City Municipal Corporation", "Coimbatore North & South Block", "-", "Coimbatore", "-", "-", "-", "-"),
            ("Coimbatore", "Coimbatore", "Municipality", "Pollachi Municipality", "Pollachi Block", "-", "-", "-", "Pollachi", "-", "-"),
            ("Coimbatore", "Coimbatore", "Municipality", "Mettupalayam Municipality", "Karamadai Block", "-", "-", "-", "Mettupalayam", "-", "-"),
            ("Coimbatore", "Coimbatore", "Town Panchayat", "Annur Town Panchayat", "Annur Block", "-", "-", "Annur", "-", "-", "-"),
            ("Coimbatore", "Coimbatore", "Town Panchayat", "Sulur Town Panchayat", "Sulur Block", "-", "-", "Sulur", "-", "-", "-"),
            ("Coimbatore", "Coimbatore", "Village Panchayat", "Madukkarai Village Panchayat", "Madukkarai Block", "Madukkarai", "-", "-", "-", "-", "-"),

            // 5. Cuddalore (Villupuram)
            ("Villupuram", "Cuddalore", "Corporation", "Cuddalore City Municipal Corporation", "Cuddalore Block", "-", "Cuddalore", "-", "-", "-", "-"),
            ("Villupuram", "Cuddalore", "Municipality", "Panruti Municipality", "Panruti Block", "-", "-", "-", "Panruti", "-", "-"),
            ("Villupuram", "Cuddalore", "Municipality", "Chidambaram Municipality", "Parangipettai Block", "-", "-", "-", "Chidambaram", "-", "-"),
            ("Villupuram", "Cuddalore", "Town Panchayat", "Kurinjipadi Town Panchayat", "Kurinjipadi Block", "-", "-", "Kurinjipadi", "-", "-", "-"),
            ("Villupuram", "Cuddalore", "Village Panchayat", "Sedapalayam Village Panchayat", "Cuddalore Block", "Sedapalayam", "-", "-", "-", "-", "-"),

            // 6. Dharmapuri (Salem)
            ("Salem", "Dharmapuri", "Municipality", "Dharmapuri Municipality", "Dharmapuri Block", "-", "-", "-", "Dharmapuri", "-", "-"),
            ("Salem", "Dharmapuri", "Town Panchayat", "Harur Town Panchayat", "Harur Block", "-", "-", "Harur", "-", "-", "-"),
            ("Salem", "Dharmapuri", "Town Panchayat", "Palakkodu Town Panchayat", "Palakkodu Block", "-", "-", "Palakkodu", "-", "-", "-"),
            ("Salem", "Dharmapuri", "Town Panchayat", "Pennagaram Town Panchayat", "Pennagaram Block", "-", "-", "Pennagaram", "-", "-", "-"),
            ("Salem", "Dharmapuri", "Village Panchayat", "Adagapadi Village Panchayat", "Dharmapuri Block", "Adagapadi", "-", "-", "-", "-", "-"),

            // 7. Dindigul (Madurai)
            ("Madurai", "Dindigul", "Corporation", "Dindigul City Corporation", "Dindigul Block", "-", "Dindigul", "-", "-", "-", "-"),
            ("Madurai", "Dindigul", "Municipality", "Palani Municipality", "Palani Block", "-", "-", "-", "Palani", "-", "-"),
            ("Madurai", "Dindigul", "Municipality", "Kodaikanal Municipality", "Kodaikanal Block", "-", "-", "-", "Kodaikanal", "-", "-"),
            ("Madurai", "Dindigul", "Town Panchayat", "Natham Town Panchayat", "Natham Block", "-", "-", "Natham", "-", "-", "-"),
            ("Madurai", "Dindigul", "Village Panchayat", "Adiyanuthu Village Panchayat", "Dindigul Block", "Adiyanuthu", "-", "-", "-", "-", "-"),

            // 8. Erode (Coimbatore)
            ("Coimbatore", "Erode", "Corporation", "Erode City Municipal Corporation", "Erode Block", "-", "Erode", "-", "-", "-", "-"),
            ("Coimbatore", "Erode", "Municipality", "Gobichettipalayam Municipality", "Gobichettipalayam Block", "-", "-", "-", "Gobichettipalayam", "-", "-"),
            ("Coimbatore", "Erode", "Municipality", "Bhavani Municipality", "Bhavani Block", "-", "-", "-", "Bhavani", "-", "-"),
            ("Coimbatore", "Erode", "Town Panchayat", "Perundurai Town Panchayat", "Perundurai Block", "-", "-", "Perundurai", "-", "-", "-"),
            ("Coimbatore", "Erode", "Village Panchayat", "Vaikkalmedu Village Panchayat", "Modakkurichi Block", "Vaikkalmedu", "-", "-", "-", "-", "-"),

            // 9. Kallakurichi (Villupuram)
            ("Villupuram", "Kallakurichi", "Municipality", "Kallakurichi Municipality", "Kallakurichi Block", "-", "-", "-", "Kallakurichi", "-", "-"),
            ("Villupuram", "Kallakurichi", "Municipality", "Ulundurpet Municipality", "Ulundurpet Block", "-", "-", "-", "Ulundurpet", "-", "-"),
            ("Villupuram", "Kallakurichi", "Town Panchayat", "Sankarapuram Town Panchayat", "Sankarapuram Block", "-", "-", "Sankarapuram", "-", "-", "-"),
            ("Villupuram", "Kallakurichi", "Town Panchayat", "Chinnasalem Town Panchayat", "Chinnasalem Block", "-", "-", "Chinnasalem", "-", "-", "-"),
            ("Villupuram", "Kallakurichi", "Village Panchayat", "Alathur Village Panchayat", "Kallakurichi Block", "Alathur", "-", "-", "-", "-", "-"),

            // 10. Kancheepuram (Chennai)
            ("Chennai", "Kancheepuram", "Corporation", "Kancheepuram City Corporation", "Kancheepuram Block", "-", "Kancheepuram", "-", "-", "-", "-"),
            ("Chennai", "Kancheepuram", "Municipality", "Kundrathur Municipality", "Kundrathur Block", "-", "-", "-", "Kundrathur", "-", "-"),
            ("Chennai", "Kancheepuram", "Municipality", "Mangadu Municipality", "Mangadu Block", "-", "-", "-", "Mangadu", "-", "-"),
            ("Chennai", "Kancheepuram", "Town Panchayat", "Walajabad Town Panchayat", "Walajabad Block", "-", "-", "Walajabad", "-", "-", "-"),
            ("Chennai", "Kancheepuram", "Village Panchayat", "Damal Village Panchayat", "Kancheepuram Block", "Damal", "-", "-", "-", "-", "-"),

            // 11. Kanniyakumari (Tirunelveli)
            ("Tirunelveli", "Kanniyakumari", "Corporation", "Nagercoil City Corporation", "Agastheeswaram Block", "-", "Nagercoil", "-", "-", "-", "-"),
            ("Tirunelveli", "Kanniyakumari", "Municipality", "Padmanabhapuram Municipality", "Thuckalay Block", "-", "-", "-", "Padmanabhapuram", "-", "-"),
            ("Tirunelveli", "Kanniyakumari", "Municipality", "Colachel Municipality", "Kurunthencode Block", "-", "-", "-", "Colachel", "-", "-"),
            ("Tirunelveli", "Kanniyakumari", "Town Panchayat", "Kanyakumari Town Panchayat", "Agastheeswaram Block", "-", "-", "Kanyakumari", "-", "-", "-"),
            ("Tirunelveli", "Kanniyakumari", "Village Panchayat", "Suchindram Village Panchayat", "Agastheeswaram Block", "Suchindram", "-", "-", "-", "-", "-"),

            // 12. Karur (Trichy)
            ("Trichy", "Karur", "Corporation", "Karur City Municipal Corporation", "Karur Block", "-", "Karur", "-", "-", "-", "-"),
            ("Trichy", "Karur", "Municipality", "Kulithalai Municipality", "Kulithalai Block", "-", "-", "-", "Kulithalai", "-", "-"),
            ("Trichy", "Karur", "Town Panchayat", "Aravakurichi Town Panchayat", "Aravakurichi Block", "-", "-", "Aravakurichi", "-", "-", "-"),
            ("Trichy", "Karur", "Town Panchayat", "Pallapatti Town Panchayat", "Pallapatti Block", "-", "-", "Pallapatti", "-", "-", "-"),
            ("Trichy", "Karur", "Village Panchayat", "Andankoil Village Panchayat", "Thanthoni Block", "Andankoil", "-", "-", "-", "-", "-"),

            // 13. Krishnagiri (Salem)
            ("Salem", "Krishnagiri", "Corporation", "Hosur City Municipal Corporation", "Hosur Block", "-", "Hosur", "-", "-", "-", "-"),
            ("Salem", "Krishnagiri", "Municipality", "Krishnagiri Municipality", "Krishnagiri Block", "-", "-", "-", "Krishnagiri", "-", "-"),
            ("Salem", "Krishnagiri", "Town Panchayat", "Uthangarai Town Panchayat", "Uthangarai Block", "-", "-", "Uthangarai", "-", "-", "-"),
            ("Salem", "Krishnagiri", "Town Panchayat", "Kaveripattinam Town Panchayat", "Kaveripattinam Block", "-", "-", "Kaveripattinam", "-", "-", "-"),
            ("Salem", "Krishnagiri", "Village Panchayat", "Mathigiri Village Panchayat", "Hosur Block", "Mathigiri", "-", "-", "-", "-", "-"),

            // 14. Madurai (Madurai)
            ("Madurai", "Madurai", "Corporation", "Madurai City Municipal Corporation", "Madurai East & West Block", "-", "Madurai", "-", "-", "-", "-"),
            ("Madurai", "Madurai", "Municipality", "Melur Municipality", "Melur Block", "-", "-", "-", "Melur", "-", "-"),
            ("Madurai", "Madurai", "Municipality", "Thirumangalam Municipality", "Thirumangalam Block", "-", "-", "-", "Thirumangalam", "-", "-"),
            ("Madurai", "Madurai", "Town Panchayat", "Vadipatti Town Panchayat", "Vadipatti Block", "-", "-", "Vadipatti", "-", "-", "-"),
            ("Madurai", "Madurai", "Village Panchayat", "Othakadai Village Panchayat", "Madurai East Block", "Othakadai", "-", "-", "-", "-", "-"),

            // 15. Mayiladuthurai (Thanjavur)
            ("Thanjavur", "Mayiladuthurai", "Municipality", "Mayiladuthurai Municipality", "Mayiladuthurai Block", "-", "-", "-", "Mayiladuthurai", "-", "-"),
            ("Thanjavur", "Mayiladuthurai", "Municipality", "Sirkazhi Municipality", "Sirkazhi Block", "-", "-", "-", "Sirkazhi", "-", "-"),
            ("Thanjavur", "Mayiladuthurai", "Town Panchayat", "Tharangambadi Town Panchayat", "Tharangambadi Block", "-", "-", "Tharangambadi", "-", "-", "-"),
            ("Thanjavur", "Mayiladuthurai", "Town Panchayat", "Vaitheeswarankoil Town Panchayat", "Kollidam Block", "-", "-", "Vaitheeswarankoil", "-", "-", "-"),
            ("Thanjavur", "Mayiladuthurai", "Village Panchayat", "Kuthalam Village Panchayat", "Kuthalam Block", "Kuthalam", "-", "-", "-", "-", "-"),

            // 16. Nagapattinam (Thanjavur)
            ("Thanjavur", "Nagapattinam", "Municipality", "Nagapattinam Municipality", "Nagapattinam Block", "-", "-", "-", "Nagapattinam", "-", "-"),
            ("Thanjavur", "Nagapattinam", "Municipality", "Vedaranyam Municipality", "Vedaranyam Block", "-", "-", "-", "Vedaranyam", "-", "-"),
            ("Thanjavur", "Nagapattinam", "Town Panchayat", "Kilvelur Town Panchayat", "Kilvelur Block", "-", "-", "Kilvelur", "-", "-", "-"),
            ("Thanjavur", "Nagapattinam", "Town Panchayat", "Velankanni Town Panchayat", "Keelaiyur Block", "-", "-", "Velankanni", "-", "-", "-"),
            ("Thanjavur", "Nagapattinam", "Village Panchayat", "Sikkal Village Panchayat", "Nagapattinam Block", "Sikkal", "-", "-", "-", "-", "-"),

            // 17. Namakkal (Salem)
            ("Salem", "Namakkal", "Municipality", "Namakkal Municipality", "Namakkal Block", "-", "-", "-", "Namakkal", "-", "-"),
            ("Salem", "Namakkal", "Municipality", "Tiruchengode Municipality", "Tiruchengode Block", "-", "-", "-", "Tiruchengode", "-", "-"),
            ("Salem", "Namakkal", "Municipality", "Rasipuram Municipality", "Rasipuram Block", "-", "-", "-", "Rasipuram", "-", "-"),
            ("Salem", "Namakkal", "Town Panchayat", "Paramathi Town Panchayat", "Paramathi Block", "-", "-", "Paramathi", "-", "-", "-"),
            ("Salem", "Namakkal", "Village Panchayat", "Vengarai Village Panchayat", "Mohanur Block", "Vengarai", "-", "-", "-", "-", "-"),

            // 18. Perambalur (Trichy)
            ("Trichy", "Perambalur", "Municipality", "Perambalur Municipality", "Perambalur Block", "-", "-", "-", "Perambalur", "-", "-"),
            ("Trichy", "Perambalur", "Town Panchayat", "Kurumbalur Town Panchayat", "Perambalur Block", "-", "-", "Kurumbalur", "-", "-", "-"),
            ("Trichy", "Perambalur", "Town Panchayat", "Labbaikudikadu Town Panchayat", "Kunnam Block", "-", "-", "Labbaikudikadu", "-", "-", "-"),
            ("Trichy", "Perambalur", "Village Panchayat", "Elambalur Village Panchayat", "Perambalur Block", "Elambalur", "-", "-", "-", "-", "-"),
            ("Trichy", "Perambalur", "Village Panchayat", "Veppanthattai Village Panchayat", "Veppanthattai Block", "Veppanthattai", "-", "-", "-", "-", "-"),

            // 19. Pudukkottai (Trichy)
            ("Trichy", "Pudukkottai", "Corporation", "Pudukkottai Corporation", "Pudukkottai Block", "-", "Pudukkottai", "-", "-", "-", "-"),
            ("Trichy", "Pudukkottai", "Municipality", "Aranthangi Municipality", "Aranthangi Block", "-", "-", "-", "Aranthangi", "-", "-"),
            ("Trichy", "Pudukkottai", "Town Panchayat", "Alangudi Town Panchayat", "Alangudi Block", "-", "-", "Alangudi", "-", "-", "-"),
            ("Trichy", "Pudukkottai", "Town Panchayat", "Illuppur Town Panchayat", "Illuppur Block", "-", "-", "Illuppur", "-", "-", "-"),
            ("Trichy", "Pudukkottai", "Village Panchayat", "Mullur Village Panchayat", "Pudukkottai Block", "Mullur", "-", "-", "-", "-", "-"),

            // 20. Ramanathapuram (Madurai)
            ("Madurai", "Ramanathapuram", "Municipality", "Ramanathapuram Municipality", "Ramanathapuram Block", "-", "-", "-", "Ramanathapuram", "-", "-"),
            ("Madurai", "Ramanathapuram", "Municipality", "Paramakudi Municipality", "Paramakudi Block", "-", "-", "-", "Paramakudi", "-", "-"),
            ("Madurai", "Ramanathapuram", "Town Panchayat", "Rameswaram Town Panchayat", "Mandapam Block", "-", "-", "Rameswaram", "-", "-", "-"),
            ("Madurai", "Ramanathapuram", "Town Panchayat", "Kamuthi Town Panchayat", "Kamuthi Block", "-", "-", "Kamuthi", "-", "-", "-"),
            ("Madurai", "Ramanathapuram", "Village Panchayat", "Devipattinam Village Panchayat", "Ramanathapuram Block", "Devipattinam", "-", "-", "-", "-", "-"),

            // 21. Ranipet (Vellore)
            ("Vellore", "Ranipet", "Municipality", "Ranipet Municipality", "Walajah Block", "-", "-", "-", "Ranipet", "-", "-"),
            ("Vellore", "Ranipet", "Municipality", "Arakkonam Municipality", "Arakkonam Block", "-", "-", "-", "Arakkonam", "-", "-"),
            ("Vellore", "Ranipet", "Municipality", "Arcot Municipality", "Arcot Block", "-", "-", "-", "Arcot", "-", "-"),
            ("Vellore", "Ranipet", "Town Panchayat", "Kaveripakkam Town Panchayat", "Nemili Block", "-", "-", "Kaveripakkam", "-", "-", "-"),
            ("Vellore", "Ranipet", "Village Panchayat", "Ammoor Village Panchayat", "Walajah Block", "Ammoor", "-", "-", "-", "-", "-"),

            // 22. Salem (Salem)
            ("Salem", "Salem", "Corporation", "Salem City Municipal Corporation", "Salem Urban Block", "-", "Salem", "-", "-", "-", "-"),
            ("Salem", "Salem", "Municipality", "Attur Municipality", "Attur Block", "-", "-", "-", "Attur", "-", "-"),
            ("Salem", "Salem", "Municipality", "Mettur Municipality", "Mettur Block", "-", "-", "-", "Mettur", "-", "-"),
            ("Salem", "Salem", "Town Panchayat", "Jalakandapuram Town Panchayat", "Mecheri Block", "-", "-", "Jalakandapuram", "-", "-", "-"),
            ("Salem", "Salem", "Village Panchayat", "Kandhampatty Village Panchayat", "Salem Block", "Kandhampatty", "-", "-", "-", "-", "-"),

            // 23. Sivaganga (Madurai)
            ("Madurai", "Sivaganga", "Municipality", "Sivaganga Municipality", "Sivaganga Block", "-", "-", "-", "Sivaganga", "-", "-"),
            ("Madurai", "Sivaganga", "Municipality", "Karaikudi Municipality", "Sakkottai Block", "-", "-", "-", "Karaikudi", "-", "-"),
            ("Madurai", "Sivaganga", "Town Panchayat", "Thiruppuvanam Town Panchayat", "Thiruppuvanam Block", "-", "-", "Thiruppuvanam", "-", "-", "-"),
            ("Madurai", "Sivaganga", "Town Panchayat", "Manamadurai Town Panchayat", "Manamadurai Block", "-", "-", "Manamadurai", "-", "-", "-"),
            ("Madurai", "Sivaganga", "Village Panchayat", "Payampon Village Panchayat", "Sivaganga Block", "Payampon", "-", "-", "-", "-", "-"),

            // 24. Tenkasi (Tirunelveli)
            ("Tirunelveli", "Tenkasi", "Municipality", "Tenkasi Municipality", "Tenkasi Block", "-", "-", "-", "Tenkasi", "-", "-"),
            ("Tirunelveli", "Tenkasi", "Municipality", "Sankarankovil Municipality", "Sankarankovil Block", "-", "-", "-", "Sankarankovil", "-", "-"),
            ("Tirunelveli", "Tenkasi", "Municipality", "Kadayanallur Municipality", "Kadayanallur Block", "-", "-", "-", "Kadayanallur", "-", "-"),
            ("Tirunelveli", "Tenkasi", "Town Panchayat", "Courtallam Town Panchayat", "Tenkasi Block", "-", "-", "Courtallam", "-", "-", "-"),
            ("Tirunelveli", "Tenkasi", "Village Panchayat", "Kasimajorpuram Village Panchayat", "Shenkottai Block", "Kasimajorpuram", "-", "-", "-", "-", "-"),

            // 25. Thanjavur (Thanjavur)
            ("Thanjavur", "Thanjavur", "Corporation", "Thanjavur City Municipal Corporation", "Thanjavur Block", "-", "Thanjavur", "-", "-", "-", "-"),
            ("Thanjavur", "Thanjavur", "Corporation", "Kumbakonam City Corporation", "Kumbakonam Block", "-", "Kumbakonam", "-", "Kumbakonam", "-", "-"),
            ("Thanjavur", "Thanjavur", "Municipality", "Pattukkottai Municipality", "Pattukkottai Block", "-", "-", "-", "Pattukkottai", "-", "-"),
            ("Thanjavur", "Thanjavur", "Town Panchayat", "Thiruvaiyaru Town Panchayat", "Thiruvaiyaru Block", "-", "-", "Thiruvaiyaru", "-", "-", "-"),
            ("Thanjavur", "Thanjavur", "Village Panchayat", "Vallam Village Panchayat", "Thanjavur Block", "Vallam", "-", "-", "-", "-", "-"),

            // 26. The Nilgiris (Coimbatore)
            ("Coimbatore", "The Nilgiris", "Municipality", "Udhagamandalam (Ooty) Municipality", "Udhagamandalam Block", "-", "-", "-", "Ooty", "-", "-"),
            ("Coimbatore", "The Nilgiris", "Municipality", "Coonoor Municipality", "Coonoor Block", "-", "-", "-", "Coonoor", "-", "-"),
            ("Coimbatore", "The Nilgiris", "Municipality", "Gudalur Municipality", "Gudalur Block", "-", "-", "-", "Gudalur", "-", "-"),
            ("Coimbatore", "The Nilgiris", "Town Panchayat", "Kotagiri Town Panchayat", "Kotagiri Block", "-", "-", "Kotagiri", "-", "-", "-"),
            ("Coimbatore", "The Nilgiris", "Village Panchayat", "Ketti Village Panchayat", "Coonoor Block", "Ketti", "-", "-", "-", "-", "-"),

            // 27. Theni (Madurai)
            ("Madurai", "Theni", "Municipality", "Theni Allinagaram Municipality", "Theni Block", "-", "-", "-", "Theni", "-", "-"),
            ("Madurai", "Theni", "Municipality", "Bodinayakanur Municipality", "Bodinayakanur Block", "-", "-", "-", "Bodinayakanur", "-", "-"),
            ("Madurai", "Theni", "Municipality", "Periyakulam Municipality", "Periyakulam Block", "-", "-", "-", "Periyakulam", "-", "-"),
            ("Madurai", "Theni", "Town Panchayat", "Chinnamanoor Town Panchayat", "Uthamapalayam Block", "-", "-", "Chinnamanoor", "-", "-", "-"),
            ("Madurai", "Theni", "Village Panchayat", "Unjampatti Village Panchayat", "Theni Block", "Unjampatti", "-", "-", "-", "-", "-"),

            // 28. Thiruchirappalli (Trichy)
            ("Trichy", "Thiruchirappalli", "Corporation", "Tiruchirappalli City Corporation", "Trichy Urban Block", "-", "Trichy", "-", "-", "-", "-"),
            ("Trichy", "Thiruchirappalli", "Municipality", "Manapparai Municipality", "Manapparai Block", "-", "-", "-", "Manapparai", "-", "-"),
            ("Trichy", "Thiruchirappalli", "Municipality", "Thuraiyur Municipality", "Thuraiyur Block", "-", "-", "-", "Thuraiyur", "-", "-"),
            ("Trichy", "Thiruchirappalli", "Town Panchayat", "Thuvakudi Town Panchayat", "Thiruverumbur Block", "-", "-", "Thuvakudi", "-", "-", "-"),
            ("Trichy", "Thiruchirappalli", "Village Panchayat", "K. Sathanur Village Panchayat", "Andanallur Block", "K. Sathanur", "-", "-", "-", "-", "-"),

            // 29. Thirunelveli (Tirunelveli)
            ("Tirunelveli", "Thirunelveli", "Corporation", "Tirunelveli City Corporation", "Palayamkottai Block", "-", "Tirunelveli", "-", "-", "-", "-"),
            ("Tirunelveli", "Thirunelveli", "Municipality", "Ambasamudram Municipality", "Ambasamudram Block", "-", "-", "-", "Ambasamudram", "-", "-"),
            ("Tirunelveli", "Thirunelveli", "Municipality", "Vikramasingapuram Municipality", "Cheranmahadevi Block", "-", "-", "-", "Vikramasingapuram", "-", "-"),
            ("Tirunelveli", "Thirunelveli", "Town Panchayat", "Mukkudal Town Panchayat", "Pappakudi Block", "-", "-", "Mukkudal", "-", "-", "-"),
            ("Tirunelveli", "Thirunelveli", "Village Panchayat", "Reddiarpatti Village Panchayat", "Palayamkottai Block", "Reddiarpatti", "-", "-", "-", "-", "-"),

            // 30. Thiruvallur (Chennai)
            ("Chennai", "Thiruvallur", "Corporation", "Avadi City Municipal Corporation", "Poonamallee Block", "-", "Avadi", "-", "-", "-", "-"),
            ("Chennai", "Thiruvallur", "Municipality", "Tiruvallur Municipality", "Tiruvallur Block", "-", "-", "-", "Tiruvallur", "-", "-"),
            ("Chennai", "Thiruvallur", "Municipality", "Poonamallee Municipality", "Poonamallee Block", "-", "-", "-", "Poonamallee", "-", "-"),
            ("Chennai", "Thiruvallur", "Town Panchayat", "Gummidipoondi Town Panchayat", "Gummidipoondi Block", "-", "-", "Gummidipoondi", "-", "-", "-"),
            ("Chennai", "Thiruvallur", "Village Panchayat", "Nemam Village Panchayat", "Poonamallee Block", "Nemam", "-", "-", "-", "-", "-"),

            // 31. Thiruvannamalai (Villupuram)
            ("Villupuram", "Thiruvannamalai", "Municipality", "Tiruvannamalai Municipality", "Tiruvannamalai Block", "-", "-", "-", "Tiruvannamalai", "-", "-"),
            ("Villupuram", "Thiruvannamalai", "Municipality", "Arani Municipality", "Arani Block", "-", "-", "-", "Arani", "-", "-"),
            ("Villupuram", "Thiruvannamalai", "Town Panchayat", "Chengam Town Panchayat", "Chengam Block", "-", "-", "Chengam", "-", "-", "-"),
            ("Villupuram", "Thiruvannamalai", "Town Panchayat", "Polur Town Panchayat", "Polur Block", "-", "-", "Polur", "-", "-", "-"),
            ("Villupuram", "Thiruvannamalai", "Village Panchayat", "Vengikkal Village Panchayat", "Tiruvannamalai Block", "Vengikkal", "-", "-", "-", "-", "-"),

            // 32. Thiruvarur (Thanjavur)
            ("Thanjavur", "Thiruvarur", "Municipality", "Thiruvarur Municipality", "Thiruvarur Block", "-", "-", "-", "Thiruvarur", "-", "-"),
            ("Thanjavur", "Thiruvarur", "Municipality", "Mannargudi Municipality", "Mannargudi Block", "-", "-", "-", "Mannargudi", "-", "-"),
            ("Thanjavur", "Thiruvarur", "Municipality", "Thiruthuraipoondi Municipality", "Thiruthuraipoondi Block", "-", "-", "-", "Thiruthuraipoondi", "-", "-"),
            ("Thanjavur", "Thiruvarur", "Town Panchayat", "Nannilam Town Panchayat", "Nannilam Block", "-", "-", "Nannilam", "-", "-", "-"),
            ("Thanjavur", "Thiruvarur", "Village Panchayat", "Kattur Village Panchayat", "Thiruvarur Block", "Kattur", "-", "-", "-", "-", "-"),

            // 33. Thoothukudi (Tirunelveli)
            ("Tirunelveli", "Thoothukudi", "Corporation", "Thoothukudi City Municipal Corporation", "Thoothukudi Block", "-", "Thoothukudi", "-", "-", "-", "-"),
            ("Tirunelveli", "Thoothukudi", "Municipality", "Kovilpatti Municipality", "Kovilpatti Block", "-", "-", "-", "Kovilpatti", "-", "-"),
            ("Tirunelveli", "Thoothukudi", "Municipality", "Kayalpattinam Municipality", "Tiruchendur Block", "-", "-", "-", "Kayalpattinam", "-", "-"),
            ("Tirunelveli", "Thoothukudi", "Town Panchayat", "Tiruchendur Town Panchayat", "Tiruchendur Block", "-", "-", "Tiruchendur", "-", "-", "-"),
            ("Tirunelveli", "Thoothukudi", "Village Panchayat", "Mullakadu Village Panchayat", "Thoothukudi Block", "Mullakadu", "-", "-", "-", "-", "-"),

            // 34. Tirupathur (Vellore)
            ("Vellore", "Tirupathur", "Municipality", "Tirupathur Municipality", "Tirupathur Block", "-", "-", "-", "Tirupathur", "-", "-"),
            ("Vellore", "Tirupathur", "Municipality", "Vaniyambadi Municipality", "Vaniyambadi Block", "-", "-", "-", "Vaniyambadi", "-", "-"),
            ("Vellore", "Tirupathur", "Municipality", "Ambur Municipality", "Madhanur Block", "-", "-", "-", "Ambur", "-", "-"),
            ("Vellore", "Tirupathur", "Town Panchayat", "Natrampalli Town Panchayat", "Natrampalli Block", "-", "-", "Natrampalli", "-", "-", "-"),
            ("Vellore", "Tirupathur", "Village Panchayat", "Kandili Village Panchayat", "Kandili Block", "Kandili", "-", "-", "-", "-", "-"),

            // 35. Tiruppur (Coimbatore)
            ("Coimbatore", "Tiruppur", "Corporation", "Tiruppur City Municipal Corporation", "Tiruppur North Block", "-", "Tiruppur", "-", "-", "-", "-"),
            ("Coimbatore", "Tiruppur", "Municipality", "Udumalaipettai Municipality", "Udumalaipettai Block", "-", "-", "-", "Udumalaipettai", "-", "-"),
            ("Coimbatore", "Tiruppur", "Municipality", "Dharapuram Municipality", "Dharapuram Block", "-", "-", "-", "Dharapuram", "-", "-"),
            ("Coimbatore", "Tiruppur", "Town Panchayat", "Kangeyam Town Panchayat", "Kangeyam Block", "-", "-", "Kangeyam", "-", "-", "-"),
            ("Coimbatore", "Tiruppur", "Village Panchayat", "Mannarai Village Panchayat", "Tiruppur Block", "Mannarai", "-", "-", "-", "-", "-"),

            // 36. Vellore (Vellore)
            ("Vellore", "Vellore", "Corporation", "Vellore City Municipal Corporation", "Katpadi Block", "-", "Vellore", "-", "-", "-", "-"),
            ("Vellore", "Vellore", "Municipality", "Gudiyattam Municipality", "Gudiyattam Block", "-", "-", "-", "Gudiyattam", "-", "-"),
            ("Vellore", "Vellore", "Municipality", "Pernambut Municipality", "Pernambut Block", "-", "-", "-", "Pernambut", "-", "-"),
            ("Vellore", "Vellore", "Town Panchayat", "Pennathur Town Panchayat", "Vellore Block", "-", "-", "Pennathur", "-", "-", "-"),
            ("Vellore", "Vellore", "Village Panchayat", "Shenbakkam Village Panchayat", "Katpadi Block", "Shenbakkam", "-", "-", "-", "-", "-"),

            // 37. Villupuram (Villupuram)
            ("Villupuram", "Villupuram", "Municipality", "Villupuram Municipality", "Villupuram Block", "-", "-", "-", "Villupuram", "-", "-"),
            ("Villupuram", "Villupuram", "Municipality", "Tindivanam Municipality", "Tindivanam Block", "-", "-", "-", "Tindivanam", "-", "-"),
            ("Villupuram", "Villupuram", "Town Panchayat", "Gingee Town Panchayat", "Gingee Block", "-", "-", "Gingee", "-", "-", "-"),
            ("Villupuram", "Villupuram", "Town Panchayat", "Marakkanam Town Panchayat", "Marakkanam Block", "-", "-", "Marakkanam", "-", "-", "-"),
            ("Villupuram", "Villupuram", "Village Panchayat", "Koliyanur Village Panchayat", "Koliyanur Block", "Koliyanur", "-", "-", "-", "-", "-"),

            // 38. Virudhunagar (Madurai)
            ("Madurai", "Virudhunagar", "Corporation", "Sivakasi City Corporation", "Sivakasi Block", "-", "Sivakasi", "-", "-", "-", "-"),
            ("Madurai", "Virudhunagar", "Municipality", "Virudhunagar Municipality", "Virudhunagar Block", "-", "-", "-", "Virudhunagar", "-", "-"),
            ("Madurai", "Virudhunagar", "Municipality", "Rajapalayam Municipality", "Rajapalayam Block", "-", "-", "-", "Rajapalayam", "-", "-"),
            ("Madurai", "Virudhunagar", "Town Panchayat", "Kariapatti Town Panchayat", "Kariapatti Block", "-", "-", "Kariapatti", "-", "-", "-"),
            ("Madurai", "Virudhunagar", "Village Panchayat", "Rosalpatti Village Panchayat", "Virudhunagar Block", "Rosalpatti", "-", "-", "-", "-", "-")
        };

        var list = new List<LocalBodyMappingVm>();
        int s = 1;
        foreach (var r in rawData)
        {
            list.Add(new LocalBodyMappingVm
            {
                Id = s,
                Sno = s,
                State = "Tamil Nadu",
                Division = r.Item1,
                District = r.Item2,
                LocalBody = r.Item3,
                LocalBodyName = r.Item4,
                Block = r.Item5,
                VillagePanchayat = r.Item6,
                Corporation = r.Item7,
                TownPanchayat = r.Item8,
                Municipality = r.Item9,
                Gcc = r.Item10,
                Cmwssb = r.Item11
            });
            s++;
        }

        var filtered = list.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(district) && district != "All Districts")
            filtered = filtered.Where(x => x.District.Equals(district, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(division) && division != "All Divisions")
            filtered = filtered.Where(x => x.Division.Equals(division, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLowerInvariant();
            filtered = filtered.Where(x =>
                x.District.ToLowerInvariant().Contains(q) ||
                x.Division.ToLowerInvariant().Contains(q) ||
                (x.LocalBody ?? "").ToLowerInvariant().Contains(q) ||
                (x.LocalBodyName ?? "").ToLowerInvariant().Contains(q) ||
                (x.Block ?? "").ToLowerInvariant().Contains(q) ||
                (x.VillagePanchayat ?? "").ToLowerInvariant().Contains(q) ||
                (x.TownPanchayat ?? "").ToLowerInvariant().Contains(q) ||
                (x.Municipality ?? "").ToLowerInvariant().Contains(q) ||
                (x.Corporation ?? "").ToLowerInvariant().Contains(q));
        }

        return filtered.ToList();
    }
}
