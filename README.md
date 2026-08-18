# TAHDCO UDP — Unified Dashboard Platform
> **Tamil Nadu Adi Dravidar Housing and Development Corporation**  
> Full-Stack · Angular 16 · .NET 8 · MySQL

---

## 📌 Table of Contents
1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Prerequisites](#prerequisites)
5. [Getting Started](#getting-started)
6. [Environment Configuration](#environment-configuration)
7. [User Roles & Privileges](#user-roles--privileges)
8. [Module Guide](#module-guide)
9. [API Reference](#api-reference)
10. [Build & Deployment](#build--deployment)
11. [Database Setup](#database-setup)
12. [Testing](#testing)
13. [Troubleshooting](#troubleshooting)

---

## 📖 Overview

**TAHDCO UDP** is a Unified Dashboard Platform for monitoring government scheme implementation across Tamil Nadu districts. It provides:

- 📊 **District-wise live dashboards** for TIPS, TIME, THMS, Patrol360, and TNCWWB schemes
- 👤 **Role-based access control** (Admin, MD, Executive Engineer, District Manager, etc.)
- 📧 **Email report sharing** with Excel attachments
- 📄 **PDF export** of official government reports
- 🔔 **Real-time notifications** via background workers
- 🤖 **AI-powered Q&A assistant** for scheme data queries
- 📅 **Dynamic scheduler** for automated sync jobs

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Angular 16, PrimeNG, Chart.js, jsPDF, Tailwind CSS |
| **Backend** | ASP.NET Core 8 (Web API) |
| **ORM** | Dapper (thin SQL mapper) |
| **Database** | MySQL 8.x |
| **Auth** | JWT Bearer Tokens |
| **Background Jobs** | Hangfire |
| **Caching** | IMemoryCache |
| **Email** | System.Net.Mail (SMTP) |
| **AI** | Gemini / OpenAI via configurable LLM provider |

---

## 📁 Project Structure

```
TAHDCO_UDP_FullStack/
│
├── frontend/                      # Angular 16 SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/              # Services, Auth, Guards, Interceptors
│   │   │   ├── modules/           # Feature modules (dashboard, user-master, etc.)
│   │   │   ├── shared/            # Reusable components & pipes
│   │   │   └── app.module.ts
│   │   ├── environments/          # environment.ts / environment.prod.ts
│   │   └── assets/
│   ├── angular.json
│   └── package.json
│
├── backend/
│   ├── API/                       # ASP.NET Web API (controllers, middleware)
│   │   ├── Controllers/           # REST endpoints
│   │   ├── Infrastructure/        # DI extensions, CurrentUserService
│   │   ├── Middleware/            # Exception handler, Request logger
│   │   └── Program.cs
│   │
│   ├── BAL/                       # Business Access Layer (services, background jobs)
│   │   ├── Interface/             # Service interfaces
│   │   ├── Service/               # Service implementations
│   │   └── BackgroundWorkerService/
│   │
│   ├── DAL/                       # Data Access Layer (Dapper)
│   │   ├── DapperContext.cs
│   │   └── DapperRepository.cs
│   │
│   ├── Model/                     # ViewModels and DTOs
│   │   └── ViewModel/
│   │
│   ├── Utils/                     # JWT, PasswordHasher, Cache utilities
│   │
│   ├── API.Tests/                 # Unit & integration tests
│   │
│   └── database/                  # SQL migration scripts
│       ├── 01_schema.sql
│       └── 02_seed_data.sql
```

---

## ✅ Prerequisites

| Tool | Version | Download |
|------|---------|---------|
| Node.js | 18.x or 20.x LTS | https://nodejs.org |
| Angular CLI | 16.x | `npm install -g @angular/cli@16` |
| .NET SDK | 8.0 | https://dotnet.microsoft.com/download/dotnet/8.0 |
| MySQL Server | 8.0+ | https://dev.mysql.com/downloads/ |

---

## 🚀 Getting Started

### 1. Setup the Database
```bash
mysql -u root -p < database/01_schema.sql
mysql -u root -p udp_db < database/02_seed_data.sql
```

### 2. Run the Backend API
```bash
cd backend/API
dotnet restore
dotnet run
# API: https://localhost:7214
```

### 3. Run the Frontend
```bash
cd frontend
npm install
ng serve
# App: http://localhost:4200
```

---

## ⚙️ Environment Configuration

### Backend — `backend/API/appsettings.json`
```json
{
  "ConnectionStrings": {
    "Default": "Server=localhost;Port=3306;Database=udp_db;User=udp_user;Password=YOUR_DB_PASSWORD;"
  },
  "JwtSettings": {
    "Key": "YOUR_256BIT_SECRET_KEY_MINIMUM_32_CHARS",
    "Issuer": "TAHDCO-UDP-API",
    "Audience": "TAHDCO-UDP-Angular",
    "ExpiryMinutes": 60
  },
  "EmailConfig": {
    "SmtpServer": "smtp.gmail.com",
    "Port": "587",
    "SSL": "true",
    "Email": "SMTP_EMAIL",
    "Password": "SMTP_APP_PASSWORD",
    "From": "TAHDCO UDP <noreply@tahdco.tn.gov.in>"
  }
}
```

> ⚠️ **NEVER commit passwords or JWT keys to source control.**
> Use environment variables in production:
> ```
> JwtSettings__Key=<your_key>
> ConnectionStrings__Default=<your_conn>
> EmailConfig__Password=<your_smtp_password>
> ```

### Frontend — `frontend/src/environments/environment.prod.ts`
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.yourdomain.in',
  enableMockLogin: false   // Must always be false in production
};
```

---

## 👥 User Roles & Privileges

| Role | Code | Access Level |
|------|------|-------------|
| **Admin** | `admin` | Full access — user management, all districts |
| **Managing Director** | `md` | Read all dashboards, all districts |
| **Executive Engineer** | `ee` | Division-scoped dashboards |
| **District Manager** | `dm` | District-scoped dashboards |
| **Data Entry Operator** | `deo` | Module data entry only |

---

## 📦 Module Guide

| Module | Route | Description |
|--------|-------|-------------|
| **Dashboard MD** | `/dashboard-md` | Main district-wise analytics with Table/Chart toggle |
| **User Master** | `/user-master` | User management (Admin only) |
| **TIPS/TIME** | `/tips` | Tender & M-Book monitoring |
| **THMS** | `/thms` | Housing scheme monitoring |
| **Patrol360** | `/patrol` | CCTV & patrol monitoring |
| **TNCWWB** | `/tncwwb` | Welfare board scheme monitoring |
| **Reports** | `/reports` | Official report generation |
| **Admin** | `/admin` | Scheduler, cache management, audit logs |

---

## 🔌 API Reference

### Authentication
```
POST /api/v1/auth/login
Body: { "email": "user@tahdco.in", "password": "..." }
Response: { "token": "<jwt>", "user": { ... } }
```

### Dashboard
```
GET /api/v1/dashboard/full?fy=2025-26&clearCache=false
Authorization: Bearer <token>
```

### Email Report
```
POST /api/v1/email/send
Authorization: Bearer <token>
Body: {
  "toEmail": "manager@gov.in",
  "subject": "District Report",
  "body": "<html>...",
  "attachmentBase64": "<base64>",
  "attachmentFileName": "report.xlsx"
}
```

### Health Check
```
GET /health  →  200 OK
```

---

## 🏗 Build & Deployment

### Frontend Production Build
```bash
cd frontend
ng build --configuration production
# Output: frontend/dist/tahdco-udp/
```

### Backend Publish
```bash
cd backend
dotnet publish -c Release -o publish/
# Output: backend/publish/
```

### IIS Deployment (Windows Server)
1. Copy `backend/publish/` → `C:\inetpub\wwwroot\tahdco-api\`
2. Copy `frontend/dist/tahdco-udp/` → `C:\inetpub\wwwroot\tahdco-ui\`
3. Add URL Rewrite rule for Angular SPA (all routes → `index.html`)

### Nginx Deployment (Linux)
```nginx
server {
    listen 443 ssl;
    server_name app.yourdomain.in;
    root /var/www/tahdco-ui;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}
```

---

## 🗄 Database Setup

```sql
CREATE DATABASE IF NOT EXISTS udp_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'udp_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON udp_db.* TO 'udp_user'@'localhost';
FLUSH PRIVILEGES;

USE udp_db;
SOURCE /path/to/database/01_schema.sql;
SOURCE /path/to/database/02_seed_data.sql;
```

### Key Tables
| Table | Purpose |
|-------|---------|
| `app_user` | System users with role, division, district |
| `user_privilege` | Per-user, per-module privilege flags |
| `district` | Master district list |
| `division` | Master division list |
| `audit_log` | System access and change audit trail |

---

## 🧪 Testing

### Backend Tests
```bash
cd backend/API.Tests
dotnet test --verbosity normal
```

### Frontend Tests
```bash
cd frontend
ng test --browsers ChromeHeadless --watch=false
```

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|---------|
| `ng build` — "bundle budget exceeded" | Warning only, not an error. Increase budget in `angular.json` |
| Login fails 401 after deploy | Check `JwtSettings:Key` matches, CORS origin set, user `is_active=1` |
| Email not sending | Use Gmail **App Password**, ensure port 587 open outbound |
| Dashboard shows stale data | Admin panel → Clear Cache, or `GET /api/v1/dashboard/full?clearCache=true` |
| Chart not rendering | Hard refresh: `Ctrl+Shift+R` (Win) or `Cmd+Shift+R` (Mac) |

---

## 📄 License
Internal Government Application — TAHDCO, Government of Tamil Nadu.  
© 2026 Tamil Nadu Adi Dravidar Housing and Development Corporation. All rights reserved.

*Last Updated: August 2026*
