using Microsoft.Extensions.Configuration;
using System.Data;
using MySqlConnector;

namespace DAL;

/// <summary>Creates MySQL connections from the Default connection string.</summary>
public class DapperContext
{
    private readonly string _connectionString;
    public DapperContext(IConfiguration config) =>
        _connectionString = config.GetConnectionString("Default")
            ?? throw new InvalidOperationException("ConnectionStrings:Default missing");

    public IDbConnection CreateConnection() => new MySqlConnection(_connectionString);
}
