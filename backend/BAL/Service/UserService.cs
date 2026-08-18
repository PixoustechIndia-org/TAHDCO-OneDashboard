using AutoMapper;
using BAL.Interface;
using DAL;
using Model.ViewModel;
using Utils;

namespace BAL.Service;

public class UserService : IUserService
{
    private const string BaseSql = @"
        SELECT u.user_id AS UserId, u.full_name AS FullName, u.email AS Email,
               u.password_hash AS PasswordHash, u.password_salt AS PasswordSalt,
               u.role AS Role, u.scope AS Scope,
               u.division_id AS DivisionId, dv.name AS DivisionName,
               u.district_id AS DistrictId, d.name AS DistrictName,
               u.app_access AS AppAccess, u.is_active AS IsActive, u.last_login AS LastLogin
        FROM app_user u
        LEFT JOIN division dv ON dv.division_id = u.division_id
        LEFT JOIN district d  ON d.district_id  = u.district_id";

    private readonly IDapperRepository _db;
    private readonly IMapper _mapper;
    public UserService(IDapperRepository db, IMapper mapper) { _db = db; _mapper = mapper; }

    public async Task<IEnumerable<UserVm>> GetUsersAsync(string? search)
    {
        var sql = BaseSql + (string.IsNullOrWhiteSpace(search)
            ? " ORDER BY u.user_id"
            : " WHERE u.full_name LIKE @Q OR u.email LIKE @Q ORDER BY u.user_id");
        var rows = (await _db.QueryAsync<AppUserRow>(sql, new { Q = $"%{search}%" })).ToList();
        var privs = (await _db.QueryAsync<PrivilegeRow>(@"
            SELECT user_id AS UserId, project AS Project,
                   can_view AS CanView, can_create AS CanCreate, can_edit AS CanEdit,
                   can_update AS CanUpdate, can_delete AS CanDelete
            FROM user_privilege")).ToLookup(p => p.UserId);
        return rows.Select(r => WithPrivs(_mapper.Map<UserVm>(r), privs[r.UserId]));
    }

    public async Task<UserVm?> GetUserAsync(int id)
    {
        var row = await _db.QueryFirstOrDefaultAsync<AppUserRow>(BaseSql + " WHERE u.user_id = @Id", new { Id = id });
        if (row is null) return null;
        var privs = await _db.QueryAsync<PrivilegeRow>(@"
            SELECT user_id AS UserId, project AS Project,
                   can_view AS CanView, can_create AS CanCreate, can_edit AS CanEdit,
                   can_update AS CanUpdate, can_delete AS CanDelete
            FROM user_privilege WHERE user_id = @Id", new { Id = id });
        return WithPrivs(_mapper.Map<UserVm>(row), privs);
    }

    public async Task<UserVm> CreateAsync(SaveUserRequest req)
    {
        var hash = PasswordHasher.Hash(req.Password ?? Guid.NewGuid().ToString("N"));
        var scope = req.Role == "dm" ? "district" : req.Role == "ee" ? "division" : "all";
        var access = string.Join(',', req.Privileges.Where(p => p.Value.View).Select(p => p.Key));

        // BCrypt embeds its own salt, so password_salt is kept empty for new/migrated accounts.
        var id = await _db.QuerySingleAsync<int>(@"
            INSERT INTO app_user (full_name,email,password_hash,password_salt,role,scope,
                                  division_id,district_id,app_access,is_active)
            VALUES (@Name,@Email,@Hash,'',@Role,@Scope,
                    (SELECT division_id FROM division WHERE name=@DivisionName),
                    (SELECT district_id FROM district WHERE name=@DistrictName),
                    @Access,@IsActive);
            SELECT LAST_INSERT_ID();",
            new { req.Name, req.Email, Hash = hash, req.Role, Scope = scope,
                  req.DivisionName, req.DistrictName, Access = access, req.IsActive });

        await SavePrivilegesAsync(id, req.Privileges);
        return (await GetUserAsync(id))!;
    }

    public async Task<UserVm?> UpdateAsync(int id, SaveUserRequest req)
    {
        if (await GetUserAsync(id) is null) return null;
        var scope = req.Role == "dm" ? "district" : req.Role == "ee" ? "division" : "all";
        var access = string.Join(',', req.Privileges.Where(p => p.Value.View).Select(p => p.Key));

        await _db.ExecuteAsync(@"
            UPDATE app_user SET full_name=@Name, email=@Email, role=@Role, scope=@Scope,
                division_id=(SELECT division_id FROM division WHERE name=@DivisionName),
                district_id=(SELECT district_id FROM district WHERE name=@DistrictName),
                app_access=@Access, is_active=@IsActive
            WHERE user_id=@Id",
            new { Id = id, req.Name, req.Email, req.Role, Scope = scope,
                  req.DivisionName, req.DistrictName, Access = access, req.IsActive });

        if (!string.IsNullOrWhiteSpace(req.Password))
        {
            await _db.ExecuteAsync(
                "UPDATE app_user SET password_hash=@H, password_salt='' WHERE user_id=@Id",
                new { Id = id, H = PasswordHasher.Hash(req.Password) });
        }
        await SavePrivilegesAsync(id, req.Privileges);
        return await GetUserAsync(id);
    }

    public async Task<bool> DeleteAsync(int id) =>
        await _db.ExecuteAsync("DELETE FROM app_user WHERE user_id=@Id", new { Id = id }) > 0;

    private async Task SavePrivilegesAsync(int userId, Dictionary<string, ProjectPrivilege> privs)
    {
        await _db.ExecuteAsync("DELETE FROM user_privilege WHERE user_id=@Id", new { Id = userId });
        foreach (var (project, p) in privs.Where(x =>
                     x.Value.View || x.Value.Create || x.Value.Edit || x.Value.Update || x.Value.Delete))
        {
            await _db.ExecuteAsync(@"
                INSERT INTO user_privilege (user_id,project,can_view,can_create,can_edit,can_update,can_delete)
                VALUES (@UserId,@Project,@V,@C,@E,@U,@D)",
                new { UserId = userId, Project = project,
                      V = p.View, C = p.Create, E = p.Edit, U = p.Update, D = p.Delete });
        }
    }

    private static UserVm WithPrivs(UserVm vm, IEnumerable<PrivilegeRow> privs)
    {
        foreach (var p in privs)
            vm.Privileges[p.Project] = new ProjectPrivilege
            { View = p.CanView, Create = p.CanCreate, Edit = p.CanEdit, Update = p.CanUpdate, Delete = p.CanDelete };
        return vm;
    }
}
