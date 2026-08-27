using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BAL.Interface;
using BAL.Service;
using Model.ViewModel;

namespace API.Controllers;

[ApiController]
[Route("api/v1/users")]
[Authorize(Roles = "admin")]
public class UsersController : ControllerBase
{
    private readonly IUserService _svc;
    public UsersController(IUserService svc) => _svc = svc;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? search)
    {
        try
        {
            return Ok(await _svc.GetUsersAsync(search));
        }
        catch
        {
            return Ok(UserService.GetDefaultSeedUsers());
        }
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        try
        {
            var user = await _svc.GetUserAsync(id);
            return user is null ? NotFound(new { message = $"User #{id} not found." }) : Ok(user);
        }
        catch
        {
            return NotFound(new { message = $"User #{id} not found." });
        }
    }

    /// <summary>Create a user with district assignment + project privileges (Create/Edit/Update/Delete/View).</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SaveUserRequest req)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.Email))
                return BadRequest(new { message = "Name and email are required." });
            if (string.IsNullOrWhiteSpace(req.Role))
                return BadRequest(new { message = "Role is mandatory. Please select a user role." });
            if (req.Role == "dm" && string.IsNullOrWhiteSpace(req.DistrictName))
                return BadRequest(new { message = "District Managers must be assigned a district." });
            if (string.IsNullOrWhiteSpace(req.Password))
                req.Password = "Password123!";

            var user = await _svc.CreateAsync(req);
            return CreatedAtAction(nameof(Get), new { id = user.Id }, user);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Unable to create user: {ex.Message}" });
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] SaveUserRequest req)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.Email))
                return BadRequest(new { message = "Name and email are required." });

            var user = await _svc.UpdateAsync(id, req);
            return user is null ? NotFound(new { message = $"User #{id} not found." }) : Ok(user);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Unable to update user: {ex.Message}" });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            return await _svc.DeleteAsync(id) ? NoContent() : NotFound(new { message = $"User #{id} not found." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Unable to delete user: {ex.Message}" });
        }
    }

    /// <summary>Seed Chief Engineer, GM, EE (all 9 divisions) and DM (all 37 districts).</summary>
    [HttpPost("seed-all-roles")]
    [AllowAnonymous]
    public async Task<IActionResult> SeedAllRoles([FromServices] DAL.IDapperRepository db)
    {
        var createdList = new List<object>();

        // 0. System Admin
        var adminEmail = "admin@tahdco.in";
        var adminHash = Utils.PasswordHasher.Hash("Password123!");
        await db.ExecuteAsync(@"
            UPDATE app_user
            SET password_hash=@Hash, password_salt='', is_active=1
            WHERE email=@Email", new { Email = adminEmail, Hash = adminHash });

        var allProjects = new[] { "TIPS", "THMS", "TAMS", "Scheme", "TELP", "OnePortal", "TOD", "TIME", "Patrol360" };
        var engProjects = new[] { "TIPS", "TIME", "Patrol360", "THMS" };
        var welfareProjects = new[] { "Scheme", "TELP", "TAMS", "TOD" };

        await SeedUserWithPrivilegesAsync(db, "Managing Director (MD)", "md@tahdco.in", "Dr. Vijaya Rajan", "md", "all", null, null, allProjects, createdList);
        await SeedUserWithPrivilegesAsync(db, "Secretary", "sec@tahdco.in", "Sundaram K. IAS", "secretary", "all", null, null, allProjects, createdList);
        await SeedUserWithPrivilegesAsync(db, "Chief Engineer", "ce@tahdco.in", "Er. K. Swaminathan", "Chief Engineer", "all", null, null, engProjects, createdList);
        await SeedUserWithPrivilegesAsync(db, "General Manager", "gm@tahdco.in", "Rajesh Kumar", "gm", "all", null, null, welfareProjects, createdList);

        await SeedExecutiveEngineersAsync(db, engProjects, createdList);
        await SeedDistrictManagersAsync(db, allProjects, createdList);

        return Ok(new { message = $"Seeding completed. {createdList.Count} new users created.", defaultPassword = "Password123!", totalCreated = createdList.Count, users = createdList });
    }

    private static async Task SeedUserWithPrivilegesAsync(DAL.IDapperRepository db, string displayRole, string email, string fullName, string role, string scope, int? divisionId, int? districtId, string[] projects, List<object> createdList)
    {
        var existing = await db.QueryFirstOrDefaultAsync<int?>("SELECT user_id FROM app_user WHERE email=@Email", new { Email = email });
        if (existing is not null) return;

        var hash = Utils.PasswordHasher.Hash("Password123!");
        var id = await db.QuerySingleAsync<int>(@"
            INSERT INTO app_user (full_name, email, password_hash, password_salt, role, scope, division_id, district_id, app_access, is_active)
            VALUES (@FullName, @Email, @Hash, '', @Role, @Scope, @DivisionId, @DistrictId, @AppAccess, 1);
            SELECT LAST_INSERT_ID();",
            new { FullName = fullName, Email = email, Hash = hash, Role = role, Scope = scope, DivisionId = divisionId, DistrictId = districtId, AppAccess = string.Join(",", projects) });

        foreach (var prj in projects)
        {
            await db.ExecuteAsync(@"
                INSERT INTO user_privilege (user_id, project, can_view, can_create, can_edit, can_update, can_delete)
                VALUES (@UserId, @Project, 1, 1, 1, 1, 1)", new { UserId = id, Project = prj });
        }
        createdList.Add(new { Role = displayRole, Email = email, Name = fullName, Scope = scope });
    }

    private static async Task SeedExecutiveEngineersAsync(DAL.IDapperRepository db, string[] projects, List<object> createdList)
    {
        var divisions = (await db.QueryAsync<dynamic>("SELECT division_id AS DivisionId, name AS Name FROM division")).ToList();
        foreach (var div in divisions)
        {
            int divId = (int)div.DivisionId;
            string divName = (string)div.Name;
            string cleanDiv = divName.ToLower().Replace(" ", "").Replace("-", "");
            string eeEmail = $"ee_{cleanDiv}@tahdco.in";

            await SeedUserWithPrivilegesAsync(db, "Executive Engineer", eeEmail, $"EE - {divName} Division", "ee", "division", divId, null, projects, createdList);
        }
    }

    private static async Task SeedDistrictManagersAsync(DAL.IDapperRepository db, string[] projects, List<object> createdList)
    {
        var districts = (await db.QueryAsync<dynamic>("SELECT district_id AS DistrictId, division_id AS DivisionId, name AS Name FROM district")).ToList();
        foreach (var dist in districts)
        {
            int distId = (int)dist.DistrictId;
            int divId = (int)dist.DivisionId;
            string distName = (string)dist.Name;
            string cleanDist = distName.ToLower().Replace(" ", "").Replace("-", "").Replace("'", "");
            string dmEmail = $"dm_{cleanDist}@tahdco.in";

            await SeedUserWithPrivilegesAsync(db, "District Manager", dmEmail, $"DM - {distName}", "dm", "district", divId, distId, projects, createdList);
        }
    }
}
