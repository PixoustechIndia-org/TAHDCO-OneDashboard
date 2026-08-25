using System.Collections.Concurrent;
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
    private static readonly ConcurrentDictionary<int, UserVm> _inMemoryUsers = new();
    private static int _nextId = 100;

    public UserService(IDapperRepository db, IMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    public async Task<IEnumerable<UserVm>> GetUsersAsync(string? search)
    {
        List<UserVm> results = new();
        try
        {
            await EnsureSchemaExistsAsync();
            var sql = BaseSql + (string.IsNullOrWhiteSpace(search)
                ? " ORDER BY u.user_id"
                : " WHERE u.full_name LIKE @Q OR u.email LIKE @Q ORDER BY u.user_id");
            var rows = (await _db.QueryAsync<AppUserRow>(sql, new { Q = $"%{search}%" })).ToList();

            ILookup<int, PrivilegeRow>? privs = null;
            try
            {
                privs = (await _db.QueryAsync<PrivilegeRow>(@"
                    SELECT user_id AS UserId, project AS Project,
                           can_view AS CanView, can_create AS CanCreate, can_edit AS CanEdit,
                           can_update AS CanUpdate, can_delete AS CanDelete
                    FROM user_privilege")).ToLookup(p => p.UserId);
            }
            catch { }

            foreach (var r in rows)
            {
                var vm = _mapper.Map<UserVm>(r);
                if (privs != null && privs.Contains(r.UserId))
                {
                    vm = WithPrivs(vm, privs[r.UserId]);
                }
                else
                {
                    EnsureDefaultPrivileges(vm);
                }
                results.Add(vm);
                _inMemoryUsers[vm.Id] = vm;
            }
        }
        catch
        {
            // Database offline/table missing: return in-memory and seed users
        }

        if (results.Count == 0)
        {
            results = GetDefaultSeedUsers();
            foreach (var u in results)
            {
                _inMemoryUsers[u.Id] = u;
            }
        }

        // Include any recently added in-memory users not in DB
        foreach (var kvp in _inMemoryUsers)
        {
            if (!results.Any(x => x.Id == kvp.Key || x.Email.Equals(kvp.Value.Email, StringComparison.OrdinalIgnoreCase)))
            {
                results.Add(kvp.Value);
            }
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLowerInvariant();
            results = results.Where(u =>
                u.Name.ToLower().Contains(q) ||
                u.Email.ToLower().Contains(q) ||
                u.Role.ToLower().Contains(q) ||
                (u.DistrictName ?? "").ToLower().Contains(q) ||
                (u.DivisionName ?? "").ToLower().Contains(q)).ToList();
        }

        return results.OrderBy(u => u.Id);
    }

    public async Task<UserVm?> GetUserAsync(int id)
    {
        try
        {
            await EnsureSchemaExistsAsync();
            var row = await _db.QueryFirstOrDefaultAsync<AppUserRow>(BaseSql + " WHERE u.user_id = @Id", new { Id = id });
            if (row != null)
            {
                var privs = await _db.QueryAsync<PrivilegeRow>(@"
                    SELECT user_id AS UserId, project AS Project,
                           can_view AS CanView, can_create AS CanCreate, can_edit AS CanEdit,
                           can_update AS CanUpdate, can_delete AS CanDelete
                    FROM user_privilege WHERE user_id = @Id", new { Id = id });
                var vm = WithPrivs(_mapper.Map<UserVm>(row), privs);
                _inMemoryUsers[id] = vm;
                return vm;
            }
        }
        catch { }

        if (_inMemoryUsers.TryGetValue(id, out var cached))
            return cached;

        return GetDefaultSeedUsers().FirstOrDefault(u => u.Id == id);
    }

    public async Task<UserVm> CreateAsync(SaveUserRequest req)
    {
        var hash = PasswordHasher.Hash(req.Password ?? "Password123!");
        var scope = req.Role == "dm" ? "district" : req.Role == "ee" ? "division" : "all";
        var access = string.Join(',', req.Privileges.Where(p => p.Value.View).Select(p => p.Key));
        if (string.IsNullOrWhiteSpace(access)) access = "ALL";

        int id = Interlocked.Increment(ref _nextId);

        try
        {
            await EnsureSchemaExistsAsync();
            var dbId = await _db.QuerySingleAsync<int>(@"
                INSERT INTO app_user (full_name, email, password_hash, password_salt, role, scope,
                                      division_id, district_id, app_access, is_active, last_login)
                VALUES (@Name, @Email, @Hash, '', @Role, @Scope,
                        (SELECT division_id FROM division WHERE name=@DivisionName LIMIT 1),
                        (SELECT district_id FROM district WHERE name=@DistrictName LIMIT 1),
                        @Access, @IsActive, NOW());
                SELECT LAST_INSERT_ID();",
                new { req.Name, req.Email, Hash = hash, req.Role, Scope = scope,
                      req.DivisionName, req.DistrictName, Access = access, req.IsActive });

            if (dbId > 0) id = dbId;
            await SavePrivilegesAsync(id, req.Privileges);
        }
        catch
        {
            // Database write error - keep in memory
        }

        var created = new UserVm
        {
            Id = id,
            Name = req.Name,
            Email = req.Email,
            Role = req.Role,
            Scope = scope,
            DivisionName = req.DivisionName,
            DistrictName = req.DistrictName,
            AppAccess = access.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries),
            IsActive = req.IsActive,
            Privileges = req.Privileges,
            LastLogin = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
        };

        if (created.Privileges.Count == 0)
            EnsureDefaultPrivileges(created);

        _inMemoryUsers[id] = created;
        return created;
    }

    public async Task<UserVm?> UpdateAsync(int id, SaveUserRequest req)
    {
        var scope = req.Role == "dm" ? "district" : req.Role == "ee" ? "division" : "all";
        var access = string.Join(',', req.Privileges.Where(p => p.Value.View).Select(p => p.Key));
        if (string.IsNullOrWhiteSpace(access)) access = "ALL";

        try
        {
            await EnsureSchemaExistsAsync();
            await _db.ExecuteAsync(@"
                UPDATE app_user SET full_name=@Name, email=@Email, role=@Role, scope=@Scope,
                    division_id=(SELECT division_id FROM division WHERE name=@DivisionName LIMIT 1),
                    district_id=(SELECT district_id FROM district WHERE name=@DistrictName LIMIT 1),
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
        }
        catch { }

        var updated = new UserVm
        {
            Id = id,
            Name = req.Name,
            Email = req.Email,
            Role = req.Role,
            Scope = scope,
            DivisionName = req.DivisionName,
            DistrictName = req.DistrictName,
            AppAccess = access.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries),
            IsActive = req.IsActive,
            Privileges = req.Privileges,
            LastLogin = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
        };

        if (updated.Privileges.Count == 0)
            EnsureDefaultPrivileges(updated);

        _inMemoryUsers[id] = updated;
        return updated;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        _inMemoryUsers.TryRemove(id, out _);
        try
        {
            await EnsureSchemaExistsAsync();
            await _db.ExecuteAsync("DELETE FROM user_privilege WHERE user_id=@Id", new { Id = id });
            await _db.ExecuteAsync("DELETE FROM app_user WHERE user_id=@Id", new { Id = id });
        }
        catch { }
        return true;
    }

    private async Task SavePrivilegesAsync(int userId, Dictionary<string, ProjectPrivilege> privs)
    {
        try
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
        catch { }
    }

    private async Task EnsureSchemaExistsAsync()
    {
        try
        {
            await _db.ExecuteAsync(@"
                CREATE TABLE IF NOT EXISTS app_user (
                    user_id INT AUTO_INCREMENT PRIMARY KEY,
                    full_name VARCHAR(150) NOT NULL,
                    email VARCHAR(150) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    password_salt VARCHAR(255) DEFAULT '',
                    role VARCHAR(50) NOT NULL,
                    scope VARCHAR(50) DEFAULT 'all',
                    division_id INT NULL,
                    district_id INT NULL,
                    app_access VARCHAR(255) DEFAULT 'ALL',
                    is_active TINYINT(1) DEFAULT 1,
                    last_login DATETIME NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

                CREATE TABLE IF NOT EXISTS user_privilege (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    project VARCHAR(50) NOT NULL,
                    can_view TINYINT(1) DEFAULT 1,
                    can_create TINYINT(1) DEFAULT 1,
                    can_edit TINYINT(1) DEFAULT 1,
                    can_update TINYINT(1) DEFAULT 1,
                    can_delete TINYINT(1) DEFAULT 1
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        }
        catch { }
    }

    private static void EnsureDefaultPrivileges(UserVm vm)
    {
        var projects = new[] { "TIPS", "THMS", "TAMS", "Scheme", "TELP", "OnePortal", "TOD", "TIME", "Patrol360" };
        foreach (var p in projects)
            vm.Privileges[p] = new ProjectPrivilege { View = true, Create = true, Edit = true, Update = true, Delete = true };
    }

    private static UserVm WithPrivs(UserVm vm, IEnumerable<PrivilegeRow> privs)
    {
        foreach (var p in privs)
            vm.Privileges[p.Project] = new ProjectPrivilege
            { View = p.CanView, Create = p.CanCreate, Edit = p.CanEdit, Update = p.CanUpdate, Delete = p.CanDelete };
        if (vm.Privileges.Count == 0)
            EnsureDefaultPrivileges(vm);
        return vm;
    }

    public static List<UserVm> GetDefaultSeedUsers()
    {
        var users = new List<UserVm>
        {
            new() { Id = 1, Name = "Application Admin (HQ)", Email = "admin@tahdco.in", Role = "admin", Scope = "all", IsActive = true, AppAccess = new[] { "ENG", "WELFARE", "TNCWWB", "TIPS", "TIME", "THMS", "TAMS", "SCHEME", "TELP", "TOD", "ONEPORTAL", "PATROL360" } },
            new() { Id = 2, Name = "Dr. Vijaya Rajan", Email = "md@tahdco.in", Role = "md", Scope = "all", IsActive = true, AppAccess = new[] { "ENG", "WELFARE", "TNCWWB", "TIPS", "TIME", "THMS", "TAMS", "SCHEME", "TELP", "TOD", "ONEPORTAL", "PATROL360" } },
            new() { Id = 3, Name = "Sundaram K. IAS", Email = "sec@tahdco.in", Role = "secretary", Scope = "all", IsActive = true, AppAccess = new[] { "ENG", "WELFARE", "TNCWWB", "TIPS", "TIME", "THMS", "TAMS", "SCHEME", "TELP", "TOD", "ONEPORTAL", "PATROL360" } },
            new() { Id = 4, Name = "Er. K. Swaminathan", Email = "ce@tahdco.in", Role = "ce", Scope = "all", IsActive = true, AppAccess = new[] { "ENG", "TIPS", "TIME", "PATROL360", "THMS" } },
            new() { Id = 5, Name = "Rajesh Kumar", Email = "gm@tahdco.in", Role = "gm", Scope = "all", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD" } },
            new() { Id = 6, Name = "EE - Chennai Division", Email = "ee_chennai@tahdco.in", Role = "ee", Scope = "division", DivisionName = "Chennai", IsActive = true, AppAccess = new[] { "ENG", "TIPS", "TIME", "PATROL360", "THMS" } },
            new() { Id = 7, Name = "EE - Coimbatore Division", Email = "ee_coimbatore@tahdco.in", Role = "ee", Scope = "division", DivisionName = "Coimbatore", IsActive = true, AppAccess = new[] { "ENG", "TIPS", "TIME", "PATROL360", "THMS" } },
            new() { Id = 8, Name = "EE - Madurai Division", Email = "ee_madurai@tahdco.in", Role = "ee", Scope = "division", DivisionName = "Madurai", IsActive = true, AppAccess = new[] { "ENG", "TIPS", "TIME", "PATROL360", "THMS" } },
            new() { Id = 9, Name = "EE - Salem Division", Email = "ee_salem@tahdco.in", Role = "ee", Scope = "division", DivisionName = "Salem", IsActive = true, AppAccess = new[] { "ENG", "TIPS", "TIME", "PATROL360", "THMS" } },
            new() { Id = 10, Name = "EE - Thanjavur Division", Email = "ee_thanjavur@tahdco.in", Role = "ee", Scope = "division", DivisionName = "Thanjavur", IsActive = true, AppAccess = new[] { "ENG", "TIPS", "TIME", "PATROL360", "THMS" } },
            new() { Id = 11, Name = "EE - Trichy Division", Email = "ee_trichy@tahdco.in", Role = "ee", Scope = "division", DivisionName = "Trichy", IsActive = true, AppAccess = new[] { "ENG", "TIPS", "TIME", "PATROL360", "THMS" } },
            new() { Id = 12, Name = "EE - Vellore Division", Email = "ee_vellore@tahdco.in", Role = "ee", Scope = "division", DivisionName = "Vellore", IsActive = true, AppAccess = new[] { "ENG", "TIPS", "TIME", "PATROL360", "THMS" } },
            new() { Id = 13, Name = "EE - Villupuram Division", Email = "ee_villupuram@tahdco.in", Role = "ee", Scope = "division", DivisionName = "Villupuram", IsActive = true, AppAccess = new[] { "ENG", "TIPS", "TIME", "PATROL360", "THMS" } },
            new() { Id = 14, Name = "EE - Tirunelveli Division", Email = "ee_tirunelveli@tahdco.in", Role = "ee", Scope = "division", DivisionName = "Thirunelveli", IsActive = true, AppAccess = new[] { "ENG", "TIPS", "TIME", "PATROL360", "THMS" } },
            new() { Id = 20, Name = "DM - Chengalpattu", Email = "dm_chengalpattu@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Chennai", DistrictName = "Chengalpattu", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 21, Name = "DM - Kancheepuram", Email = "dm_kancheepuram@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Chennai", DistrictName = "Kancheepuram", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 22, Name = "DM - Tiruvallur", Email = "dm_tiruvallur@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Chennai", DistrictName = "Tiruvallur", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 23, Name = "DM - Ranipet", Email = "dm_ranipet@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Chennai", DistrictName = "Ranipet", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 24, Name = "DM - Coimbatore", Email = "dm_coimbatore@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Coimbatore", DistrictName = "Coimbatore", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 25, Name = "DM - Erode", Email = "dm_erode@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Coimbatore", DistrictName = "Erode", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 26, Name = "DM - Tiruppur", Email = "dm_tiruppur@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Coimbatore", DistrictName = "Tiruppur", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 27, Name = "DM - The Nilgiris", Email = "dm_thenilgiris@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Coimbatore", DistrictName = "The Nilgiris", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 28, Name = "DM - Madurai", Email = "dm_madurai@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Madurai", DistrictName = "Madurai", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 29, Name = "DM - Dindigul", Email = "dm_dindigul@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Madurai", DistrictName = "Dindigul", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 30, Name = "DM - Theni", Email = "dm_theni@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Madurai", DistrictName = "Theni", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 31, Name = "DM - Sivagangai", Email = "dm_sivagangai@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Madurai", DistrictName = "Sivagangai", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 32, Name = "DM - Ramanathapuram", Email = "dm_ramanathapuram@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Madurai", DistrictName = "Ramanathapuram", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 33, Name = "DM - Salem", Email = "dm_salem@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Salem", DistrictName = "Salem", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 34, Name = "DM - Dharmapuri", Email = "dm_dharmapuri@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Salem", DistrictName = "Dharmapuri", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 35, Name = "DM - Krishnagiri", Email = "dm_krishnagiri@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Salem", DistrictName = "Krishnagiri", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 36, Name = "DM - Namakkal", Email = "dm_namakkal@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Salem", DistrictName = "Namakkal", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 37, Name = "DM - Karur", Email = "dm_karur@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Salem", DistrictName = "Karur", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 38, Name = "DM - Thanjavur", Email = "dm_thanjavur@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Thanjavur", DistrictName = "Thanjavur", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 39, Name = "DM - Thiruvarur", Email = "dm_thiruvarur@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Thanjavur", DistrictName = "Thiruvarur", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 40, Name = "DM - Nagapattinam", Email = "dm_nagapattinam@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Thanjavur", DistrictName = "Nagapattinam", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 41, Name = "DM - Mayiladuthurai", Email = "dm_mayiladuthurai@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Thanjavur", DistrictName = "Mayiladuthurai", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 42, Name = "DM - Ariyalur", Email = "dm_ariyalur@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Trichy", DistrictName = "Ariyalur", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 43, Name = "DM - Perambalur", Email = "dm_perambalur@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Trichy", DistrictName = "Perambalur", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 44, Name = "DM - Thiruchirappalli", Email = "dm_thiruchirappalli@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Trichy", DistrictName = "Thiruchirappalli", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 45, Name = "DM - Pudukkottai", Email = "dm_pudukkottai@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Trichy", DistrictName = "Pudukkottai", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 46, Name = "DM - Vellore", Email = "dm_vellore@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Vellore", DistrictName = "Vellore", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 47, Name = "DM - Tirupathur", Email = "dm_tirupathur@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Vellore", DistrictName = "Tirupathur", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 48, Name = "DM - Tiruvannamalai", Email = "dm_tiruvannamalai@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Vellore", DistrictName = "Tiruvannamalai", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 49, Name = "DM - Villupuram", Email = "dm_villupuram@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Villupuram", DistrictName = "Villupuram", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 50, Name = "DM - Cuddalore", Email = "dm_cuddalore@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Villupuram", DistrictName = "Cuddalore", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 51, Name = "DM - Kallakurichi", Email = "dm_kallakurichi@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Villupuram", DistrictName = "Kallakurichi", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 52, Name = "DM - Tirunelveli", Email = "dm_tirunelveli@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Thirunelveli", DistrictName = "Tirunelveli", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 53, Name = "DM - Tenkasi", Email = "dm_tenkasi@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Thirunelveli", DistrictName = "Tenkasi", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 54, Name = "DM - Thoothukudi", Email = "dm_thoothukudi@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Thirunelveli", DistrictName = "Thoothukudi", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } },
            new() { Id = 55, Name = "DM - Kanniyakumari", Email = "dm_kanniyakumari@tahdco.in", Role = "dm", Scope = "district", DivisionName = "Thirunelveli", DistrictName = "Kanniyakumari", IsActive = true, AppAccess = new[] { "WELFARE", "SCHEME", "TELP", "TAMS", "TOD", "TNCWWB" } }
        };

        foreach (var u in users)
            EnsureDefaultPrivileges(u);

        return users;
    }
}
