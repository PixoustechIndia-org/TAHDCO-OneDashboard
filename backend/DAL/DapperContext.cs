using Microsoft.Extensions.Configuration;
using System.Data;
using MySqlConnector;

namespace DAL;

/// <summary>Creates MySQL connections from the Default connection string with full MySQL 8.0.42 support.</summary>
public class DapperContext
{
    private readonly string _connectionString;

    public DapperContext(IConfiguration config)
    {
        var envVal = Environment.GetEnvironmentVariable("DB_CONNECTION_STRING") ?? Environment.GetEnvironmentVariable("ConnectionStrings__Default");
        var raw = !string.IsNullOrWhiteSpace(envVal) ? envVal : (config.GetConnectionString("Default") ?? "");

        if (string.IsNullOrWhiteSpace(raw) || raw.StartsWith("${"))
        {
            var host = Environment.GetEnvironmentVariable("DB_HOST") ?? "localhost";
            var port = Environment.GetEnvironmentVariable("DB_PORT") ?? "3306";
            var db = Environment.GetEnvironmentVariable("DB_NAME") ?? "tahdco_udp";
            var user = Environment.GetEnvironmentVariable("DB_USER") ?? "root";
            var pass = Environment.GetEnvironmentVariable("DB_PASSWORD") ?? "";
            raw = $"server={host};port={port};database={db};user={user};password={pass};";
        }

        raw = raw.Trim().Trim('"', '\'');

        try
        {
            var builder = new MySqlConnectionStringBuilder(raw)
            {
                SslMode = MySqlSslMode.Preferred,
                AllowPublicKeyRetrieval = true,
                CharacterSet = "utf8mb4",
                ConnectionTimeout = 15,
                DefaultCommandTimeout = 30,
                Pooling = true,
                MinimumPoolSize = 5,
                MaximumPoolSize = 100
            };
            _connectionString = builder.ConnectionString;
        }
        catch
        {
            if (!raw.Contains("AllowPublicKeyRetrieval", StringComparison.OrdinalIgnoreCase))
            {
                raw += ";AllowPublicKeyRetrieval=True;SslMode=Preferred;CharSet=utf8mb4;Connection Timeout=15;";
            }
            _connectionString = raw;
        }
    }

    public IDbConnection CreateConnection() => new MySqlConnection(_connectionString);
}
