using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BAL.Interface;
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
    public async Task<IActionResult> List([FromQuery] string? search) =>
        Ok(await _svc.GetUsersAsync(search));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var user = await _svc.GetUserAsync(id);
        return user is null ? NotFound() : Ok(user);
    }

    /// <summary>Create a user with district assignment + project privileges (Create/Edit/Update/Delete/View).</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SaveUserRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.Email) ||
            string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { message = "Name, email and password are required." });
        if (req.Role == "dm" && string.IsNullOrWhiteSpace(req.DistrictName))
            return BadRequest(new { message = "District Managers must be assigned a district." });
        var user = await _svc.CreateAsync(req);
        return CreatedAtAction(nameof(Get), new { id = user.Id }, user);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] SaveUserRequest req)
    {
        var user = await _svc.UpdateAsync(id, req);
        return user is null ? NotFound() : Ok(user);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id) =>
        await _svc.DeleteAsync(id) ? NoContent() : NotFound();

    /// <summary>Seed Chief Engineer, GM, EE (all 9 divisions) and DM (all 37 districts).</summary>
    [HttpPost("seed-all-roles")]
    [AllowAnonymous]
    public async Task<IActionResult> SeedAllRoles([FromServices] DAL.IDapperRepository db)
    {
        var createdList = new List<object>();

        // 0. System Admin
        // BCrypt embeds its own salt, so password_salt is kept empty for new/reseeded accounts.
        var adminEmail = "admin@tahdco.in";
        var adminHash = Utils.PasswordHasher.Hash("Password123!");
        await db.ExecuteAsync(@"
            UPDATE app_user
            SET password_hash=@Hash, password_salt='', is_active=1
            WHERE email=@Email", new { Email = adminEmail, Hash = adminHash });

        // 0.1 Managing Director (MD)
        var mdEmail = "md@tahdco.in";
        var existingMd = await db.QueryFirstOrDefaultAsync<int?>("SELECT user_id FROM app_user WHERE email=@Email", new { Email = mdEmail });
        if (existingMd is null)
        {
            var hash = Utils.PasswordHasher.Hash("Password123!");
            var id = await db.QuerySingleAsync<int>(@"
                INSERT INTO app_user (full_name, email, password_hash, password_salt, role, scope, division_id, district_id, app_access, is_active)
                VALUES ('Dr. Vijaya Rajan', @Email, @Hash, '', 'md', 'all', NULL, NULL, 'TIPS,THMS,TAMS,Scheme,TELP,OnePortal,TOD,TIME,Patrol360', 1);
                SELECT LAST_INSERT_ID();", new { Email = mdEmail, Hash = hash });

            foreach (var prj in new[] { "TIPS", "THMS", "TAMS", "Scheme", "TELP", "OnePortal", "TOD", "TIME", "Patrol360" })
            {
                await db.ExecuteAsync(@"
                    INSERT INTO user_privilege (user_id, project, can_view, can_create, can_edit, can_update, can_delete)
                    VALUES (@UserId, @Project, 1, 1, 1, 1, 1)", new { UserId = id, Project = prj });
            }
            createdList.Add(new { Role = "Managing Director (MD)", Email = mdEmail, Name = "Dr. Vijaya Rajan", Scope = "all" });
        }

        // 0.2 Secretary
        var secEmail = "sec@tahdco.in";
        var existingSec = await db.QueryFirstOrDefaultAsync<int?>("SELECT user_id FROM app_user WHERE email=@Email", new { Email = secEmail });
        if (existingSec is null)
        {
            var hash = Utils.PasswordHasher.Hash("Password123!");
            var id = await db.QuerySingleAsync<int>(@"
                INSERT INTO app_user (full_name, email, password_hash, password_salt, role, scope, division_id, district_id, app_access, is_active)
                VALUES ('Sundaram K. IAS', @Email, @Hash, '', 'secretary', 'all', NULL, NULL, 'TIPS,THMS,TAMS,Scheme,TELP,OnePortal,TOD,TIME,Patrol360', 1);
                SELECT LAST_INSERT_ID();", new { Email = secEmail, Hash = hash });

            foreach (var prj in new[] { "TIPS", "THMS", "TAMS", "Scheme", "TELP", "OnePortal", "TOD", "TIME", "Patrol360" })
            {
                await db.ExecuteAsync(@"
                    INSERT INTO user_privilege (user_id, project, can_view, can_create, can_edit, can_update, can_delete)
                    VALUES (@UserId, @Project, 1, 1, 1, 1, 1)", new { UserId = id, Project = prj });
            }
            createdList.Add(new { Role = "Secretary", Email = secEmail, Name = "Sundaram K. IAS", Scope = "all" });
        }

        // 1. Chief Engineer
        var ceEmail = "ce@tahdco.in";
        var existingCe = await db.QueryFirstOrDefaultAsync<int?>("SELECT user_id FROM app_user WHERE email=@Email", new { Email = ceEmail });
        if (existingCe is null)
        {
            var hash = Utils.PasswordHasher.Hash("Password123!");
            var id = await db.QuerySingleAsync<int>(@"
                INSERT INTO app_user (full_name, email, password_hash, password_salt, role, scope, division_id, district_id, app_access, is_active)
                VALUES ('Er. K. Swaminathan', @Email, @Hash, '', 'Chief Engineer', 'all', NULL, NULL, 'TIPS,TIME,Patrol360,THMS', 1);
                SELECT LAST_INSERT_ID();", new { Email = ceEmail, Hash = hash });

            foreach (var prj in new[] { "TIPS", "TIME", "Patrol360", "THMS" })
            {
                await db.ExecuteAsync(@"
                    INSERT INTO user_privilege (user_id, project, can_view, can_create, can_edit, can_update, can_delete)
                    VALUES (@UserId, @Project, 1, 1, 1, 1, 1)", new { UserId = id, Project = prj });
            }
            createdList.Add(new { Role = "Chief Engineer", Email = ceEmail, Name = "Er. K. Swaminathan", Scope = "all" });
        }

        // 2. GM
        var gmEmail = "gm@tahdco.in";
        var existingGm = await db.QueryFirstOrDefaultAsync<int?>("SELECT user_id FROM app_user WHERE email=@Email", new { Email = gmEmail });
        if (existingGm is null)
        {
            var hash = Utils.PasswordHasher.Hash("Password123!");
            var id = await db.QuerySingleAsync<int>(@"
                INSERT INTO app_user (full_name, email, password_hash, password_salt, role, scope, division_id, district_id, app_access, is_active)
                VALUES ('Rajesh Kumar', @Email, @Hash, '', 'gm', 'all', NULL, NULL, 'Scheme,TELP,TAMS,TOD', 1);
                SELECT LAST_INSERT_ID();", new { Email = gmEmail, Hash = hash });

            foreach (var prj in new[] { "Scheme", "TELP", "TAMS", "TOD" })
            {
                await db.ExecuteAsync(@"
                    INSERT INTO user_privilege (user_id, project, can_view, can_create, can_edit, can_update, can_delete)
                    VALUES (@UserId, @Project, 1, 1, 1, 1, 1)", new { UserId = id, Project = prj });
            }
            createdList.Add(new { Role = "General Manager", Email = gmEmail, Name = "Rajesh Kumar", Scope = "all" });
        }

        // 3. Executive Engineers (All Divisions)
        var divisions = (await db.QueryAsync<dynamic>("SELECT division_id AS DivisionId, name AS Name FROM division")).ToList();
        foreach (var div in divisions)
        {
            int divId = (int)div.DivisionId;
            string divName = (string)div.Name;
            string cleanDiv = divName.ToLower().Replace(" ", "").Replace("-", "");
            string eeEmail = $"ee_{cleanDiv}@tahdco.in";

            var existingEe = await db.QueryFirstOrDefaultAsync<int?>("SELECT user_id FROM app_user WHERE email=@Email", new { Email = eeEmail });
            if (existingEe is null)
            {
                var hash = Utils.PasswordHasher.Hash("Password123!");
                var id = await db.QuerySingleAsync<int>(@"
                    INSERT INTO app_user (full_name, email, password_hash, password_salt, role, scope, division_id, district_id, app_access, is_active)
                    VALUES (@FullName, @Email, @Hash, '', 'ee', 'division', @DivisionId, NULL, 'TIPS,TIME,Patrol360,THMS', 1);
                    SELECT LAST_INSERT_ID();", new { FullName = $"EE - {divName} Division", Email = eeEmail, Hash = hash, DivisionId = divId });

                foreach (var prj in new[] { "TIPS", "TIME", "Patrol360", "THMS" })
                {
                    await db.ExecuteAsync(@"
                        INSERT INTO user_privilege (user_id, project, can_view, can_create, can_edit, can_update, can_delete)
                        VALUES (@UserId, @Project, 1, 1, 1, 1, 1)", new { UserId = id, Project = prj });
                }
                createdList.Add(new { Role = "Executive Engineer", Email = eeEmail, Name = $"EE - {divName} Division", Division = divName });
            }
        }

        // 4. District Managers (All Districts)
        var districts = (await db.QueryAsync<dynamic>("SELECT district_id AS DistrictId, division_id AS DivisionId, name AS Name FROM district")).ToList();
        foreach (var dist in districts)
        {
            int distId = (int)dist.DistrictId;
            int divId = (int)dist.DivisionId;
            string distName = (string)dist.Name;
            string cleanDist = distName.ToLower().Replace(" ", "").Replace("-", "").Replace("'", "");
            string dmEmail = $"dm_{cleanDist}@tahdco.in";

            var existingDm = await db.QueryFirstOrDefaultAsync<int?>("SELECT user_id FROM app_user WHERE email=@Email", new { Email = dmEmail });
            if (existingDm is null)
            {
                var hash = Utils.PasswordHasher.Hash("Password123!");
                var id = await db.QuerySingleAsync<int>(@"
                    INSERT INTO app_user (full_name, email, password_hash, password_salt, role, scope, division_id, district_id, app_access, is_active)
                    VALUES (@FullName, @Email, @Hash, '', 'dm', 'district', @DivisionId, @DistrictId, 'TIPS,THMS,TAMS,Scheme,TELP,OnePortal,TOD,TIME,Patrol360', 1);
                    SELECT LAST_INSERT_ID();", new { FullName = $"DM - {distName}", Email = dmEmail, Hash = hash, DivisionId = divId, DistrictId = distId });

                foreach (var prj in new[] { "TIPS", "THMS", "TAMS", "Scheme", "TELP", "OnePortal", "TOD", "TIME", "Patrol360" })
                {
                    await db.ExecuteAsync(@"
                        INSERT INTO user_privilege (user_id, project, can_view, can_create, can_edit, can_update, can_delete)
                        VALUES (@UserId, @Project, 1, 1, 1, 1, 1)", new { UserId = id, Project = prj });
                }
                createdList.Add(new { Role = "District Manager", Email = dmEmail, Name = $"DM - {distName}", District = distName });
            }
        }

        return Ok(new { message = $"Seeding completed. {createdList.Count} new users created.", defaultPassword = "Password123!", totalCreated = createdList.Count, users = createdList });
    }
}
