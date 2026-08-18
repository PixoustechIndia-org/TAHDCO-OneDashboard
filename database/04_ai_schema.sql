-- ============================================================================
-- TAHDCO UDP — AI & RAG Module Database Schema
-- Run order: 01_schema.sql -> 02_seed_data.sql -> 03_scheduler_schema.sql -> 04_ai_schema.sql
-- ============================================================================

USE tahdco_udp;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS ai_request_log, rag_document, rag_chunk, ai_prompt_template;
SET FOREIGN_KEY_CHECKS = 1;

-- ── AI Request & Audit Log ──────────────────────────────────────────────────
CREATE TABLE ai_request_log (
  request_id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  provider        VARCHAR(40) NOT NULL,        -- 'OpenAI', 'AzureOpenAI', 'Gemini', 'Ollama', 'LocalFallback'
  model           VARCHAR(60) NOT NULL,        -- 'gpt-4o', 'gemini-1.5-pro', 'llama3'
  prompt_tokens   INT UNSIGNED NOT NULL DEFAULT 0,
  completion_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  latency_ms      INT UNSIGNED NOT NULL DEFAULT 0,
  cost_usd        DECIMAL(10,6) NOT NULL DEFAULT 0.000000,
  user_query      TEXT NULL,
  ai_response     TEXT NULL,
  feedback_rating TINYINT NULL DEFAULT 0,       -- 1 (Thumbs Up), -1 (Thumbs Down), 0 (Unrated)
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_ailog_user (user_id),
  KEY ix_ailog_created (created_at),
  CONSTRAINT fk_ailog_user FOREIGN KEY (user_id) REFERENCES app_user (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── RAG Document Registry ───────────────────────────────────────────────────
CREATE TABLE rag_document (
  document_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(255) NOT NULL,
  category      VARCHAR(60) NOT NULL,          -- 'GO', 'SchemeGuideline', 'MBookDoc', 'TenderNotice'
  file_path     VARCHAR(500) NOT NULL,
  file_hash     VARCHAR(64) NOT NULL UNIQUE,   -- SHA256 for duplicate detection
  file_size     INT UNSIGNED NOT NULL DEFAULT 0,
  chunk_count   INT UNSIGNED NOT NULL DEFAULT 0,
  status        ENUM('Pending', 'Processing', 'Indexed', 'Failed') NOT NULL DEFAULT 'Pending',
  indexed_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_ragdoc_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── RAG Chunks Store (Relational fallback & metadata context) ───────────────
CREATE TABLE rag_chunk (
  chunk_id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document_id   INT UNSIGNED NOT NULL,
  chunk_index   INT UNSIGNED NOT NULL,
  content       TEXT NOT NULL,
  token_count   INT UNSIGNED NOT NULL DEFAULT 0,
  vector_id     VARCHAR(64) NULL,              -- Reference key in Vector DB (Qdrant / Memory)
  KEY ix_ragchunk_doc (document_id),
  CONSTRAINT fk_ragchunk_doc FOREIGN KEY (document_id) REFERENCES rag_document (document_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── AI Prompt Templates Master ──────────────────────────────────────────────
CREATE TABLE ai_prompt_template (
  template_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(60) NOT NULL UNIQUE,   -- 'EXECUTIVE_SUMMARY', 'SCHEME_HELP', 'TENDER_ANALYSIS'
  name          VARCHAR(100) NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt   TEXT NOT NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Initial Seed Data for Prompt Templates ──────────────────────────────────
INSERT INTO ai_prompt_template (code, name, system_prompt, user_prompt) VALUES
('EXECUTIVE_SUMMARY', 'Executive Briefing Generator', 
 'You are an executive AI assistant for TAHDCO (Tamil Nadu Adi Dravidar Housing and Development Corporation). Synthesize complex district metrics into concise executive highlights with actionable insights.',
 'Summarize the status of {{project}} for {{district}} in financial year {{fy}}. Identify critical bottlenecks in tender works, housing phases, and scheme approvals.'),

('SCHEME_HELP', 'Welfare Scheme Advisor',
 'You are a welfare policy specialist for TAHDCO schemes including TAHDCO Scheme, TELP, and One Portal applications. Provide clear eligibility guidance based on official government guidelines.',
 'An applicant is asking about eligibility and status for {{scheme_name}}. Answer their questions clearly with citations.'),

('TENDER_ANALYSIS', 'Civil Works & MBook Auditor',
 'You are a civil engineering audit specialist reviewing TIPS and TIME tender projects for TAHDCO. Analyze M-Book pendency, slow progress works, and payment delays.',
 'Analyze civil work progress for district {{district_name}}. Highlight works with slow progress or unsubmitted M-Books.');
