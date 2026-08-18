-- Scheduler Jobs table for dynamic project API scheduling
CREATE TABLE IF NOT EXISTS scheduler_job (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_name          VARCHAR(100) NOT NULL,
  project           VARCHAR(50) NOT NULL,
  api_url           VARCHAR(500) NOT NULL,
  http_method       VARCHAR(10) NOT NULL DEFAULT 'POST',
  payload           TEXT NULL,
  cron_expression   VARCHAR(100) NOT NULL DEFAULT '11 23 * * *',
  is_active         TINYINT NOT NULL DEFAULT 1,
  last_run_time     DATETIME NULL,
  last_run_status   VARCHAR(50) NULL,
  last_run_message  TEXT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO scheduler_job (id, job_name, project, api_url, http_method, payload, cron_expression, is_active)
VALUES
(1, 'Tender Nightly Sync', 'TIPS', 'http://testtime.tahdco.com:8080/api/Dashboard/Get_Mbook_Tender_Status', 'POST', '{"divisionIds":[],"districtIds":[],"contractorId":"","departmentIds":[],"year":["2023","2024","2025","2026"],"selectionType":"count","costOrCount":"count"}', '11 23 * * *', 1),
(2, 'Patrol360 Nightly Sync', 'Patrol360', 'http://testtime.tahdco.com:8080/api/Dashboard/Get_Mbook_Tender_Status', 'POST', '{"divisionIds":[],"districtIds":[],"contractorId":"","departmentIds":[],"year":["2023","2024","2025","2026"],"selectionType":"count","costOrCount":"count"}', '11 23 * * *', 1);
