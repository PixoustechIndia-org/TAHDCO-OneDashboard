-- ============================================================================
-- TAHDCO UDP — MySQL / MariaDB schema  (MySQL 8.0+ / MariaDB 10.6+)
-- Grain matches the workbook: district / institute / scheme level count rows,
-- keyed by financial year so multiple FYs coexist.
-- Run order: 01_schema.sql  →  02_seed_data.sql
-- ============================================================================

-- CREATE DATABASE IF NOT EXISTS tahdco_udp
--   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tahdco_udp;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS user_privilege, housing_infra, monthly_completion, enroll_gender, patrol_offline,
  patrol_district, tod_district, member_district, scheme_fy, scheme_master,
  enroll_institute, institute, housing_district, tender_district,
  app_user, district, division, financial_year, local_body_mapping;
SET FOREIGN_KEY_CHECKS = 1;

-- ── Dimensions ──────────────────────────────────────────────────────────────

CREATE TABLE financial_year (
  fy_id   TINYINT UNSIGNED PRIMARY KEY,
  label   VARCHAR(20) NOT NULL UNIQUE            -- 'FY 2025-26'
) ENGINE=InnoDB;

CREATE TABLE division (
  division_id  TINYINT UNSIGNED PRIMARY KEY,
  name         VARCHAR(40) NOT NULL UNIQUE       -- 9 divisions
) ENGINE=InnoDB;

CREATE TABLE district (
  district_id  SMALLINT UNSIGNED PRIMARY KEY,
  division_id  TINYINT UNSIGNED NOT NULL,
  name         VARCHAR(60) NOT NULL,             -- 36 districts
  CONSTRAINT fk_district_division FOREIGN KEY (division_id) REFERENCES division (division_id),
  UNIQUE KEY ux_district_name (name),
  KEY ix_district_division (division_id)         -- read index: division roll-ups
) ENGINE=InnoDB;

-- ── Auth ────────────────────────────────────────────────────────────────────

CREATE TABLE app_user (
  user_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(80)  NOT NULL,
  email         VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL,           -- BCrypt hash (self-salted). Legacy rows may still
                                                   -- hold SHA-256(password + salt) hex until the account's
                                                   -- next login, when AuthService migrates it to BCrypt.
  password_salt VARCHAR(64)  NOT NULL,           -- only used to verify not-yet-migrated legacy hashes; '' once migrated
  role          VARCHAR(20)  NOT NULL,           -- ee | gm | md | secretary | admin
  scope         VARCHAR(20)  NOT NULL DEFAULT 'all',   -- all | division | district
  division_id   TINYINT UNSIGNED NULL,
  district_id   SMALLINT UNSIGNED NULL,                -- set for District Manager (dm) logins
  app_access    VARCHAR(255) NOT NULL,           -- CSV: TIPS,THMS,TAMS,...
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  last_login    DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_division FOREIGN KEY (division_id) REFERENCES division (division_id),
  CONSTRAINT fk_user_district FOREIGN KEY (district_id) REFERENCES district (district_id)
) ENGINE=InnoDB;

