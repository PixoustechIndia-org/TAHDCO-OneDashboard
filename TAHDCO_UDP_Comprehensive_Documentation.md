# TAHDCO Unified Dashboard Platform (UDP)
## Comprehensive Technical & Operational Documentation

**Document Version**: 2.5 (Production Release)  
**Target Organization**: Tamil Nadu Adi Dravidar Housing and Development Corporation (TAHDCO)  
**Release Date**: August 2026  

---

## 1. System Overview & Architecture

The **TAHDCO Unified Dashboard Platform (UDP)** is a modern, enterprise-scale analytics and monitoring ecosystem designed to provide end-to-end operational visibility across all major welfare schemes, physical housing constructions, engineering works, student enrollments, and surveillance streams throughout Tamil Nadu.

### 1.1 High-Level Architecture

```mermaid
graph TD
    subgraph Client Layer (Angular 16)
        UI1[Executive Dashboard & GIS Map]
        UI2[Scheduler Management & History]
        UI3[Local Body Configuration & SheetJS]
        UI4[User Master & Privilege Matrix]
        UI5[Module Reports & PDF Export]
    end

    subgraph API & Application Layer (.NET 8)
        API[ASP.NET Core Web API]
        AUTH[JWT & BCrypt Authentication]
        CACHE_SVC[Multi-Tier Detail Cache Service]
        SCHED_SVC[Dynamic Hangfire Scheduler Engine]
        SLA_SVC[Automated SLA Threshold Alerts]
        VOICE_SVC[Voice Synthesis & NLP Analytics]
    end

    subgraph Data Access Layer (Dapper & ADO.NET)
        DAP[Dapper High-Speed Micro-ORM]
    end

    subgraph Persistence Layer (MySQL 8.0 / MariaDB InnoDB)
        DB[(tahdco_udp Database)]
        IDX[Group Composite Indexes & Full-Text Search]
    end

    subgraph External Source Systems
        EXT1[TIPS - Tenders & Works]
        EXT2[TIME - M-Books & Payments]
        EXT3[THMS - Housing Progress]
        EXT4[TAMS - Training & Attendance]
        EXT5[TELP - Loan Sanctions]
        EXT6[TNCWWB / OnePortal - Welfare Cards]
        EXT7[Patrol360 - CCTV Cameras]
        EXT8[TOD - Target Works]
    end

    UI1 & UI2 & UI3 & UI4 & UI5 <--> API
    API --> AUTH & CACHE_SVC & SCHED_SVC & SLA_SVC & VOICE_SVC
    AUTH & CACHE_SVC & SCHED_SVC & SLA_SVC --> DAP
    DAP <--> DB
    IDX --- DB
    SCHED_SVC <--> EXT1 & EXT2 & EXT3 & EXT4 & EXT5 & EXT6 & EXT7 & EXT8
```

---

## 2. Technology Stack & Prerequisites

