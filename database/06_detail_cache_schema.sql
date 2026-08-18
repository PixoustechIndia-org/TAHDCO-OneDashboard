-- ============================================================================
-- DB Migration 06: Click-Driven COUNT/DETAIL Cache (stale-while-revalidate)
-- Modules: TELP, TAHDCO Scheme, TIME+Patrol360, THMS, TAMS, One Portal (Member),
--          One Portal (Scheme)
--
-- Purpose: persist the last successful response for every distinct
-- (module, operation, clickContext) combination so that a DETAIL/COUNT API
-- failure NEVER destroys previously-stored data. See BAL/Service/DetailCacheService.cs
-- for the exact fresh/stale/no-cache algorithm that reads and writes these tables.
--
-- This is deliberately separate from `unified_project_data` (migration 05), which
-- is a bulk background ingestion mirror used by the RAG/AI copilot. This table
-- set is the interactive, click-driven cache behind the COUNT DataTable -> DETAIL
-- drill-down flow and is keyed far more granularly (per clicked cell, not per
-- project sync batch).
-- ============================================================================

CREATE TABLE IF NOT EXISTS detail_api_cache (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    module            VARCHAR(40)  NOT NULL,          -- TELP | TAHDCO_SCHEME | TIME_PATROL360 | THMS | TAMS | ONE_PORTAL_MEMBER | ONE_PORTAL_SCHEME
    operation         VARCHAR(10)  NOT NULL,          -- COUNT | DETAIL
    cache_key         VARCHAR(300) NOT NULL,          -- deterministic key, see IDashboardModuleAdapter.GetCacheKey()
    request_hash      CHAR(64)     NOT NULL,           -- SHA-256 of the normalized request payload (integrity/dedup check)
    request_payload   JSON             NULL,           -- the exact payload/query sent to the external API (no secrets/tokens)
    response_data     LONGTEXT         NULL,           -- raw external API response (for audit/replay) — nullable so a row can exist pre-first-success
    normalized_data   JSON             NULL,           -- normalized internal model (NormalizedCountDto[] / NormalizedDetailDto[])
    record_count      INT UNSIGNED NOT NULL DEFAULT 0,
    fetched_at        DATETIME         NULL,           -- last attempt (success or failure)
    last_success_at   DATETIME         NULL,           -- last time this cache_key was successfully refreshed from the live API
    expires_at        DATETIME         NULL,           -- fetched_at + module TTL (DataFreshnessPolicy); NULL = never considered fresh
    status             VARCHAR(12) NOT NULL DEFAULT 'EMPTY', -- FRESH | STALE | API_FAILED | EMPTY
    is_stale          TINYINT(1)   NOT NULL DEFAULT 0,
    api_version       VARCHAR(20)      NULL,
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cache_key (cache_key),
    INDEX idx_module_operation (module, operation),
    INDEX idx_status (status),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS detail_api_records (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cache_id          BIGINT UNSIGNED NOT NULL,
    module            VARCHAR(40)  NOT NULL,
    district          VARCHAR(100)     NULL,
    division          VARCHAR(100)     NULL,
    metric            VARCHAR(80)      NULL,          -- e.g. IN_PROGRESS, statusSavedCount, HqPending — the clicked category
    record_data       JSON         NOT NULL,           -- one normalized detail row (small enough to index/filter without re-parsing the whole cache blob)
    search_text       TEXT             NULL,           -- flattened text of record_data for keyword/RAG retrieval (see DetailRecordRetrievalService)
    source_timestamp  DATETIME         NULL,           -- timestamp the source system reported for this record, if any
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dar_cache FOREIGN KEY (cache_id) REFERENCES detail_api_cache (id) ON DELETE CASCADE,
    INDEX idx_module_district (module, district),
    INDEX idx_module_metric (module, metric),
    INDEX idx_cache (cache_id),
    FULLTEXT INDEX ft_search_text (search_text)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_fetch_log (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    correlation_id    CHAR(36)     NOT NULL,
    module            VARCHAR(40)  NOT NULL,
    operation         VARCHAR(10)  NOT NULL,          -- COUNT | DETAIL
    cache_key         VARCHAR(300)     NULL,
    request_payload   JSON             NULL,           -- no secrets/tokens/authorization headers ever logged here
    started_at        DATETIME(3)  NOT NULL,
    completed_at      DATETIME(3)      NULL,
    http_status       INT              NULL,
    success           TINYINT(1)   NOT NULL DEFAULT 0,
    error_message     VARCHAR(500)     NULL,           -- sanitized message only — never a raw stack trace
    response_time_ms  INT              NULL,
    fallback_used     TINYINT(1)   NOT NULL DEFAULT 0,
    retry_count       INT UNSIGNED NOT NULL DEFAULT 0,
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_module_operation_log (module, operation),
    INDEX idx_correlation (correlation_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
