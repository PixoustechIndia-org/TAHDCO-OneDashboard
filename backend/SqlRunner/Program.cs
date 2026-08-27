using System;
using System.IO;
using MySqlConnector;

class Program
{
    static void Main(string[] args)
    {
        string connStr = Environment.GetEnvironmentVariable("DB_CONNECTION_STRING") ??
                         "Server=localhost;Port=3306;Database=tahdco_udp;User=root;Password=YOUR_DATABASE_PASSWORD;Allow User Variables=true;Pooling=true;Min Pool Size=10;Max Pool Size=150;Connection Timeout=30;";
        using var conn = new MySqlConnection(connStr);
        conn.Open();
        
        string[] files = { @"..\..\database\05_scheduler_log.sql", @"..\..\database\06_detail_cache_schema.sql" };
        foreach (var file in files) {
            if (File.Exists(file)) {
                string sql = File.ReadAllText(file);
                using var cmd = new MySqlCommand(sql, conn);
                cmd.CommandTimeout = 300;
                cmd.ExecuteNonQuery();
                Console.WriteLine("Executed " + file);
            }
        }
    }
}
