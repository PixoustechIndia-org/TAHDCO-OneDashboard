# TAHDCO UDP — Run Guide

Frontend: Angular 16 (PrimNG 16) · Backend: ASP.NET Core 8 (MySQL/AWS RDS)

## Reproduce artifacts (fresh checkout)

No `.env*` files exist — `frontend/src/environments/environment.ts` (dev) and
`environment.prod.ts` are committed and used as-is. The dev build points at the
production API (`https://onedashboard-v1.pixoustech.app/api/v1`); the app falls
back to a mock login + bundled JSON dashboard when the API is unreachable, so
the frontend is viewable standalone.

```bash
cd frontend
npm install          # installs Angular CLI + deps (playwright-core included for e2e)
```

Backend (optional for UI preview; required for live API data):

```bash
cd backend
dotnet build API/API.csproj     # then run API/bin/Debug/net8.0/API.exe (binds :5000)
```

RDS connection lives in `backend/API/appsettings.json` (not a secret to copy —
it is committed in that file).

## Run the dev server

Frontend dev server (default port 4200 — Angular default; check `netstat` first
and pass `--port <free>` if occupied):

```bash
cd frontend
npm start -- --host 0.0.0.0 --port 4200
# or, detached on Windows:
powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'start','--','--host','0.0.0.0','--port','4200' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
```

Wait for "√ Compiled successfully" in the log, then verify:
`curl -s -o /dev/null -w "%{http_code}" http://localhost:4200/ -H "Accept: text/html"` → 200.

Preview URL: `http://127.0.0.1:4200/`

The E2E suite additionally expects the backend on `http://localhost:5000`
(`frontend/e2e/run_e2e.js` rewrites production API calls to it; write
`e2e_results.json` → regenerate workbook with
`python create_testing_workbook.py && python generate_html_preview.py && python export_pdf.py`).
