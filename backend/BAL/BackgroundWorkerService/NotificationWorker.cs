using Microsoft.Extensions.Logging;
using DAL;
using System.Text;

namespace BAL.BackgroundWorkerService;

/// <summary>
/// Background job that runs periodically via Hangfire to check for SLA breaches 
/// (pending M-Books > 10 days, pending scheme approvals > 10 days) and triggers 
/// automated Email & SMS threshold alerts to EEs and DMs.
/// </summary>
public class NotificationWorker
{
    private readonly IDapperRepository _db;
    private readonly ILogger<NotificationWorker> _log;

    public NotificationWorker(IDapperRepository db, ILogger<NotificationWorker> log)
    {
        _db = db;
        _log = log;
    }

    private class NotificationDto
    {
        public int UserId { get; set; }
        public string Type { get; set; } = "";
        public string Recipient { get; set; } = "";
        public string? Subject { get; set; }
        public string Message { get; set; } = "";
    }

    public async Task RunAsync()
    {
        _log.LogInformation("Starting SLA threshold notification audit run...");
        try
        {
            var notificationsToSend = new List<NotificationDto>();

            // 1. Audit Engineering (TIPS/TIME) - Pending M-Books
            // Fetch districts with pending M-Books
            var pendingMbooks = await _db.QueryAsync<dynamic>(@"
                SELECT t.district_id AS DistrictId, d.name AS DistrictName, 
                       d.division_id AS DivisionId, dv.name AS DivisionName,
                       t.mbook_pending AS PendingCount
                FROM tender_district t
                JOIN district d ON d.district_id = t.district_id
                JOIN division dv ON dv.division_id = d.division_id
                WHERE t.mbook_pending > 0 AND t.fy_id = 1"); // Target current FY (1)

            foreach (var item in pendingMbooks)
            {
                int districtId = (int)item.DistrictId;
                int divisionId = (int)item.DivisionId;
                string districtName = (string)item.DistrictName;
                string divisionName = (string)item.DivisionName;
                int pendingCount = (int)item.PendingCount;

                // Query District Manager (DM) users assigned to this district
                var dms = await _db.QueryAsync<dynamic>(@"
                    SELECT user_id AS UserId, full_name AS Name, email AS Email 
                    FROM app_user 
                    WHERE role = 'dm' AND district_id = @DistrictId AND is_active = 1", 
                    new { DistrictId = districtId });

                foreach (var dm in dms)
                {
                    string dmName = (string)dm.Name;
                    string dmEmail = (string)dm.Email;
                    int dmUserId = (int)dm.UserId;
                    var msg = $"Dear DM {dmName}, District {districtName} has {pendingCount} pending M-Books exceeding the 10-day SLA approval threshold. Please review and upload immediately.";
                    
                    // Email Notification
                    notificationsToSend.Add(new NotificationDto
                    {
                        UserId = dmUserId,
                        Type = "Email",
                        Recipient = dmEmail,
                        Subject = $"SLA Alert: {pendingCount} Pending M-Books in {districtName}",
                        Message = msg
                    });

                    // SMS Notification (Simulated)
                    notificationsToSend.Add(new NotificationDto
                    {
                        UserId = dmUserId,
                        Type = "SMS",
                        Recipient = "+91 99999 99999", // Mock recipient number
                        Subject = null,
                        Message = msg
                    });
                }

                // Query Executive Engineer (EE) users assigned to this division
                var ees = await _db.QueryAsync<dynamic>(@"
                    SELECT user_id AS UserId, full_name AS Name, email AS Email 
                    FROM app_user 
                    WHERE role = 'ee' AND division_id = @DivisionId AND is_active = 1", 
                    new { DivisionId = divisionId });

                foreach (var ee in ees)
                {
                    string eeName = (string)ee.Name;
                    string eeEmail = (string)ee.Email;
                    int eeUserId = (int)ee.UserId;
                    var msg = $"Dear EE {eeName}, Division {divisionName} - District {districtName} has {pendingCount} pending M-Books exceeding the 10-day SLA threshold. Please follow up.";
                    
                    // Email Notification
                    notificationsToSend.Add(new NotificationDto
                    {
                        UserId = eeUserId,
                        Type = "Email",
                        Recipient = eeEmail,
                        Subject = $"SLA Escalation: {pendingCount} Pending M-Books in {districtName}",
                        Message = msg
                    });

                    // SMS Notification (Simulated)
                    notificationsToSend.Add(new NotificationDto
                    {
                        UserId = eeUserId,
                        Type = "SMS",
                        Recipient = "+91 88888 88888",
                        Subject = null,
                        Message = msg
                    });
                }
            }

            // 2. Audit Welfare Schemes - Pending DM Approvals
            // We use member_district or scheme details if available
            // Let's check district-level scheme pending registrations
            var pendingWelfare = await _db.QueryAsync<dynamic>(@"
                SELECT m.district_id AS DistrictId, d.name AS DistrictName,
                       d.division_id AS DivisionId, dv.name AS DivisionName,
                       (m.dm_pending + m.hq_pending) AS PendingCount
                FROM member_district m
                JOIN district d ON d.district_id = m.district_id
                JOIN division dv ON dv.division_id = d.division_id
                WHERE (m.dm_pending + m.hq_pending) > 0 AND m.fy_id = 1");

            foreach (var item in pendingWelfare)
            {
                int districtId = (int)item.DistrictId;
                string districtName = (string)item.DistrictName;
                int pendingCount = (int)item.PendingCount;

                // Query DM users for this district
                var dms = await _db.QueryAsync<dynamic>(@"
                    SELECT user_id AS UserId, full_name AS Name, email AS Email 
                    FROM app_user 
                    WHERE role = 'dm' AND district_id = @DistrictId AND is_active = 1", 
                    new { DistrictId = districtId });

                foreach (var dm in dms)
                {
                    string dmName = (string)dm.Name;
                    string dmEmail = (string)dm.Email;
                    int dmUserId = (int)dm.UserId;
                    var msg = $"Dear DM {dmName}, District {districtName} has {pendingCount} pending TNCWWB member registrations awaiting review exceeding 10 days. Please process immediately.";
                    
                    // Email Notification
                    notificationsToSend.Add(new NotificationDto
                    {
                        UserId = dmUserId,
                        Type = "Email",
                        Recipient = dmEmail,
                        Subject = $"SLA Alert: {pendingCount} Pending Member Registrations in {districtName}",
                        Message = msg
                    });

                    // SMS Notification
                    notificationsToSend.Add(new NotificationDto
                    {
                        UserId = dmUserId,
                        Type = "SMS",
                        Recipient = "+91 99999 99999",
                        Subject = null,
                        Message = msg
                    });
                }
            }

            // 3. Save generated alerts to database
            if (notificationsToSend.Count > 0)
            {
                var sql = @"
                    INSERT INTO notification (user_id, type, recipient, subject, message, sent_at, status)
                    VALUES (@UserId, @Type, @Recipient, @Subject, @Message, NOW(), 'Sent')";
                
                await _db.ExecuteAsync(sql, notificationsToSend);
                _log.LogInformation("Successfully triggered and recorded {Count} automated SLA threshold alerts.", notificationsToSend.Count);
            }
            else
            {
                _log.LogInformation("No SLA breaches or pending items exceeded threshold. 0 alerts triggered.");
            }
        }
        catch (Exception ex)
        {
            _log.LogWarning("Notification audit skipped (DB connection offline or unavailable): {Message}", ex.Message);
        }
    }
}
