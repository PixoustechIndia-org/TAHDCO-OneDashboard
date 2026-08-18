-- ============================================================================
-- TAHDCO Unified Dashboard Platform (UDP)
-- Production Database Indexing & Query Optimization Script
-- Strategy: Composite (Group) Indexing, SET (Write) & GET (Read) Optimization
-- Engine: MySQL 8.0 / InnoDB
-- ============================================================================

USE `tahdco_udp`;

-- ----------------------------------------------------------------------------
-- 1. `app_user` (Authentication, Session Lookup & Role Hierarchy)
-- GET Optimization: Instant login by email, active status filtering, role hierarchy
-- SET Optimization: Minimal redundant indexes to keep user upsert/update lightweight
-- ----------------------------------------------------------------------------
-- Composite index for fast email login + active check
CREATE INDEX IF NOT EXISTS `idx_app_user_email_active` 
ON `app_user` (`email`, `is_active`);

-- Composite index for role-based authorization and dashboard scope filtering
CREATE INDEX IF NOT EXISTS `idx_app_user_role_scope` 
ON `app_user` (`role`, `scope`);

-- Composite index for division/district user filtering (EE and DM lookups)
CREATE INDEX IF NOT EXISTS `idx_app_user_div_dist` 
ON `app_user` (`division_id`, `district_id`, `is_active`);


-- ----------------------------------------------------------------------------
-- 2. `user_privilege` (Granular Project Permission Checks)
-- GET Optimization: Fast composite key lookup (user_id + project) during request routing
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS `idx_user_priv_lookup` 
ON `user_privilege` (`user_id`, `project`, `can_view`);


-- ----------------------------------------------------------------------------
-- 3. `detail_api_cache` (API Response Cache & Staleness Management)
-- GET Optimization: O(1) Cache key lookup and expired cache eviction sweeps
-- SET Optimization: Optimized for high-frequency scheduler cache overwrites
-- ----------------------------------------------------------------------------
-- Composite index for module + operation cache lookups
CREATE INDEX IF NOT EXISTS `idx_cache_module_op` 
ON `detail_api_cache` (`module`, `operation`, `status`);

-- Composite index for staleness and TTL cache expiry workers
CREATE INDEX IF NOT EXISTS `idx_cache_status_expires` 
ON `detail_api_cache` (`status`, `expires_at`, `is_stale`);

-- Composite index for request hash deduplication
CREATE INDEX IF NOT EXISTS `idx_cache_key_hash` 
ON `detail_api_cache` (`cache_key`, `request_hash`);


-- ----------------------------------------------------------------------------
-- 4. `detail_api_records` (High-Volume Normalized Operational Records)
-- GET Optimization: Multi-column drill-down by (module, division, district, metric)
-- Full-Text Optimization: Fast fuzzy search across record content
-- ----------------------------------------------------------------------------
-- Group / Composite index for hierarchical geographical drilldowns
CREATE INDEX IF NOT EXISTS `idx_records_mod_div_dist` 
ON `detail_api_records` (`module`, `division`, `district`);

-- Group / Composite index for metric filtering per cache partition
CREATE INDEX IF NOT EXISTS `idx_records_cache_metric` 
ON `detail_api_records` (`cache_id`, `metric`);

-- Fulltext index for high-speed textual search queries
CREATE FULLTEXT INDEX IF NOT EXISTS `idx_records_search_text` 
ON `detail_api_records` (`search_text`);


-- ----------------------------------------------------------------------------
-- 5. `api_fetch_log` (Scheduler & Integration Telemetry Logs)
-- GET Optimization: Dashboard history tab, date-range filtering, failure tracking
-- ----------------------------------------------------------------------------
-- Composite index for module-specific historical queries and date ranges
CREATE INDEX IF NOT EXISTS `idx_fetchlog_mod_date` 
ON `api_fetch_log` (`module`, `started_at`);

-- Composite index for SLA failure audits and monitoring alerts
CREATE INDEX IF NOT EXISTS `idx_fetchlog_status_date` 
ON `api_fetch_log` (`success`, `started_at`);

-- Index for correlation ID tracing across distributed logs
CREATE INDEX IF NOT EXISTS `idx_fetchlog_correlation` 
ON `api_fetch_log` (`correlation_id`);


-- ----------------------------------------------------------------------------
-- 6. `local_body_mapping` (Local Governance Hierarchy: Division > District > Block > Panchayat)
-- GET Optimization: Multi-level cascade dropdowns and search filtering
-- ----------------------------------------------------------------------------
-- Group / Composite index for division -> district -> type filtering
CREATE INDEX IF NOT EXISTS `idx_lbm_div_dist_type` 
ON `local_body_mapping` (`division`, `district`, `local_body_type`);

-- Composite index for block and panchayat name search
CREATE INDEX IF NOT EXISTS `idx_lbm_block_panchayat` 
ON `local_body_mapping` (`block_name`, `village_panchayat_name`);

-- Composite index for district and taluk search
CREATE INDEX IF NOT EXISTS `idx_lbm_dist_taluk` 
ON `local_body_mapping` (`district`, `taluk_name`);


-- ----------------------------------------------------------------------------
-- 7. `district` & `division` (Master Geography Tables)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS `idx_district_div_id` 
ON `district` (`division_id`, `name`);


-- ----------------------------------------------------------------------------
-- 8. `audit_log` / `sla_threshold_log` (Compliance & Security Audit Trail)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS `idx_audit_user_time` 
ON `audit_log` (`user_id`, `timestamp`);

CREATE INDEX IF NOT EXISTS `idx_audit_action_time` 
ON `audit_log` (`action`, `timestamp`);

-- ============================================================================
-- Verification Query: Check Table Index Cardinality and Health
-- ============================================================================
SELECT 
    table_name AS `Table`,
    index_name AS `Index`,
    GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ', ') AS `Columns`,
    non_unique AS `Non-Unique`,
    cardinality AS `Cardinality`
FROM information_schema.statistics
WHERE table_schema = 'tahdco_udp'
GROUP BY table_name, index_name, non_unique, cardinality
ORDER BY table_name, index_name;
