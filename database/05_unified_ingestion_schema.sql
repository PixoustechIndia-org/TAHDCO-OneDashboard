-- ============================================================================
-- DB Migration 05: Unified Multi-Project Ingestion Data Store & Audit Log
-- Projects: TELP, TAHDCO Scheme, TIPS+TIME+Patrol360, THMS, TAMS, One Portal, TOD
-- ============================================================================

CREATE TABLE IF NOT EXISTS unified_project_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_name VARCHAR(100) NOT NULL,
    source_api VARCHAR(255) NOT NULL,
    record_id VARCHAR(100),
    district VARCHAR(100),
    division VARCHAR(100),
    status VARCHAR(100),
    year VARCHAR(20),
    beneficiary_name VARCHAR(255),
    scheme_name VARCHAR(255),
    created_date DATETIME,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    raw_json TEXT,
    normalized_text TEXT,
    INDEX idx_project_district (project_name, district),
    INDEX idx_status (status),
    INDEX idx_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ingestion_audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sync_batch_id VARCHAR(64) NOT NULL,
    project_name VARCHAR(100) NOT NULL,
    source_api VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL, -- Success, Failed, Cached
    records_count INT DEFAULT 0,
    duration_ms INT DEFAULT 0,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