-- Per-user, per-project privilege flags (Create / Edit / Update / Delete / View)
CREATE TABLE user_privilege (
  user_id    INT UNSIGNED NOT NULL,
  project    VARCHAR(20)  NOT NULL,        -- TIPS|TIME|THMS|TAMS|Scheme|TELP|OnePortal|TOD|Patrol360
  can_view   TINYINT(1) NOT NULL DEFAULT 0,
  can_create TINYINT(1) NOT NULL DEFAULT 0,
  can_edit   TINYINT(1) NOT NULL DEFAULT 0,
  can_update TINYINT(1) NOT NULL DEFAULT 0,
  can_delete TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, project),
  CONSTRAINT fk_priv_user FOREIGN KEY (user_id) REFERENCES app_user (user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Tender (TIPS + TIME): one row per district per FY ──────────────────────

CREATE TABLE tender_district (
  fy_id           TINYINT UNSIGNED  NOT NULL,
  district_id     SMALLINT UNSIGNED NOT NULL,
  total_works     INT UNSIGNED NOT NULL,
  started         INT UNSIGNED NOT NULL,
  not_started     INT UNSIGNED NOT NULL,
  in_progress     INT UNSIGNED NOT NULL,
  completed       INT UNSIGNED NOT NULL,
  slow_progress   INT UNSIGNED NOT NULL,
  mbook_total     INT UNSIGNED NOT NULL,
  mbook_uploaded  INT UNSIGNED NOT NULL,
  mbook_pending   INT UNSIGNED NOT NULL,
  no_action       INT UNSIGNED NOT NULL,
  payment_pending INT UNSIGNED NOT NULL,
  PRIMARY KEY (fy_id, district_id),              -- group index: fy → district
  KEY ix_tender_fy_district (fy_id, district_id, in_progress, slow_progress,
      not_started, payment_pending),             -- covering read index
  CONSTRAINT fk_td_fy   FOREIGN KEY (fy_id)       REFERENCES financial_year (fy_id),
  CONSTRAINT fk_td_dist FOREIGN KEY (district_id) REFERENCES district (district_id)
) ENGINE=InnoDB;

-- ── Housing (THMS): one row per participating district per FY ──────────────

CREATE TABLE housing_district (          -- one row per district PER PHASE (real THMS API grain)
  fy_id         TINYINT UNSIGNED  NOT NULL,
  district_id   SMALLINT UNSIGNED NOT NULL,
  phase         VARCHAR(20) NOT NULL,
  total_houses  INT UNSIGNED NOT NULL,
  started       INT UNSIGNED NOT NULL,
  not_started   INT UNSIGNED NOT NULL,
  completed     INT UNSIGNED NOT NULL,
  grad_beam     INT UNSIGNED NOT NULL,
  basement      INT UNSIGNED NOT NULL,
  lintel_level  INT UNSIGNED NOT NULL,
  roof_level    INT UNSIGNED NOT NULL,
  completion    INT UNSIGNED NOT NULL,
  PRIMARY KEY (fy_id, district_id, phase),
  KEY ix_housing_phase (fy_id, phase),
  CONSTRAINT fk_hd_fy   FOREIGN KEY (fy_id)       REFERENCES financial_year (fy_id),
  CONSTRAINT fk_hd_dist FOREIGN KEY (district_id) REFERENCES district (district_id)
) ENGINE=InnoDB;

CREATE TABLE housing_infra (               -- infrastructure area split per FY (from THMS design)
  fy_id       TINYINT UNSIGNED PRIMARY KEY,
  hill_area   INT UNSIGNED NOT NULL,
  others_area INT UNSIGNED NOT NULL,
  plain_area  INT UNSIGNED NOT NULL,
  CONSTRAINT fk_hi_fy FOREIGN KEY (fy_id) REFERENCES financial_year (fy_id)
) ENGINE=InnoDB;

-- ── Enrollment (TAMS) ───────────────────────────────────────────────────────

CREATE TABLE institute (
  institute_id  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  district_id   SMALLINT UNSIGNED NOT NULL,
  name          VARCHAR(120) NOT NULL,
  CONSTRAINT fk_inst_dist FOREIGN KEY (district_id) REFERENCES district (district_id),
  KEY ix_institute_name (name)                   -- search index (prefix LIKE)
) ENGINE=InnoDB;

CREATE TABLE enroll_institute (
  fy_id          TINYINT UNSIGNED NOT NULL,
  institute_id   INT UNSIGNED     NOT NULL,
  course         VARCHAR(80)  NOT NULL,
  status         ENUM('Ongoing','Completed') NOT NULL,
  total_students INT UNSIGNED NOT NULL,
  present        INT UNSIGNED NOT NULL,
  attendance_pct DECIMAL(5,1) NOT NULL,
  grade          ENUM('Excellent','Good','Average','Poor') NOT NULL,
  PRIMARY KEY (fy_id, institute_id),
  KEY ix_enroll_course (fy_id, course),
  CONSTRAINT fk_ei_fy   FOREIGN KEY (fy_id)        REFERENCES financial_year (fy_id),
  CONSTRAINT fk_ei_inst FOREIGN KEY (institute_id) REFERENCES institute (institute_id)
) ENGINE=InnoDB;

CREATE TABLE enroll_gender (       -- per-FY gender split (not derivable per row)
  fy_id   TINYINT UNSIGNED PRIMARY KEY,
  male    INT UNSIGNED NOT NULL,
  female  INT UNSIGNED NOT NULL,
  others  INT UNSIGNED NOT NULL,
  CONSTRAINT fk_eg_fy FOREIGN KEY (fy_id) REFERENCES financial_year (fy_id)
) ENGINE=InnoDB;

CREATE TABLE monthly_completion (  -- illustrative monthly trend per FY
  fy_id       TINYINT UNSIGNED NOT NULL,
  month_no    TINYINT UNSIGNED NOT NULL,   -- 1..12 within FY (Apr=1)
  month_label VARCHAR(10) NOT NULL,
  completed   INT UNSIGNED NOT NULL,
  PRIMARY KEY (fy_id, month_no),
  CONSTRAINT fk_mc_fy FOREIGN KEY (fy_id) REFERENCES financial_year (fy_id)
) ENGINE=InnoDB;

-- ── Welfare schemes (TAHDCO Scheme / TELP / ONO PORTAL) ─────────────────────

CREATE TABLE scheme_master (       -- from the 'scheme list' master sheet
  scheme_id   INT UNSIGNED PRIMARY KEY,
  project     VARCHAR(40)  NOT NULL,        -- 'TAHDCO Scheme' | 'TELP' | 'ONO PORTAL'
  scheme_name VARCHAR(80)  NOT NULL,
  sub_scheme  VARCHAR(200) NULL,
  KEY ix_scheme_project (project, scheme_name)   -- read index: project filter
) ENGINE=InnoDB;

CREATE TABLE scheme_fy (           -- per-FY counters per scheme
  fy_id           TINYINT UNSIGNED NOT NULL,
  scheme_id       INT UNSIGNED     NOT NULL,
  apply_cnt       INT UNSIGNED NOT NULL,
  dm_pending      INT UNSIGNED NOT NULL,
  hq_pending      INT UNSIGNED NOT NULL,
  payment_pending INT UNSIGNED NOT NULL,
  PRIMARY KEY (fy_id, scheme_id),
  CONSTRAINT fk_sf_fy     FOREIGN KEY (fy_id)     REFERENCES financial_year (fy_id),
  CONSTRAINT fk_sf_scheme FOREIGN KEY (scheme_id) REFERENCES scheme_master (scheme_id)
) ENGINE=InnoDB;

-- ── One Portal member cards: one row per district per FY ────────────────────

CREATE TABLE member_district (
  fy_id            TINYINT UNSIGNED  NOT NULL,
  district_id      SMALLINT UNSIGNED NOT NULL,
  total_works      INT UNSIGNED NOT NULL,
  save_cnt         INT UNSIGNED NOT NULL,
  dm_pending       INT UNSIGNED NOT NULL,
  hq_pending       INT UNSIGNED NOT NULL,
  card_in_progress INT UNSIGNED NOT NULL,
  card_issued      INT UNSIGNED NOT NULL,
  PRIMARY KEY (fy_id, district_id),
  CONSTRAINT fk_md_fy   FOREIGN KEY (fy_id)       REFERENCES financial_year (fy_id),
  CONSTRAINT fk_md_dist FOREIGN KEY (district_id) REFERENCES district (district_id)
) ENGINE=InnoDB;

-- ── TOD tasks: one row per district per FY ──────────────────────────────────

CREATE TABLE tod_district (
  fy_id       TINYINT UNSIGNED  NOT NULL,
  district_id SMALLINT UNSIGNED NOT NULL,
  task_type   VARCHAR(60) NOT NULL,
  task_count  INT UNSIGNED NOT NULL,
  not_started INT UNSIGNED NOT NULL,
  in_progress INT UNSIGNED NOT NULL,
  completed   INT UNSIGNED NOT NULL,
  overdue     INT UNSIGNED NOT NULL,
  PRIMARY KEY (fy_id, district_id),
  CONSTRAINT fk_tod_fy   FOREIGN KEY (fy_id)       REFERENCES financial_year (fy_id),
  CONSTRAINT fk_tod_dist FOREIGN KEY (district_id) REFERENCES district (district_id)
) ENGINE=InnoDB;

-- ── Patrol360: one row per district per FY + per-FY offline buckets ─────────

CREATE TABLE patrol_district (
  fy_id            TINYINT UNSIGNED  NOT NULL,
  district_id      SMALLINT UNSIGNED NOT NULL,
  total_works      INT UNSIGNED NOT NULL,
  started          INT UNSIGNED NOT NULL,
  not_started      INT UNSIGNED NOT NULL,
  in_progress      INT UNSIGNED NOT NULL,
  completed        INT UNSIGNED NOT NULL,
  camera_installed INT UNSIGNED NOT NULL,
  current_active   INT UNSIGNED NOT NULL,
  current_inactive INT UNSIGNED NOT NULL,
  PRIMARY KEY (fy_id, district_id),
  CONSTRAINT fk_pd_fy   FOREIGN KEY (fy_id)       REFERENCES financial_year (fy_id),
  CONSTRAINT fk_pd_dist FOREIGN KEY (district_id) REFERENCES district (district_id)
) ENGINE=InnoDB;

CREATE TABLE patrol_offline (
  fy_id             TINYINT UNSIGNED PRIMARY KEY,
  less_than_2_days  INT UNSIGNED NOT NULL,
  days_3_to_10      INT UNSIGNED NOT NULL,
  more_than_10_days INT UNSIGNED NOT NULL,
  CONSTRAINT fk_po_fy FOREIGN KEY (fy_id) REFERENCES financial_year (fy_id)
) ENGINE=InnoDB;

CREATE TABLE local_body_mapping (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sno               INT,
  state             VARCHAR(100),
  division          VARCHAR(100),
  district          VARCHAR(100),
  local_body        VARCHAR(100),
  local_body_name   VARCHAR(200),
  block             VARCHAR(100),
  village_panchayat VARCHAR(150),
  corporation       VARCHAR(150),
  town_panchayat    VARCHAR(150),
  municipality      VARCHAR(150),
  gcc               VARCHAR(100),
  cmwssb            VARCHAR(150)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: Hangfire (Hangfire.MySqlStorage) and Serilog (Serilog.Sinks.MariaDB)
-- create their own tables (hangfire_*, app_logs) automatically on first run.