### 2.1 Technology Matrix
* **Frontend**: Angular 16, TypeScript 5, PrimeNG 16, ApexCharts, Leaflet, Google Maps JS API, SheetJS (`xlsx`), jsPDF/AutoTable, SCSS.
* **Backend**: .NET 8 (C#), ASP.NET Core Web API, Dapper Micro-ORM, Hangfire, Serilog (MariaDB Sink), BCrypt.Net, QuestPDF.
* **Database**: MySQL 8.0+ / MariaDB 10.6+ (InnoDB Engine, UTF8MB4).

### 2.2 Environment Requirements
* **Node.js**: `v18.x` or `v20.x` LTS
* **Angular CLI**: `16.x` (`npm install -g @angular/cli@16`)
* **.NET SDK**: `.NET 8.0 SDK`
* **MySQL**: `MySQL 8.0+` or `MariaDB 10.4+`

---

## 3. Installation & Deployment Guide

### 3.1 Database Setup
1. Create the database and execute the master indexing and schema script:
```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS tahdco_udp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p tahdco_udp < TAHDCO_UDP_Master_Full_Indexing_Optimization.sql
```

### 3.2 Backend Configuration & Execution
1. Navigate to `backend/API/appsettings.json` and configure your database connection string:
```json
{
  "ConnectionStrings": {
    "Default": "Server=localhost;Port=3306;Database=tahdco_udp;User=root;Password=YOUR_PASSWORD;Allow User Variables=true;Pooling=true;Min Pool Size=10;Max Pool Size=150;Connection Timeout=30;"
  },
  "Jwt": {
    "Issuer": "TahdcoUdp",
    "Audience": "TahdcoUdpClient",
    "Key": "CHANGE-ME-32+CHARS-SUPER-SECRET-SIGNING-KEY-2026!",
    "ExpiryMinutes": 480
  }
}
```
2. Build and run the .NET 8 backend:
```bash
cd backend
dotnet restore API.sln
dotnet build API.sln
dotnet run --project API/API.csproj
```
The API server will listen on `http://localhost:5000` (or configured HTTPS port).

### 3.3 Frontend Installation & Execution
1. Open a new terminal in the `frontend` folder:
```bash
cd frontend
npm install
npm run start
```
2. Open your browser and navigate to `http://localhost:4200`.

---

## 4. User Directory & Role-Based Access Control (RBAC)

All **51 official user accounts** are pre-configured with active status and password: `Password123!`.

### 4.1 Executive & Statewide Roles
| Role | Name | Email | Scope | App Access |
| :--- | :--- | :--- | :--- | :--- |
| **System Administrator** | Application Admin (HQ) | `admin@tahdco.in` | Statewide (All) | TIPS, THMS, TAMS, Scheme, TELP, OnePortal, TOD, TIME, Patrol360 |
| **Managing Director (MD)** | Dr. Vijaya Rajan | `md@tahdco.in` | Statewide (All) | TIPS, THMS, TAMS, Scheme, TELP, OnePortal, TOD, TIME, Patrol360 |
| **Secretary** | Sundaram K. IAS | `sec@tahdco.in` | Statewide (All) | TIPS, THMS, TAMS, Scheme, TELP, OnePortal, TOD, TIME, Patrol360 |
| **Chief Engineer** | Er. K. Swaminathan | `ce@tahdco.in` | Statewide (Engineering) | TIPS, TIME, Patrol360, THMS |
| **General Manager (GM)** | Rajesh Kumar | `gm@tahdco.in` | Statewide (Welfare) | Scheme, TELP, TAMS, TOD |

### 4.2 Executive Engineers (9 Administrative Divisions)
*Password for all*: `Password123!` | *Scope*: Division | *Access*: TIPS, TIME, Patrol360, THMS

| Division | Name | Email |
| :--- | :--- | :--- |
| **Chennai** | EE - Chennai Division | `ee_chennai@tahdco.in` |
| **Coimbatore** | EE - Coimbatore Division | `ee_coimbatore@tahdco.in` |
| **Madurai** | EE - Madurai Division | `ee_madurai@tahdco.in` |
| **Salem** | EE - Salem Division | `ee_salem@tahdco.in` |
| **Thanjavur** | EE - Thanjavur Division | `ee_thanjavur@tahdco.in` |
| **Trichy** | EE - Trichy Division | `ee_trichy@tahdco.in` |
| **Vellore** | EE - Vellore Division | `ee_vellore@tahdco.in` |
| **Villupuram** | EE - Villupuram Division | `ee_villupuram@tahdco.in` |
| **Thirunelveli** | EE - Thirunelveli Division | `ee_thirunelveli@tahdco.in` |

### 4.3 District Managers (37 Districts)
*Password for all*: `Password123!` | *Scope*: District | *Access*: All 9 Integrated Modules

| District | Assigned Division | Email |
| :--- | :--- | :--- |
| **Chengalpattu** | Chennai | `dm_chengalpattu@tahdco.in` |
| **Kancheepuram** | Chennai | `dm_kancheepuram@tahdco.in` |
| **Tiruvallur** | Chennai | `dm_tiruvallur@tahdco.in` |
| **Ranipet** | Chennai | `dm_ranipet@tahdco.in` |
| **Chennai** | Chennai | `dm_chennai@tahdco.in` |
| **Coimbatore** | Coimbatore | `dm_coimbatore@tahdco.in` |
| **Erode** | Coimbatore | `dm_erode@tahdco.in` |
| **Tiruppur** | Coimbatore | `dm_tiruppur@tahdco.in` |
| **The Nilgiris** | Coimbatore | `dm_thenilgiris@tahdco.in` |
| **Madurai** | Madurai | `dm_madurai@tahdco.in` |
| **Dindigul** | Madurai | `dm_dindigul@tahdco.in` |
| **Theni** | Madurai | `dm_theni@tahdco.in` |
| **Sivagangai** | Madurai | `dm_sivagangai@tahdco.in` |
| **Ramanathapuram** | Madurai | `dm_ramanathapuram@tahdco.in` |
| **Salem** | Salem | `dm_salem@tahdco.in` |
| **Dharmapuri** | Salem | `dm_dharmapuri@tahdco.in` |
| **Krishnagiri** | Salem | `dm_krishnagiri@tahdco.in` |
| **Namakkal** | Salem | `dm_namakkal@tahdco.in` |
| **Karur** | Salem | `dm_karur@tahdco.in` |
| **Thanjavur** | Thanjavur | `dm_thanjavur@tahdco.in` |
| **Thiruvarur** | Thanjavur | `dm_thiruvarur@tahdco.in` |
| **Nagapattinam** | Thanjavur | `dm_nagapattinam@tahdco.in` |
| **Mayiladuthurai** | Thanjavur | `dm_mayiladuthurai@tahdco.in` |
| **Ariyalur** | Trichy | `dm_ariyalur@tahdco.in` |
| **Perambalur** | Trichy | `dm_perambalur@tahdco.in` |
| **Thiruchirappalli** | Trichy | `dm_thiruchirappalli@tahdco.in` |
| **Pudukkottai** | Trichy | `dm_pudukkottai@tahdco.in` |
| **Vellore** | Vellore | `dm_vellore@tahdco.in` |
| **Tirupathur** | Vellore | `dm_tirupathur@tahdco.in` |
| **Tiruvannamalai** | Vellore | `dm_tiruvannamalai@tahdco.in` |
| **Villupuram** | Villupuram | `dm_villupuram@tahdco.in` |
| **Cuddalore** | Villupuram | `dm_cuddalore@tahdco.in` |
| **Kallakurichi** | Villupuram | `dm_kallakurichi@tahdco.in` |
| **Tirunelveli** | Thirunelveli | `dm_tirunelveli@tahdco.in` |
| **Tenkasi** | Thirunelveli | `dm_tenkasi@tahdco.in` |
| **Thoothukudi** | Thirunelveli | `dm_thoothukudi@tahdco.in` |
| **Kanniyakumari** | Thirunelveli | `dm_kanniyakumari@tahdco.in` |

---

## 5. Feature Operations & User Guide

### 5.1 Unified Top Navigation Bar
* **Role Badge Display**: Dynamically displays user scope badges (`[ADM]`, `[MD]`, `[SEC]`, `[CE]`, `[GM]`, `[EE]`, `[DM]`) and full role titles.
* **Financial Year Multi-Select**: Filters metrics reactively by fiscal years (e.g. `2025-26`, `2024-25`).
* **Division Multi-Select**: Filters metrics, table rows, and map pins by administrative divisions.
* **View Mode Toggle**: Switches visual display seamlessly between `# Count`, `₹ Cost`, and `⊶ Both`.

### 5.2 Geographic Performance Map (GIS)
* **Division Isolation**: Selecting one or more divisions renders pins exclusively for the districts within those divisions.
* **Auto-Fit Viewport**: Google Maps automatically centers and zooms (`fitBounds`) to the bounding coordinates of selected districts.
* **District Click Interaction**:
  - Highlights real-time KPI metrics in the right-side performance card.
  - Automatically filters the master data table to show works for that district.
* **360° Google Street View**: Click on the 360° button to launch interactive panoramic inspection of district infrastructure sites.

### 5.3 Scheduler Management & Execution History (`/scheduler-management`)
* **Job Scheduler Configuration**: Configure automated HTTP cron synchronizations with custom intervals and payloads.
* **Execution History Toolbar**:
  - Full-text search across job names, messages, and target URLs.
  - Project and Status filters (`SUCCESS`, `FAILED`, `RUNNING`).
  - **Date Range Picker (`p-calendar`)**: Filter runs by exact date or date ranges (`dd/mm/yy`).
  - **Clear Filters**: Resets all filters and displays complete execution runs.

### 5.4 Local Body Configuration (`/configuration`)
* **Hierarchical Grid**: View and manage the complete governance hierarchy for Tamil Nadu.
* **Excel Spreadsheet Import**: Upload `.xlsx` / `.xls` spreadsheets with automatic column mapping and validation via **SheetJS (`xlsx`)**.
* **Excel Export**: Download formatted `.xlsx` master files for offline review.
* **CRUD Dialog**: Add and edit local body entries with instant input validation.

---

## 6. Database Indexing & Optimization Reference

The production database is optimized via [`TAHDCO_UDP_Master_Full_Indexing_Optimization.sql`](file:///c:/Users/logup/Downloads/onedashboard/TAHDCO_UDP_FullStack_Angular16_DotNet8_MySQL%20(1)/TAHDCO_UDP_Master_Full_Indexing_Optimization.sql).

### 6.1 Index Summary
```sql
-- Authentication Index
CREATE INDEX idx_app_user_email_active ON app_user (email, is_active);

-- Geographic Hierarchy Index
CREATE INDEX idx_lbm_div_dist_type ON local_body_mapping (division, district, local_body);

### 5.5 AI Analytics, RAG Subsystem & Model Context Protocol (MCP)
* **Natural Language Chat Assistant (`/api/v1/ai/chat`)**:
  - Interactive Q&A dialog supporting natural language operational questions (e.g., *"Which districts have overdue housing works in Phase 2?"*).
  - Real-time token streaming over Server-Sent Events (`GET /api/v1/ai/chat/stream`).
* **Retrieval-Augmented Generation (RAG)**:
  - Ingests Government Orders (GOs), scheme guidelines, and technical SOPs into `rag_document` and `rag_chunk`.
  - Performs hybrid semantic vector + BM25 lexical search (`GET /api/v1/ai/rag/search`) to return grounded answers with document citations.
* **Model Context Protocol (MCP) Server**:
  - Exposes standardized agentic tools via `GET /api/v1/ai/mcp/tools` and `POST /api/v1/ai/mcp/execute`.
  - **Tool Catalog**:
    1. `tahdco_get_district_summary`: Multidimensional scorecard metrics per district.
    2. `tahdco_query_tender_works`: TIPS/TIME work orders and M-Book verification logs.
    3. `tahdco_get_housing_progress`: THMS 8-stage housing completion counts.
    4. `tahdco_get_scheme_applications`: Welfare loans and subsidy sanctions.
    5. `tahdco_generate_pdf_report`: Automated PDF executive report generator.

---

## 6. Database Indexing & Optimization Reference

The production database is optimized via [`TAHDCO_UDP_Master_Full_Indexing_Optimization.sql`](file:///c:/Users/logup/Downloads/onedashboard/TAHDCO_UDP_FullStack_Angular16_DotNet8_MySQL%20(1)/TAHDCO_UDP_Master_Full_Indexing_Optimization.sql).

### 6.1 Index Summary
```sql
-- Authentication Index
CREATE INDEX idx_app_user_email_active ON app_user (email, is_active);

-- Geographic Hierarchy Index
CREATE INDEX idx_lbm_div_dist_type ON local_body_mapping (division, district, local_body);

-- Operational Records Multi-Filter Index
CREATE INDEX idx_records_mod_div_dist ON detail_api_records (module, division, district);

-- Ingestion Cache Expiry Index
CREATE INDEX idx_cache_status_expires ON detail_api_cache (status, expires_at, is_stale);

-- History Date Range Index
CREATE INDEX idx_fetchlog_mod_started ON api_fetch_log (module, started_at);

-- RAG Document Category Index
CREATE INDEX ix_ragdoc_category ON rag_document (category);

-- AI Request Log User Index
CREATE INDEX ix_ailog_user ON ai_request_log (user_id, created_at);
```

### 6.2 Maintenance Stored Procedures
```sql
-- Defragment tables and recalculate statistics
CALL sp_optimize_platform_tables();

-- Purge logs older than 90 days
CALL sp_cleanup_expired_telemetry(90);
```

---

## 7. Verification & Automated Testing Suite

To verify user accounts and live login authentication, run:
```powershell
powershell -ExecutionPolicy Bypass -File scratch/verify_users.ps1
```
*Current Result*: **51 Passed, 0 Failed out of 51 accounts (100% Pass Rate)**.

---

**© 2026 TAHDCO Unified Dashboard Platform. All Rights Reserved.**
