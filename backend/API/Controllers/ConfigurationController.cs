using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DAL;
using Model.ViewModel;
using MiniExcelLibs;
using System.Data;
using Dapper;
using System.Linq;

namespace API.Controllers;

[ApiController]
[Route("api/v1/configuration")]
[Authorize(Roles = "admin,md")]
public class ConfigurationController : ControllerBase
{
    private readonly IDapperRepository _db;
    public ConfigurationController(IDapperRepository db) => _db = db;

    private async Task EnsureTableAsync()
    {
        var sql = @"
            CREATE TABLE IF NOT EXISTS local_body_mapping (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sno INT NULL,
                state VARCHAR(100) NULL,
                division VARCHAR(100) NULL,
                district VARCHAR(100) NULL,
                local_body VARCHAR(100) NULL,
                local_body_name VARCHAR(255) NULL,
                block VARCHAR(100) NULL,
                village_panchayat VARCHAR(255) NULL,
                corporation VARCHAR(255) NULL,
                town_panchayat VARCHAR(255) NULL,
                municipality VARCHAR(255) NULL,
                gcc VARCHAR(255) NULL,
                cmwssb VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );";
        try
        {
            await _db.ExecuteAsync(sql);
        }
        catch { }
    }

    [HttpGet("records")]
    [AllowAnonymous]
    public async Task<IActionResult> GetRecords([FromQuery] string? search, [FromQuery] string? district, [FromQuery] string? division)
    {
        try
        {
            await EnsureTableAsync();

            var sql = @"
                SELECT id AS Id, sno AS Sno, state AS State, division AS Division, district AS District,
                       local_body AS LocalBody, local_body_name AS LocalBodyName, block AS Block,
                       village_panchayat AS VillagePanchayat, corporation AS Corporation,
                       town_panchayat AS TownPanchayat, municipality AS Municipality,
                       gcc AS Gcc, cmwssb AS Cmwssb
                FROM local_body_mapping WHERE 1=1";
            
            var p = new DynamicParameters();
            if (!string.IsNullOrWhiteSpace(search))
            {
                sql += @" AND (state LIKE @Q OR division LIKE @Q OR district LIKE @Q 
                              OR local_body_name LIKE @Q OR block LIKE @Q OR village_panchayat LIKE @Q 
                              OR municipality LIKE @Q OR corporation LIKE @Q OR town_panchayat LIKE @Q)";
                p.Add("Q", $"%{search}%");
            }
            if (!string.IsNullOrWhiteSpace(district) && district != "All Districts")
            {
                sql += " AND district = @Dist";
                p.Add("Dist", district);
            }
            if (!string.IsNullOrWhiteSpace(division) && division != "All Divisions")
            {
                sql += " AND division = @Div";
                p.Add("Div", division);
            }

            sql += " ORDER BY id";
            var records = (await _db.QueryAsync<LocalBodyMappingVm>(sql, p)).ToList();

            // If table is completely empty, seed initial baseline 38-district Tamil Nadu Local Body mappings
            if (records.Count == 0 && string.IsNullOrWhiteSpace(search))
            {
                await SeedDefaultRecordsAsync();
                records = (await _db.QueryAsync<LocalBodyMappingVm>(sql, p)).ToList();
            }

            return Ok(records);
        }
        catch (Exception)
        {
            // Database is offline - return the 38-district in-memory dataset
            return Ok(Get38DistrictSeedList(search, district, division));
        }
    }

    [HttpPost("records")]
    [AllowAnonymous]
    public async Task<IActionResult> AddRecord([FromBody] LocalBodyMappingVm model)
    {
        await EnsureTableAsync();
        var insertSql = @"
            INSERT INTO local_body_mapping (sno, state, division, district, local_body, local_body_name, block, village_panchayat, corporation, town_panchayat, municipality, gcc, cmwssb)
            VALUES (@Sno, @State, @Division, @District, @LocalBody, @LocalBodyName, @Block, @VillagePanchayat, @Corporation, @TownPanchayat, @Municipality, @Gcc, @Cmwssb)";
        
        await _db.ExecuteAsync(insertSql, model);
        return Ok(new { message = "Record added successfully." });
    }

    [HttpPut("records/{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> UpdateRecord(int id, [FromBody] LocalBodyMappingVm model)
    {
        await EnsureTableAsync();
        model.Id = id;
        var updateSql = @"
            UPDATE local_body_mapping 
            SET sno=@Sno, state=@State, division=@Division, district=@District,
                local_body=@LocalBody, local_body_name=@LocalBodyName, block=@Block,
                village_panchayat=@VillagePanchayat, corporation=@Corporation,
                town_panchayat=@TownPanchayat, municipality=@Municipality, gcc=@Gcc, cmwssb=@Cmwssb
            WHERE id = @Id";
        
        await _db.ExecuteAsync(updateSql, model);
        return Ok(new { message = "Record updated successfully." });
    }

    [HttpDelete("records/{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> DeleteRecord(int id)
    {
        await EnsureTableAsync();
        await _db.ExecuteAsync("DELETE FROM local_body_mapping WHERE id = @Id", new { Id = id });
        return Ok(new { message = "Record deleted successfully." });
    }

    [HttpDelete("records")]
    [AllowAnonymous]
    public async Task<IActionResult> ClearRecords()
    {
        await EnsureTableAsync();
        await _db.ExecuteAsync("TRUNCATE TABLE local_body_mapping");
        return Ok(new { message = "All records cleared successfully." });
    }

    [HttpPost("import")]
    [AllowAnonymous]
    public async Task<IActionResult> Import(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file uploaded." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx" && ext != ".xls")
            return BadRequest(new { message = "Only Excel files (.xlsx, .xls) are allowed." });

        try
        {
            await EnsureTableAsync();
            using var stream = file.OpenReadStream();
            var rows = MiniExcel.Query(stream).Cast<IDictionary<string, object>>().ToList();
            
            var list = new List<LocalBodyMappingVm>();
            int idx = 1;
            foreach (var dict in rows)
            {
                string GetVal(string keyPattern)
                {
                    var matchKey = dict.Keys.FirstOrDefault(k => 
                        k.Equals(keyPattern, StringComparison.OrdinalIgnoreCase) || 
                        k.Replace(" ", "").Equals(keyPattern.Replace(" ", ""), StringComparison.OrdinalIgnoreCase)
                    );
                    if (matchKey != null)
                        return dict[matchKey]?.ToString()?.Trim() ?? "";
                    return "";
                }
                
                int? GetIntVal(string keyPattern)
                {
                    var valStr = GetVal(keyPattern);
                    if (int.TryParse(valStr, out var i))
                        return i;
                    return null;
                }

                var sno = GetIntVal("sno") ?? idx++;
                var state = GetVal("State");
                var division = GetVal("Division");
                var district = GetVal("District");
                var localBody = GetVal("Local body");
                var localBodyName = GetVal("name of the localbody");
                var block = GetVal("BLOCK");
                var villagePanchayat = GetVal("Village pancayet");
                var corporation = GetVal("Corrpration");
                var townPanchayat = GetVal("townpanyptet");
                var municipality = GetVal("Muncipality");
                var gcc = GetVal("GCC");
                var cmwssb = GetVal("CMws");

                if (string.IsNullOrWhiteSpace(state) && string.IsNullOrWhiteSpace(division) && 
                    string.IsNullOrWhiteSpace(district) && string.IsNullOrWhiteSpace(localBodyName))
                    continue;

                list.Add(new LocalBodyMappingVm
                {
                    Sno = sno,
                    State = string.IsNullOrWhiteSpace(state) ? "Tamil Nadu" : state,
                    Division = division,
                    District = district,
                    LocalBody = localBody,
                    LocalBodyName = localBodyName,
                    Block = block,
                    VillagePanchayat = villagePanchayat,
                    Corporation = corporation,
                    TownPanchayat = townPanchayat,
                    Municipality = municipality,
                    Gcc = gcc,
                    Cmwssb = cmwssb
                });
            }

            if (list.Count == 0)
                return BadRequest(new { message = "No valid records found in the Excel file." });

            await _db.ExecuteAsync("TRUNCATE TABLE local_body_mapping");
            
            var insertSql = @"
                INSERT INTO local_body_mapping (sno, state, division, district, local_body, local_body_name, block, village_panchayat, corporation, town_panchayat, municipality, gcc, cmwssb)
                VALUES (@Sno, @State, @Division, @District, @LocalBody, @LocalBodyName, @Block, @VillagePanchayat, @Corporation, @TownPanchayat, @Municipality, @Gcc, @Cmwssb)";
                
            await _db.ExecuteAsync(insertSql, list);

            return Ok(new { message = $"{list.Count} records imported successfully.", count = list.Count });
        }
        catch (System.Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred during import.", error = ex.Message });
        }
    }

    private async Task SeedDefaultRecordsAsync()
    {
        var seedList = Get38DistrictSeedList(null, null, null);
        var insertSql = @"
            INSERT INTO local_body_mapping (sno, state, division, district, local_body, local_body_name, block, village_panchayat, corporation, town_panchayat, municipality, gcc, cmwssb)
            VALUES (@Sno, @State, @Division, @District, @LocalBody, @LocalBodyName, @Block, @VillagePanchayat, @Corporation, @TownPanchayat, @Municipality, @Gcc, @Cmwssb)";
        await _db.ExecuteAsync(insertSql, seedList);
    }

    public static List<LocalBodyMappingVm> Get38DistrictSeedList(string? search, string? district, string? division)
    {
        var rawData = new[]
        {
            // 1. Ariyalur (Trichy)
            ("Trichy", "Ariyalur", "Municipality", "Ariyalur Municipality", "Ariyalur Block", "-", "-", "-", "Ariyalur", "-", "-"),
            ("Trichy", "Ariyalur", "Municipality", "Jayankondam Municipality", "Jayankondam Block", "-", "-", "-", "Jayankondam", "-", "-"),
            ("Trichy", "Ariyalur", "Town Panchayat", "Varadarajanpettai Town Panchayat", "Andimadam Block", "-", "-", "Varadarajanpettai", "-", "-", "-"),
            ("Trichy", "Ariyalur", "Village Panchayat", "Kallankurichi Village Panchayat", "Ariyalur Block", "Kallankurichi", "-", "-", "-", "-", "-"),
            ("Trichy", "Ariyalur", "Village Panchayat", "T.Palur Village Panchayat", "T.Palur Block", "T.Palur", "-", "-", "-", "-", "-"),

            // 2. Chengalpattu (Chennai)
            ("Chennai", "Chengalpattu", "Corporation", "Tambaram City Municipal Corporation", "St. Thomas Mount Block", "-", "Tambaram", "-", "Tambaram", "-", "-"),
            ("Chennai", "Chengalpattu", "Municipality", "Chengalpattu Municipality", "Chengalpattu Block", "-", "-", "-", "Chengalpattu", "-", "-"),
            ("Chennai", "Chengalpattu", "Municipality", "Maraimalai Nagar Municipality", "Kattankulathur Block", "-", "-", "-", "Maraimalai Nagar", "-", "-"),
            ("Chennai", "Chengalpattu", "Town Panchayat", "Thiruporur Town Panchayat", "Thiruporur Block", "-", "-", "Thiruporur", "-", "-", "-"),
            ("Chennai", "Chengalpattu", "Town Panchayat", "Mamallapuram Town Panchayat", "Thirukalukundram Block", "-", "-", "Mamallapuram", "-", "-", "-"),
            ("Chennai", "Chengalpattu", "Village Panchayat", "Alapakkam Village Panchayat", "Chengalpattu Block", "Alapakkam", "-", "-", "-", "-", "-"),

            // 3. Chennai (Chennai)
            ("Chennai", "Chennai", "Corporation", "Greater Chennai Corporation - North (Zones 1-5)", "Royapuram / Tondiarpet Block", "-", "GCC", "-", "-", "Yes", "Yes"),
            ("Chennai", "Chennai", "Corporation", "Greater Chennai Corporation - Central (Zones 6-10)", "Anna Nagar / Teynampet Block", "-", "GCC", "-", "-", "Yes", "Yes"),
            ("Chennai", "Chennai", "Corporation", "Greater Chennai Corporation - South (Zones 11-15)", "Adyar / Sholinganallur Block", "-", "GCC", "-", "-", "Yes", "Yes"),
            ("Chennai", "Chennai", "Municipality", "Alandur Urban Zone", "Alandur Block", "-", "GCC", "-", "Alandur", "Yes", "Yes"),

            // 4. Coimbatore (Coimbatore)
            ("Coimbatore", "Coimbatore", "Corporation", "Coimbatore City Municipal Corporation", "Coimbatore North & South Block", "-", "Coimbatore", "-", "-", "-", "-"),
            ("Coimbatore", "Coimbatore", "Municipality", "Pollachi Municipality", "Pollachi Block", "-", "-", "-", "Pollachi", "-", "-"),
            ("Coimbatore", "Coimbatore", "Municipality", "Mettupalayam Municipality", "Karamadai Block", "-", "-", "-", "Mettupalayam", "-", "-"),
            ("Coimbatore", "Coimbatore", "Town Panchayat", "Annur Town Panchayat", "Annur Block", "-", "-", "Annur", "-", "-", "-"),
            ("Coimbatore", "Coimbatore", "Town Panchayat", "Sulur Town Panchayat", "Sulur Block", "-", "-", "Sulur", "-", "-", "-"),
            ("Coimbatore", "Coimbatore", "Village Panchayat", "Madukkarai Village Panchayat", "Madukkarai Block", "Madukkarai", "-", "-", "-", "-", "-"),

            // 5. Cuddalore (Villupuram)
            ("Villupuram", "Cuddalore", "Corporation", "Cuddalore City Municipal Corporation", "Cuddalore Block", "-", "Cuddalore", "-", "-", "-", "-"),
            ("Villupuram", "Cuddalore", "Municipality", "Panruti Municipality", "Panruti Block", "-", "-", "-", "Panruti", "-", "-"),
            ("Villupuram", "Cuddalore", "Municipality", "Chidambaram Municipality", "Parangipettai Block", "-", "-", "-", "Chidambaram", "-", "-"),
            ("Villupuram", "Cuddalore", "Town Panchayat", "Kurinjipadi Town Panchayat", "Kurinjipadi Block", "-", "-", "Kurinjipadi", "-", "-", "-"),
            ("Villupuram", "Cuddalore", "Village Panchayat", "Sedapalayam Village Panchayat", "Cuddalore Block", "Sedapalayam", "-", "-", "-", "-", "-"),

            // 6. Dharmapuri (Salem)
            ("Salem", "Dharmapuri", "Municipality", "Dharmapuri Municipality", "Dharmapuri Block", "-", "-", "-", "Dharmapuri", "-", "-"),
            ("Salem", "Dharmapuri", "Town Panchayat", "Harur Town Panchayat", "Harur Block", "-", "-", "Harur", "-", "-", "-"),
            ("Salem", "Dharmapuri", "Town Panchayat", "Palakkodu Town Panchayat", "Palakkodu Block", "-", "-", "Palakkodu", "-", "-", "-"),
            ("Salem", "Dharmapuri", "Town Panchayat", "Pennagaram Town Panchayat", "Pennagaram Block", "-", "-", "Pennagaram", "-", "-", "-"),
            ("Salem", "Dharmapuri", "Village Panchayat", "Adagapadi Village Panchayat", "Dharmapuri Block", "Adagapadi", "-", "-", "-", "-", "-"),

            // 7. Dindigul (Madurai)
            ("Madurai", "Dindigul", "Corporation", "Dindigul City Corporation", "Dindigul Block", "-", "Dindigul", "-", "-", "-", "-"),
            ("Madurai", "Dindigul", "Municipality", "Palani Municipality", "Palani Block", "-", "-", "-", "Palani", "-", "-"),
            ("Madurai", "Dindigul", "Municipality", "Kodaikanal Municipality", "Kodaikanal Block", "-", "-", "-", "Kodaikanal", "-", "-"),
            ("Madurai", "Dindigul", "Town Panchayat", "Natham Town Panchayat", "Natham Block", "-", "-", "Natham", "-", "-", "-"),
            ("Madurai", "Dindigul", "Village Panchayat", "Adiyanuthu Village Panchayat", "Dindigul Block", "Adiyanuthu", "-", "-", "-", "-", "-"),

            // 8. Erode (Coimbatore)
            ("Coimbatore", "Erode", "Corporation", "Erode City Municipal Corporation", "Erode Block", "-", "Erode", "-", "-", "-", "-"),
            ("Coimbatore", "Erode", "Municipality", "Gobichettipalayam Municipality", "Gobichettipalayam Block", "-", "-", "-", "Gobichettipalayam", "-", "-"),
            ("Coimbatore", "Erode", "Municipality", "Bhavani Municipality", "Bhavani Block", "-", "-", "-", "Bhavani", "-", "-"),
            ("Coimbatore", "Erode", "Town Panchayat", "Perundurai Town Panchayat", "Perundurai Block", "-", "-", "Perundurai", "-", "-", "-"),
            ("Coimbatore", "Erode", "Village Panchayat", "Vaikkalmedu Village Panchayat", "Modakkurichi Block", "Vaikkalmedu", "-", "-", "-", "-", "-"),

            // 9. Kallakurichi (Villupuram)
            ("Villupuram", "Kallakurichi", "Municipality", "Kallakurichi Municipality", "Kallakurichi Block", "-", "-", "-", "Kallakurichi", "-", "-"),
            ("Villupuram", "Kallakurichi", "Municipality", "Ulundurpet Municipality", "Ulundurpet Block", "-", "-", "-", "Ulundurpet", "-", "-"),
            ("Villupuram", "Kallakurichi", "Town Panchayat", "Sankarapuram Town Panchayat", "Sankarapuram Block", "-", "-", "Sankarapuram", "-", "-", "-"),
            ("Villupuram", "Kallakurichi", "Town Panchayat", "Chinnasalem Town Panchayat", "Chinnasalem Block", "-", "-", "Chinnasalem", "-", "-", "-"),
            ("Villupuram", "Kallakurichi", "Village Panchayat", "Alathur Village Panchayat", "Kallakurichi Block", "Alathur", "-", "-", "-", "-", "-"),

            // 10. Kancheepuram (Chennai)
            ("Chennai", "Kancheepuram", "Corporation", "Kancheepuram City Corporation", "Kancheepuram Block", "-", "Kancheepuram", "-", "-", "-", "-"),
            ("Chennai", "Kancheepuram", "Municipality", "Kundrathur Municipality", "Kundrathur Block", "-", "-", "-", "Kundrathur", "-", "-"),
            ("Chennai", "Kancheepuram", "Municipality", "Mangadu Municipality", "Mangadu Block", "-", "-", "-", "Mangadu", "-", "-"),
            ("Chennai", "Kancheepuram", "Town Panchayat", "Walajabad Town Panchayat", "Walajabad Block", "-", "-", "Walajabad", "-", "-", "-"),
            ("Chennai", "Kancheepuram", "Village Panchayat", "Damal Village Panchayat", "Kancheepuram Block", "Damal", "-", "-", "-", "-", "-"),

            // 11. Kanniyakumari (Tirunelveli)
            ("Tirunelveli", "Kanniyakumari", "Corporation", "Nagercoil City Corporation", "Agastheeswaram Block", "-", "Nagercoil", "-", "-", "-", "-"),
            ("Tirunelveli", "Kanniyakumari", "Municipality", "Padmanabhapuram Municipality", "Thuckalay Block", "-", "-", "-", "Padmanabhapuram", "-", "-"),
            ("Tirunelveli", "Kanniyakumari", "Municipality", "Colachel Municipality", "Kurunthencode Block", "-", "-", "-", "Colachel", "-", "-"),
            ("Tirunelveli", "Kanniyakumari", "Town Panchayat", "Kanyakumari Town Panchayat", "Agastheeswaram Block", "-", "-", "Kanyakumari", "-", "-", "-"),
            ("Tirunelveli", "Kanniyakumari", "Village Panchayat", "Suchindram Village Panchayat", "Agastheeswaram Block", "Suchindram", "-", "-", "-", "-", "-"),

            // 12. Karur (Trichy)
            ("Trichy", "Karur", "Corporation", "Karur City Municipal Corporation", "Karur Block", "-", "Karur", "-", "-", "-", "-"),
            ("Trichy", "Karur", "Municipality", "Kulithalai Municipality", "Kulithalai Block", "-", "-", "-", "Kulithalai", "-", "-"),
            ("Trichy", "Karur", "Town Panchayat", "Aravakurichi Town Panchayat", "Aravakurichi Block", "-", "-", "Aravakurichi", "-", "-", "-"),
            ("Trichy", "Karur", "Town Panchayat", "Pallapatti Town Panchayat", "Pallapatti Block", "-", "-", "Pallapatti", "-", "-", "-"),
            ("Trichy", "Karur", "Village Panchayat", "Andankoil Village Panchayat", "Thanthoni Block", "Andankoil", "-", "-", "-", "-", "-"),

            // 13. Krishnagiri (Salem)
            ("Salem", "Krishnagiri", "Corporation", "Hosur City Municipal Corporation", "Hosur Block", "-", "Hosur", "-", "-", "-", "-"),
            ("Salem", "Krishnagiri", "Municipality", "Krishnagiri Municipality", "Krishnagiri Block", "-", "-", "-", "Krishnagiri", "-", "-"),
            ("Salem", "Krishnagiri", "Town Panchayat", "Uthangarai Town Panchayat", "Uthangarai Block", "-", "-", "Uthangarai", "-", "-", "-"),
            ("Salem", "Krishnagiri", "Town Panchayat", "Kaveripattinam Town Panchayat", "Kaveripattinam Block", "-", "-", "Kaveripattinam", "-", "-", "-"),
            ("Salem", "Krishnagiri", "Village Panchayat", "Mathigiri Village Panchayat", "Hosur Block", "Mathigiri", "-", "-", "-", "-", "-"),

            // 14. Madurai (Madurai)
            ("Madurai", "Madurai", "Corporation", "Madurai City Municipal Corporation", "Madurai East & West Block", "-", "Madurai", "-", "-", "-", "-"),
            ("Madurai", "Madurai", "Municipality", "Melur Municipality", "Melur Block", "-", "-", "-", "Melur", "-", "-"),
            ("Madurai", "Madurai", "Municipality", "Thirumangalam Municipality", "Thirumangalam Block", "-", "-", "-", "Thirumangalam", "-", "-"),
            ("Madurai", "Madurai", "Town Panchayat", "Vadipatti Town Panchayat", "Vadipatti Block", "-", "-", "Vadipatti", "-", "-", "-"),
            ("Madurai", "Madurai", "Village Panchayat", "Othakadai Village Panchayat", "Madurai East Block", "Othakadai", "-", "-", "-", "-", "-"),

            // 15. Mayiladuthurai (Thanjavur)
            ("Thanjavur", "Mayiladuthurai", "Municipality", "Mayiladuthurai Municipality", "Mayiladuthurai Block", "-", "-", "-", "Mayiladuthurai", "-", "-"),
            ("Thanjavur", "Mayiladuthurai", "Municipality", "Sirkazhi Municipality", "Sirkazhi Block", "-", "-", "-", "Sirkazhi", "-", "-"),
            ("Thanjavur", "Mayiladuthurai", "Town Panchayat", "Tharangambadi Town Panchayat", "Tharangambadi Block", "-", "-", "Tharangambadi", "-", "-", "-"),
            ("Thanjavur", "Mayiladuthurai", "Town Panchayat", "Vaitheeswarankoil Town Panchayat", "Kollidam Block", "-", "-", "Vaitheeswarankoil", "-", "-", "-"),
            ("Thanjavur", "Mayiladuthurai", "Village Panchayat", "Kuthalam Village Panchayat", "Kuthalam Block", "Kuthalam", "-", "-", "-", "-", "-"),

            // 16. Nagapattinam (Thanjavur)
            ("Thanjavur", "Nagapattinam", "Municipality", "Nagapattinam Municipality", "Nagapattinam Block", "-", "-", "-", "Nagapattinam", "-", "-"),
            ("Thanjavur", "Nagapattinam", "Municipality", "Vedaranyam Municipality", "Vedaranyam Block", "-", "-", "-", "Vedaranyam", "-", "-"),
            ("Thanjavur", "Nagapattinam", "Town Panchayat", "Kilvelur Town Panchayat", "Kilvelur Block", "-", "-", "Kilvelur", "-", "-", "-"),
            ("Thanjavur", "Nagapattinam", "Town Panchayat", "Velankanni Town Panchayat", "Keelaiyur Block", "-", "-", "Velankanni", "-", "-", "-"),
            ("Thanjavur", "Nagapattinam", "Village Panchayat", "Sikkal Village Panchayat", "Nagapattinam Block", "Sikkal", "-", "-", "-", "-", "-"),

            // 17. Namakkal (Salem)
            ("Salem", "Namakkal", "Municipality", "Namakkal Municipality", "Namakkal Block", "-", "-", "-", "Namakkal", "-", "-"),
            ("Salem", "Namakkal", "Municipality", "Tiruchengode Municipality", "Tiruchengode Block", "-", "-", "-", "Tiruchengode", "-", "-"),
            ("Salem", "Namakkal", "Municipality", "Rasipuram Municipality", "Rasipuram Block", "-", "-", "-", "Rasipuram", "-", "-"),
            ("Salem", "Namakkal", "Town Panchayat", "Paramathi Town Panchayat", "Paramathi Block", "-", "-", "Paramathi", "-", "-", "-"),
            ("Salem", "Namakkal", "Village Panchayat", "Vengarai Village Panchayat", "Mohanur Block", "Vengarai", "-", "-", "-", "-", "-"),

            // 18. Perambalur (Trichy)
            ("Trichy", "Perambalur", "Municipality", "Perambalur Municipality", "Perambalur Block", "-", "-", "-", "Perambalur", "-", "-"),
            ("Trichy", "Perambalur", "Town Panchayat", "Kurumbalur Town Panchayat", "Perambalur Block", "-", "-", "Kurumbalur", "-", "-", "-"),
            ("Trichy", "Perambalur", "Town Panchayat", "Labbaikudikadu Town Panchayat", "Kunnam Block", "-", "-", "Labbaikudikadu", "-", "-", "-"),
            ("Trichy", "Perambalur", "Village Panchayat", "Elambalur Village Panchayat", "Perambalur Block", "Elambalur", "-", "-", "-", "-", "-"),
            ("Trichy", "Perambalur", "Village Panchayat", "Veppanthattai Village Panchayat", "Veppanthattai Block", "Veppanthattai", "-", "-", "-", "-", "-"),

            // 19. Pudukkottai (Trichy)
            ("Trichy", "Pudukkottai", "Corporation", "Pudukkottai Corporation", "Pudukkottai Block", "-", "Pudukkottai", "-", "-", "-", "-"),
            ("Trichy", "Pudukkottai", "Municipality", "Aranthangi Municipality", "Aranthangi Block", "-", "-", "-", "Aranthangi", "-", "-"),
            ("Trichy", "Pudukkottai", "Town Panchayat", "Alangudi Town Panchayat", "Alangudi Block", "-", "-", "Alangudi", "-", "-", "-"),
            ("Trichy", "Pudukkottai", "Town Panchayat", "Illuppur Town Panchayat", "Illuppur Block", "-", "-", "Illuppur", "-", "-", "-"),
            ("Trichy", "Pudukkottai", "Village Panchayat", "Mullur Village Panchayat", "Pudukkottai Block", "Mullur", "-", "-", "-", "-", "-"),

            // 20. Ramanathapuram (Madurai)
            ("Madurai", "Ramanathapuram", "Municipality", "Ramanathapuram Municipality", "Ramanathapuram Block", "-", "-", "-", "Ramanathapuram", "-", "-"),
            ("Madurai", "Ramanathapuram", "Municipality", "Paramakudi Municipality", "Paramakudi Block", "-", "-", "-", "Paramakudi", "-", "-"),
            ("Madurai", "Ramanathapuram", "Town Panchayat", "Rameswaram Town Panchayat", "Mandapam Block", "-", "-", "Rameswaram", "-", "-", "-"),
            ("Madurai", "Ramanathapuram", "Town Panchayat", "Kamuthi Town Panchayat", "Kamuthi Block", "-", "-", "Kamuthi", "-", "-", "-"),
            ("Madurai", "Ramanathapuram", "Village Panchayat", "Devipattinam Village Panchayat", "Ramanathapuram Block", "Devipattinam", "-", "-", "-", "-", "-"),

            // 21. Ranipet (Vellore)
            ("Vellore", "Ranipet", "Municipality", "Ranipet Municipality", "Walajah Block", "-", "-", "-", "Ranipet", "-", "-"),
            ("Vellore", "Ranipet", "Municipality", "Arakkonam Municipality", "Arakkonam Block", "-", "-", "-", "Arakkonam", "-", "-"),
            ("Vellore", "Ranipet", "Municipality", "Arcot Municipality", "Arcot Block", "-", "-", "-", "Arcot", "-", "-"),
            ("Vellore", "Ranipet", "Town Panchayat", "Kaveripakkam Town Panchayat", "Nemili Block", "-", "-", "Kaveripakkam", "-", "-", "-"),
            ("Vellore", "Ranipet", "Village Panchayat", "Ammoor Village Panchayat", "Walajah Block", "Ammoor", "-", "-", "-", "-", "-"),

            // 22. Salem (Salem)
            ("Salem", "Salem", "Corporation", "Salem City Municipal Corporation", "Salem Urban Block", "-", "Salem", "-", "-", "-", "-"),
            ("Salem", "Salem", "Municipality", "Attur Municipality", "Attur Block", "-", "-", "-", "Attur", "-", "-"),
            ("Salem", "Salem", "Municipality", "Mettur Municipality", "Mettur Block", "-", "-", "-", "Mettur", "-", "-"),
            ("Salem", "Salem", "Town Panchayat", "Jalakandapuram Town Panchayat", "Mecheri Block", "-", "-", "Jalakandapuram", "-", "-", "-"),
            ("Salem", "Salem", "Village Panchayat", "Kandhampatty Village Panchayat", "Salem Block", "Kandhampatty", "-", "-", "-", "-", "-"),

            // 23. Sivaganga (Madurai)
            ("Madurai", "Sivaganga", "Municipality", "Sivaganga Municipality", "Sivaganga Block", "-", "-", "-", "Sivaganga", "-", "-"),
            ("Madurai", "Sivaganga", "Municipality", "Karaikudi Municipality", "Sakkottai Block", "-", "-", "-", "Karaikudi", "-", "-"),
            ("Madurai", "Sivaganga", "Town Panchayat", "Thiruppuvanam Town Panchayat", "Thiruppuvanam Block", "-", "-", "Thiruppuvanam", "-", "-", "-"),
            ("Madurai", "Sivaganga", "Town Panchayat", "Manamadurai Town Panchayat", "Manamadurai Block", "-", "-", "Manamadurai", "-", "-", "-"),
            ("Madurai", "Sivaganga", "Village Panchayat", "Payampon Village Panchayat", "Sivaganga Block", "Payampon", "-", "-", "-", "-", "-"),

            // 24. Tenkasi (Tirunelveli)
            ("Tirunelveli", "Tenkasi", "Municipality", "Tenkasi Municipality", "Tenkasi Block", "-", "-", "-", "Tenkasi", "-", "-"),
            ("Tirunelveli", "Tenkasi", "Municipality", "Sankarankovil Municipality", "Sankarankovil Block", "-", "-", "-", "Sankarankovil", "-", "-"),
            ("Tirunelveli", "Tenkasi", "Municipality", "Kadayanallur Municipality", "Kadayanallur Block", "-", "-", "-", "Kadayanallur", "-", "-"),
            ("Tirunelveli", "Tenkasi", "Town Panchayat", "Courtallam Town Panchayat", "Tenkasi Block", "-", "-", "Courtallam", "-", "-", "-"),
            ("Tirunelveli", "Tenkasi", "Village Panchayat", "Kasimajorpuram Village Panchayat", "Shenkottai Block", "Kasimajorpuram", "-", "-", "-", "-", "-"),

            // 25. Thanjavur (Thanjavur)
            ("Thanjavur", "Thanjavur", "Corporation", "Thanjavur City Municipal Corporation", "Thanjavur Block", "-", "Thanjavur", "-", "-", "-", "-"),
            ("Thanjavur", "Thanjavur", "Corporation", "Kumbakonam City Corporation", "Kumbakonam Block", "-", "Kumbakonam", "-", "Kumbakonam", "-", "-"),
            ("Thanjavur", "Thanjavur", "Municipality", "Pattukkottai Municipality", "Pattukkottai Block", "-", "-", "-", "Pattukkottai", "-", "-"),
            ("Thanjavur", "Thanjavur", "Town Panchayat", "Thiruvaiyaru Town Panchayat", "Thiruvaiyaru Block", "-", "-", "Thiruvaiyaru", "-", "-", "-"),
            ("Thanjavur", "Thanjavur", "Village Panchayat", "Vallam Village Panchayat", "Thanjavur Block", "Vallam", "-", "-", "-", "-", "-"),

            // 26. The Nilgiris (Coimbatore)
            ("Coimbatore", "The Nilgiris", "Municipality", "Udhagamandalam (Ooty) Municipality", "Udhagamandalam Block", "-", "-", "-", "Ooty", "-", "-"),
            ("Coimbatore", "The Nilgiris", "Municipality", "Coonoor Municipality", "Coonoor Block", "-", "-", "-", "Coonoor", "-", "-"),
            ("Coimbatore", "The Nilgiris", "Municipality", "Gudalur Municipality", "Gudalur Block", "-", "-", "-", "Gudalur", "-", "-"),
            ("Coimbatore", "The Nilgiris", "Town Panchayat", "Kotagiri Town Panchayat", "Kotagiri Block", "-", "-", "Kotagiri", "-", "-", "-"),
            ("Coimbatore", "The Nilgiris", "Village Panchayat", "Ketti Village Panchayat", "Coonoor Block", "Ketti", "-", "-", "-", "-", "-"),

            // 27. Theni (Madurai)
            ("Madurai", "Theni", "Municipality", "Theni Allinagaram Municipality", "Theni Block", "-", "-", "-", "Theni", "-", "-"),
            ("Madurai", "Theni", "Municipality", "Bodinayakanur Municipality", "Bodinayakanur Block", "-", "-", "-", "Bodinayakanur", "-", "-"),
            ("Madurai", "Theni", "Municipality", "Periyakulam Municipality", "Periyakulam Block", "-", "-", "-", "Periyakulam", "-", "-"),
            ("Madurai", "Theni", "Town Panchayat", "Chinnamanoor Town Panchayat", "Uthamapalayam Block", "-", "-", "Chinnamanoor", "-", "-", "-"),
            ("Madurai", "Theni", "Village Panchayat", "Unjampatti Village Panchayat", "Theni Block", "Unjampatti", "-", "-", "-", "-", "-"),

            // 28. Thiruchirappalli (Trichy)
            ("Trichy", "Thiruchirappalli", "Corporation", "Tiruchirappalli City Corporation", "Trichy Urban Block", "-", "Trichy", "-", "-", "-", "-"),
            ("Trichy", "Thiruchirappalli", "Municipality", "Manapparai Municipality", "Manapparai Block", "-", "-", "-", "Manapparai", "-", "-"),
            ("Trichy", "Thiruchirappalli", "Municipality", "Thuraiyur Municipality", "Thuraiyur Block", "-", "-", "-", "Thuraiyur", "-", "-"),
            ("Trichy", "Thiruchirappalli", "Town Panchayat", "Thuvakudi Town Panchayat", "Thiruverumbur Block", "-", "-", "Thuvakudi", "-", "-", "-"),
            ("Trichy", "Thiruchirappalli", "Village Panchayat", "K. Sathanur Village Panchayat", "Andanallur Block", "K. Sathanur", "-", "-", "-", "-", "-"),

            // 29. Thirunelveli (Tirunelveli)
            ("Tirunelveli", "Thirunelveli", "Corporation", "Tirunelveli City Corporation", "Palayamkottai Block", "-", "Tirunelveli", "-", "-", "-", "-"),
            ("Tirunelveli", "Thirunelveli", "Municipality", "Ambasamudram Municipality", "Ambasamudram Block", "-", "-", "-", "Ambasamudram", "-", "-"),
            ("Tirunelveli", "Thirunelveli", "Municipality", "Vikramasingapuram Municipality", "Cheranmahadevi Block", "-", "-", "-", "Vikramasingapuram", "-", "-"),
            ("Tirunelveli", "Thirunelveli", "Town Panchayat", "Mukkudal Town Panchayat", "Pappakudi Block", "-", "-", "Mukkudal", "-", "-", "-"),
            ("Tirunelveli", "Thirunelveli", "Village Panchayat", "Reddiarpatti Village Panchayat", "Palayamkottai Block", "Reddiarpatti", "-", "-", "-", "-", "-"),

            // 30. Thiruvallur (Chennai)
            ("Chennai", "Thiruvallur", "Corporation", "Avadi City Municipal Corporation", "Poonamallee Block", "-", "Avadi", "-", "-", "-", "-"),
            ("Chennai", "Thiruvallur", "Municipality", "Tiruvallur Municipality", "Tiruvallur Block", "-", "-", "-", "Tiruvallur", "-", "-"),
            ("Chennai", "Thiruvallur", "Municipality", "Poonamallee Municipality", "Poonamallee Block", "-", "-", "-", "Poonamallee", "-", "-"),
            ("Chennai", "Thiruvallur", "Town Panchayat", "Gummidipoondi Town Panchayat", "Gummidipoondi Block", "-", "-", "Gummidipoondi", "-", "-", "-"),
            ("Chennai", "Thiruvallur", "Village Panchayat", "Nemam Village Panchayat", "Poonamallee Block", "Nemam", "-", "-", "-", "-", "-"),

            // 31. Thiruvannamalai (Villupuram)
            ("Villupuram", "Thiruvannamalai", "Municipality", "Tiruvannamalai Municipality", "Tiruvannamalai Block", "-", "-", "-", "Tiruvannamalai", "-", "-"),
            ("Villupuram", "Thiruvannamalai", "Municipality", "Arani Municipality", "Arani Block", "-", "-", "-", "Arani", "-", "-"),
            ("Villupuram", "Thiruvannamalai", "Town Panchayat", "Chengam Town Panchayat", "Chengam Block", "-", "-", "Chengam", "-", "-", "-"),
            ("Villupuram", "Thiruvannamalai", "Town Panchayat", "Polur Town Panchayat", "Polur Block", "-", "-", "Polur", "-", "-", "-"),
            ("Villupuram", "Thiruvannamalai", "Village Panchayat", "Vengikkal Village Panchayat", "Tiruvannamalai Block", "Vengikkal", "-", "-", "-", "-", "-"),

            // 32. Thiruvarur (Thanjavur)
            ("Thanjavur", "Thiruvarur", "Municipality", "Thiruvarur Municipality", "Thiruvarur Block", "-", "-", "-", "Thiruvarur", "-", "-"),
            ("Thanjavur", "Thiruvarur", "Municipality", "Mannargudi Municipality", "Mannargudi Block", "-", "-", "-", "Mannargudi", "-", "-"),
            ("Thanjavur", "Thiruvarur", "Municipality", "Thiruthuraipoondi Municipality", "Thiruthuraipoondi Block", "-", "-", "-", "Thiruthuraipoondi", "-", "-"),
            ("Thanjavur", "Thiruvarur", "Town Panchayat", "Nannilam Town Panchayat", "Nannilam Block", "-", "-", "Nannilam", "-", "-", "-"),
            ("Thanjavur", "Thiruvarur", "Village Panchayat", "Kattur Village Panchayat", "Thiruvarur Block", "Kattur", "-", "-", "-", "-", "-"),

            // 33. Thoothukudi (Tirunelveli)
            ("Tirunelveli", "Thoothukudi", "Corporation", "Thoothukudi City Municipal Corporation", "Thoothukudi Block", "-", "Thoothukudi", "-", "-", "-", "-"),
            ("Tirunelveli", "Thoothukudi", "Municipality", "Kovilpatti Municipality", "Kovilpatti Block", "-", "-", "-", "Kovilpatti", "-", "-"),
            ("Tirunelveli", "Thoothukudi", "Municipality", "Kayalpattinam Municipality", "Tiruchendur Block", "-", "-", "-", "Kayalpattinam", "-", "-"),
            ("Tirunelveli", "Thoothukudi", "Town Panchayat", "Tiruchendur Town Panchayat", "Tiruchendur Block", "-", "-", "Tiruchendur", "-", "-", "-"),
            ("Tirunelveli", "Thoothukudi", "Village Panchayat", "Mullakadu Village Panchayat", "Thoothukudi Block", "Mullakadu", "-", "-", "-", "-", "-"),

            // 34. Tirupathur (Vellore)
            ("Vellore", "Tirupathur", "Municipality", "Tirupathur Municipality", "Tirupathur Block", "-", "-", "-", "Tirupathur", "-", "-"),
            ("Vellore", "Tirupathur", "Municipality", "Vaniyambadi Municipality", "Vaniyambadi Block", "-", "-", "-", "Vaniyambadi", "-", "-"),
            ("Vellore", "Tirupathur", "Municipality", "Ambur Municipality", "Madhanur Block", "-", "-", "-", "Ambur", "-", "-"),
            ("Vellore", "Tirupathur", "Town Panchayat", "Natrampalli Town Panchayat", "Natrampalli Block", "-", "-", "Natrampalli", "-", "-", "-"),
            ("Vellore", "Tirupathur", "Village Panchayat", "Kandili Village Panchayat", "Kandili Block", "Kandili", "-", "-", "-", "-", "-"),

            // 35. Tiruppur (Coimbatore)
            ("Coimbatore", "Tiruppur", "Corporation", "Tiruppur City Municipal Corporation", "Tiruppur North Block", "-", "Tiruppur", "-", "-", "-", "-"),
            ("Coimbatore", "Tiruppur", "Municipality", "Udumalaipettai Municipality", "Udumalaipettai Block", "-", "-", "-", "Udumalaipettai", "-", "-"),
            ("Coimbatore", "Tiruppur", "Municipality", "Dharapuram Municipality", "Dharapuram Block", "-", "-", "-", "Dharapuram", "-", "-"),
            ("Coimbatore", "Tiruppur", "Town Panchayat", "Kangeyam Town Panchayat", "Kangeyam Block", "-", "-", "Kangeyam", "-", "-", "-"),
            ("Coimbatore", "Tiruppur", "Village Panchayat", "Mannarai Village Panchayat", "Tiruppur Block", "Mannarai", "-", "-", "-", "-", "-"),

            // 36. Vellore (Vellore)
            ("Vellore", "Vellore", "Corporation", "Vellore City Municipal Corporation", "Katpadi Block", "-", "Vellore", "-", "-", "-", "-"),
            ("Vellore", "Vellore", "Municipality", "Gudiyattam Municipality", "Gudiyattam Block", "-", "-", "-", "Gudiyattam", "-", "-"),
            ("Vellore", "Vellore", "Municipality", "Pernambut Municipality", "Pernambut Block", "-", "-", "-", "Pernambut", "-", "-"),
            ("Vellore", "Vellore", "Town Panchayat", "Pennathur Town Panchayat", "Vellore Block", "-", "-", "Pennathur", "-", "-", "-"),
            ("Vellore", "Vellore", "Village Panchayat", "Shenbakkam Village Panchayat", "Katpadi Block", "Shenbakkam", "-", "-", "-", "-", "-"),

            // 37. Villupuram (Villupuram)
            ("Villupuram", "Villupuram", "Municipality", "Villupuram Municipality", "Villupuram Block", "-", "-", "-", "Villupuram", "-", "-"),
            ("Villupuram", "Villupuram", "Municipality", "Tindivanam Municipality", "Tindivanam Block", "-", "-", "-", "Tindivanam", "-", "-"),
            ("Villupuram", "Villupuram", "Town Panchayat", "Gingee Town Panchayat", "Gingee Block", "-", "-", "Gingee", "-", "-", "-"),
            ("Villupuram", "Villupuram", "Town Panchayat", "Marakkanam Town Panchayat", "Marakkanam Block", "-", "-", "Marakkanam", "-", "-", "-"),
            ("Villupuram", "Villupuram", "Village Panchayat", "Koliyanur Village Panchayat", "Koliyanur Block", "Koliyanur", "-", "-", "-", "-", "-"),

            // 38. Virudhunagar (Madurai)
            ("Madurai", "Virudhunagar", "Corporation", "Sivakasi City Corporation", "Sivakasi Block", "-", "Sivakasi", "-", "-", "-", "-"),
            ("Madurai", "Virudhunagar", "Municipality", "Virudhunagar Municipality", "Virudhunagar Block", "-", "-", "-", "Virudhunagar", "-", "-"),
            ("Madurai", "Virudhunagar", "Municipality", "Rajapalayam Municipality", "Rajapalayam Block", "-", "-", "-", "Rajapalayam", "-", "-"),
            ("Madurai", "Virudhunagar", "Town Panchayat", "Kariapatti Town Panchayat", "Kariapatti Block", "-", "-", "Kariapatti", "-", "-", "-"),
            ("Madurai", "Virudhunagar", "Village Panchayat", "Rosalpatti Village Panchayat", "Virudhunagar Block", "Rosalpatti", "-", "-", "-", "-", "-")
        };

        var list = new List<LocalBodyMappingVm>();
        int s = 1;
        foreach (var r in rawData)
        {
            list.Add(new LocalBodyMappingVm
            {
                Id = s,
                Sno = s,
                State = "Tamil Nadu",
                Division = r.Item1,
                District = r.Item2,
                LocalBody = r.Item3,
                LocalBodyName = r.Item4,
                Block = r.Item5,
                VillagePanchayat = r.Item6,
                Corporation = r.Item7,
                TownPanchayat = r.Item8,
                Municipality = r.Item9,
                Gcc = r.Item10,
                Cmwssb = r.Item11
            });
            s++;
        }

        var filtered = list.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(district) && district != "All Districts")
            filtered = filtered.Where(x => x.District.Equals(district, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(division) && division != "All Divisions")
            filtered = filtered.Where(x => x.Division.Equals(division, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLowerInvariant();
            filtered = filtered.Where(x =>
                x.District.ToLowerInvariant().Contains(q) ||
                x.Division.ToLowerInvariant().Contains(q) ||
                (x.LocalBody ?? "").ToLowerInvariant().Contains(q) ||
                (x.LocalBodyName ?? "").ToLowerInvariant().Contains(q) ||
                (x.Block ?? "").ToLowerInvariant().Contains(q) ||
                (x.VillagePanchayat ?? "").ToLowerInvariant().Contains(q) ||
                (x.TownPanchayat ?? "").ToLowerInvariant().Contains(q) ||
                (x.Municipality ?? "").ToLowerInvariant().Contains(q) ||
                (x.Corporation ?? "").ToLowerInvariant().Contains(q));
        }

        return filtered.ToList();
    }
}
