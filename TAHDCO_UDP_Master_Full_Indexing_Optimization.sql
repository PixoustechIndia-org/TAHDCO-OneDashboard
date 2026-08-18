-- ============================================================================
-- TAHDCO UNIFIED DASHBOARD PLATFORM (UDP)
-- PRODUCTION DATABASE FULL INDEXING & QUERY OPTIMIZATION SCRIPT
-- ============================================================================
-- Compatible with: MySQL 8.0+, MariaDB 10.4+, phpMyAdmin, DBeaver, Workbench
-- Safe Import: No information_schema queries, No permission errors
-- ============================================================================

USE `tahdco_udp`;

-- ============================================================================
-- 1. AUTHENTICATION & ACCESS CONTROL (`app_user`, `user_privilege`)
-- ============================================================================

-- Fast login authentication: (email, is_active)
CREATE INDEX IF NOT EXISTS `idx_app_user_email_active` 
ON `app_user` (`email`, `is_active`);

-- Role-based authorization & scope filtering: (role, scope, is_active)
CREATE INDEX IF NOT EXISTS `idx_app_user_role_scope` 
ON `app_user` (`role`, `scope`, `is_active`);

-- Division/District hierarchy lookups: (division_id, district_id, is_active)
CREATE INDEX IF NOT EXISTS `idx_app_user_div_dist` 
ON `app_user` (`division_id`, `district_id`, `is_active`);

-- Covering index for instant project privilege lookups
CREATE INDEX IF NOT EXISTS `idx_user_priv_covering` 
ON `user_privilege` (`user_id`, `project`, `can_view`, `can_create`, `can_edit`, `can_update`, `can_delete`);


-- ============================================================================
-- 2. GEOGRAPHIES & LOCAL BODY HIERARCHY
-- ============================================================================

-- Fast division-to-district cascade lookup
CREATE INDEX IF NOT EXISTS `idx_district_div_id_name` 
ON `district` (`division_id`, `name`);

-- Local Body Mapping: Cascading dropdowns & multi-level geographic filtering
CREATE INDEX IF NOT EXISTS `idx_lbm_div_dist_type` 
ON `local_body_mapping` (`division`, `district`, `local_body`);

-- Local Body Mapping: Block & Village Panchayat lookups
CREATE INDEX IF NOT EXISTS `idx_lbm_block_panchayat` 
ON `local_body_mapping` (`block`, `village_panchayat`);

-- Local Body Mapping: Multi-tier name search
CREATE INDEX IF NOT EXISTS `idx_lbm_dist_name` 
ON `local_body_mapping` (`district`, `local_body_name`);


-- ============================================================================
-- 3. INGESTION, CACHE & LOGGING SUBSYSTEM
-- ============================================================================

-- Detail API Cache: (module, operation, status)
CREATE INDEX IF NOT EXISTS `idx_cache_module_op_status` 
ON `detail_api_cache` (`module`, `operation`, `status`);

-- Detail API Cache: Staleness and TTL Expiry Sweeper
CREATE INDEX IF NOT EXISTS `idx_cache_status_expires` 
ON `detail_api_cache` (`status`, `expires_at`, `is_stale`);

-- Detail API Cache: Deduplication hash lookup
CREATE INDEX IF NOT EXISTS `idx_cache_key_hash` 
ON `detail_api_cache` (`cache_key`, `request_hash`);

-- Detail API Records: Hierarchical geographic drill-down
CREATE INDEX IF NOT EXISTS `idx_records_mod_div_dist` 
ON `detail_api_records` (`module`, `division`, `district`);

-- Detail API Records: Cache metric filter
CREATE INDEX IF NOT EXISTS `idx_records_cache_metric` 
ON `detail_api_records` (`cache_id`, `metric`);

-- Detail API Records: District metric filter
CREATE INDEX IF NOT EXISTS `idx_records_district_metric` 
ON `detail_api_records` (`district`, `metric`);

-- Detail API Records: Fulltext search across record text
CREATE FULLTEXT INDEX IF NOT EXISTS `idx_records_search_fulltext` 
ON `detail_api_records` (`search_text`);

-- API Fetch Log: Module-specific date range queries
CREATE INDEX IF NOT EXISTS `idx_fetchlog_mod_started` 
ON `api_fetch_log` (`module`, `started_at`);

-- API Fetch Log: SLA Success/Failure status & time
CREATE INDEX IF NOT EXISTS `idx_fetchlog_status_started` 
ON `api_fetch_log` (`success`, `started_at`);

