using System;
using System.IO;
using MySqlConnector;

class Program
{
    static void Main()
    {
        string connStr = "Server=pixous-qa-instance.cj0oky48i38w.ap-south-1.rds.amazonaws.com;Port=3306;Database=tahdco_udp;User=web_user;Password=M5sQx9zDp7Vb;Allow User Variables=true;Pooling=true;Min Pool Size=10;Max Pool Size=150;Connection Timeout=30;";
        using var conn = new MySqlConnection(connStr);
        conn.Open();
        
        string[] files = { @"..\..\database\05_scheduler_log.sql", @"..\..\database\06_detail_cache_schema.sql" };
        foreach (var file in files) {
            string sql = File.ReadAllText(file);
            using var cmd = new MySqlCommand(sql, conn);
            cmd.CommandTimeout = 300;
            cmd.ExecuteNonQuery();
            Console.WriteLine("Executed " + file);
        }
    }
}
