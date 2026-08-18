using System.Data;
using global::Dapper;

namespace DAL;

public interface IDapperRepository
{
    Task<IEnumerable<T>> QueryAsync<T>(string sql, object? param = null);
    Task<T?> QueryFirstOrDefaultAsync<T>(string sql, object? param = null);
    Task<T> QuerySingleAsync<T>(string sql, object? param = null);
    Task<int> ExecuteAsync(string sql, object? param = null);
}

/// <summary>Thin Dapper wrapper so BAL services never touch connections directly.</summary>
public class DapperRepository : IDapperRepository
{
    private readonly DapperContext _ctx;
    public DapperRepository(DapperContext ctx) => _ctx = ctx;

    public async Task<IEnumerable<T>> QueryAsync<T>(string sql, object? param = null)
    { using var con = _ctx.CreateConnection(); return await con.QueryAsync<T>(sql, param); }

    public async Task<T?> QueryFirstOrDefaultAsync<T>(string sql, object? param = null)
    { using var con = _ctx.CreateConnection(); return await con.QueryFirstOrDefaultAsync<T>(sql, param); }

    public async Task<T> QuerySingleAsync<T>(string sql, object? param = null)
    { using var con = _ctx.CreateConnection(); return await con.QuerySingleAsync<T>(sql, param); }

    public async Task<int> ExecuteAsync(string sql, object? param = null)
    { using var con = _ctx.CreateConnection(); return await con.ExecuteAsync(sql, param); }
}