-- API Fetch Log: Distributed correlation tracing
CREATE INDEX IF NOT EXISTS `idx_fetchlog_correlation` 
ON `api_fetch_log` (`correlation_id`);

-- API Fetch Log: Created At range scan
CREATE INDEX IF NOT EXISTS `idx_fetchlog_created_at` 
ON `api_fetch_log` (`created_at`);


-- ============================================================================
-- 4. DYNAMIC SCHEDULER & REAL-TIME BACKGROUND MONITORING
-- ============================================================================

-- Scheduler Job: Active project lookups
CREATE INDEX IF NOT EXISTS `idx_sched_job_active_proj` 
ON `scheduler_job` (`is_active`, `project`);

-- Scheduler Job: Status and run time monitoring
CREATE INDEX IF NOT EXISTS `idx_sched_job_status_time` 
ON `scheduler_job` (`last_run_status`, `last_run_time`);

-- Scheduler Log: Job run time history
CREATE INDEX IF NOT EXISTS `idx_sched_log_job_time` 
ON `scheduler_log` (`scheduler_job_id`, `run_time`);

-- Scheduler Log: Status and run time range
CREATE INDEX IF NOT EXISTS `idx_sched_log_status_time` 
ON `scheduler_log` (`status`, `run_time`);


-- ============================================================================
-- 5. OPERATIONAL MODULE TRANSACTION TABLES
-- ============================================================================

-- TIPS / TIME Tender Works: (fy_id, district_id)
CREATE INDEX IF NOT EXISTS `idx_tender_fy_dist` 
ON `tender_district` (`fy_id`, `district_id`);

-- THMS Housing Works: (fy_id, district_id, phase)
CREATE INDEX IF NOT EXISTS `idx_housing_fy_dist_phase` 
ON `housing_district` (`fy_id`, `district_id`, `phase`);

-- Patrol 360 / Surveillance: (fy_id, district_id)
CREATE INDEX IF NOT EXISTS `idx_patrol_fy_dist` 
ON `patrol_district` (`fy_id`, `district_id`);

-- Member / Welfare Schemes (TNCWWB / TELP): (fy_id, district_id)
CREATE INDEX IF NOT EXISTS `idx_member_fy_dist` 
ON `member_district` (`fy_id`, `district_id`);

-- TOD Schemes: (fy_id, district_id, task_type)
CREATE INDEX IF NOT EXISTS `idx_tod_fy_dist_task` 
ON `tod_district` (`fy_id`, `district_id`, `task_type`);

-- TAMS Student Enrollment: (fy_id, institute_id, status)
CREATE INDEX IF NOT EXISTS `idx_enroll_inst_status` 
ON `enroll_institute` (`fy_id`, `institute_id`, `status`);


-- ============================================================================
-- 6. AI, RAG KNOWLEDGE BASE & MCP TELEMETRY
-- ============================================================================

-- RAG Document: Category & Hash lookups
CREATE INDEX IF NOT EXISTS `ix_ragdoc_category` 
ON `rag_document` (`category`);

-- RAG Chunk: Document chunk hierarchy
CREATE INDEX IF NOT EXISTS `ix_ragchunk_doc` 
ON `rag_chunk` (`document_id`);

-- AI Prompt Template: Code lookup
CREATE INDEX IF NOT EXISTS `ix_aiprompt_code` 
ON `ai_prompt_template` (`code`);

-- AI Request Log: User ID and Created At audit
CREATE INDEX IF NOT EXISTS `ix_ailog_user_created` 
ON `ai_request_log` (`user_id`, `created_at`);


-- ============================================================================
-- 7. RECALCULATE TABLE & INDEX STATISTICS (ANALYZE TABLE)
-- ============================================================================
ANALYZE TABLE `app_user`;
ANALYZE TABLE `user_privilege`;
ANALYZE TABLE `detail_api_cache`;
ANALYZE TABLE `detail_api_records`;
ANALYZE TABLE `api_fetch_log`;
ANALYZE TABLE `local_body_mapping`;
ANALYZE TABLE `scheduler_job`;
ANALYZE TABLE `scheduler_log`;
ANALYZE TABLE `district`;
ANALYZE TABLE `division`;
ANALYZE TABLE `tender_district`;
ANALYZE TABLE `housing_district`;
ANALYZE TABLE `patrol_district`;
ANALYZE TABLE `member_district`;
ANALYZE TABLE `tod_district`;
ANALYZE TABLE `enroll_institute`;
ANALYZE TABLE `rag_document`;
ANALYZE TABLE `rag_chunk`;
ANALYZE TABLE `ai_prompt_template`;
ANALYZE TABLE `ai_request_log`;
