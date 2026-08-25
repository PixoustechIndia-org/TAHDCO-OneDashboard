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
        var envVal = Environment.GetEnvironmentVariable("DB_CONNECTION_STRING");
        var raw = !string.IsNullOrWhiteSpace(envVal) ? envVal : (config.GetConnectionString("Default") ?? "");

        if (string.IsNullOrWhiteSpace(raw) || raw.StartsWith("${"))
        {
            raw = "server=pixous-qa-instance.cj0oky48i38w.ap-south-1.rds.amazonaws.com;port=3306;database=tahdco_udp;user=web_user;password=M5sQx9zDp7Vb;";
        }

        raw = raw.Trim().Trim('"', '\'');

        // Handle unquoted complex passwords containing semicolon or unsupported keys
        if (raw.Contains("Password=A}-578mD&5U#;PKS=oiXC4T|+3_%j?Ut") && !raw.Contains("Password=\"A}-578mD&5U#;PKS=oiXC4T|+3_%j?Ut\"") && !raw.Contains("Password='A}-578mD&5U#;PKS=oiXC4T|+3_%j?Ut'"))
        {
            raw = raw.Replace("Password=A}-578mD&5U#;PKS=oiXC4T|+3_%j?Ut", "Password=\"A}-578mD&5U#;PKS=oiXC4T|+3_%j?Ut\"");
        }

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
