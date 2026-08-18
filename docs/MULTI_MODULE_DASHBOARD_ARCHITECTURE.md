# Multi-Module Dashboard — Architecture & Deliverables

Developer: Loganathan R · Project: TAHDCO UDP · Status: implemented, **not yet compiled or run** (see "What this document does not claim" at the bottom)

## 1. What this is

A click-driven COUNT → DETAIL dashboard layer that integrates 7 external project APIs behind one
consistent contract, with a database-backed cache that guarantees a live-API failure never deletes
or hides previously-fetched data. It extends the existing TAHDCO UDP backend (.NET 8 / Dapper /
MySQL) and frontend (Angular 16 / PrimeNG) — it is not a separate project.

The 7 modules: TELP, TAHDCO Scheme, TIME + Patrol360, THMS, TAMS, One Portal (Member), One Portal
(Scheme). Each has a COUNT endpoint (summary numbers) and a DETAIL endpoint (the records behind a
clicked number).

## 2. The one rule everything else serves

> If the DETAIL or COUNT API fails and previously-stored data exists, serve the old data marked
> **STALE** instead of an error. Never delete old data on failure. Only show an empty/unavailable
> state when there is truly no prior data.

Every design decision below — the cache schema, the repository's `MarkFailedAsync` method, the
adapter pattern, the MCP tool guardrails — exists to make that rule hold structurally, not just as
an application-level convention someone could accidentally bypass.

## 3. Data flow

```
Angular click (ClickContext: module + district/division + metric — never a bare count)
   → POST /api/v2/dashboard-cache/{module}/detail
   → DashboardCacheController
   → IModuleAdapterRegistry.Get(module)         (validated against DashboardModule.All)
   → IDetailCacheService.GetDetailDataAsync(adapter, clickContext)
        ├─ FRESH cache row exists & unexpired  → return immediately, no network call
        ├─ STALE (expired/previously failed)   → return cached data immediately,
        │                                          fire a de-duplicated background refresh
        └─ NO usable cache                     → single-flighted synchronous fetch;
                                                   on failure → honest "unavailable" result
```

The same shape (fresh / stale-with-background-refresh / no-cache) is mirrored independently for
COUNT via `ICountCacheService` — a COUNT failure never affects DETAIL data for the same module, and
a failure in one module never touches another module's cache rows (each row is keyed and updated
independently; there is no shared mutable state across modules other than the per-process
single-flight registry, which is keyed by cache key, not module).

## 4. Adapter pattern (`IDashboardModuleAdapter`)

One interface, 7 implementations (`backend/BAL/Service/ModuleAdapters/*.cs`). Each adapter's only
job is to know how to talk to **one** upstream API:

| Method | Purpose |
|---|---|
| `BuildCountRequest` / `BuildDetailRequest` | Build the exact payload/query — every field sourced from `filters`/`clickContext`, never a hard-coded example value |
| `GetCountDataAsync` / `GetDetailDataAsync` | Call the upstream endpoint via `IResilientApiClient`, return raw response, throw `ExternalApiException` on failure |
| `NormalizeCountResponse` / `NormalizeDetailResponse` | Convert the raw (shape-unknown) response into `NormalizedCountDto` / `NormalizedDetailRecordDto` |
| `GetDetailCacheKey` / `GetCountCacheKey` | Deterministic key: `module\|operation\|district\|division\|metric\|filters...` — never just a district, never just a count value |

Two architectural wrinkles the spec called out explicitly, both handled inside the adapter layer
without leaking special cases into the cache services:

- **TIME + Patrol360**: COUNT and DETAIL are the *same* upstream endpoint (`OneDashboard_Work_Get`)
  with different payloads — `TimePatrol360ModuleAdapter` has two payload builders even though both
  configured URLs point at the same host/path.
- **One Portal (Member/Scheme)**: GET + query parameters, not POST + JSON body — the only two
  adapters using `IResilientApiClient.GetAsync` instead of `PostJsonAsync`.
- **TAHDCO Scheme**: the COUNT endpoint is `GET /Report/GetSchemeSummary`, not
  `GetDistrictSummary` — corrected against the real Postman collection the user supplied; the
  discrepancy and correction are documented in a code comment in `TahdcoSchemeModuleAdapter.cs`.

Normalization currently uses a generic, shape-tolerant helper (`JsonNormalizationHelper`) rather
than exact per-field mappings, because this sandbox cannot reach any of the 7 upstream hosts to
capture a real sample response (see §11).

## 5. Database schema (migration `06_detail_cache_schema.sql`)

| Table | Purpose |
|---|---|
| `detail_api_cache` | One row per `(module, operation, cache_key)`. Holds `response_data` (raw), `normalized_data` (JSON), `status` (FRESH/STALE/API_FAILED/EMPTY), `is_stale`, `expires_at`, `last_success_at`. |
| `detail_api_records` | One row per normalized DETAIL record, FK to `detail_api_cache`, with `search_text` (FULLTEXT-indexed) for keyword retrieval. |
| `api_fetch_log` | Structured audit trail of every fetch attempt — correlation ID, success/failure, retry count, sanitized error message (never a raw stack trace). |

The failure-handling contract is enforced at the SQL layer, not just in C#:
`DetailCacheRepository.MarkFailedAsync` only ever writes `fetched_at`, `status`, `is_stale` — it is
structurally incapable of touching `response_data`/`normalized_data`, so a future refactor cannot
accidentally reintroduce a data-clearing failure path. `API.Tests/DetailCacheRepositoryTests.cs`
(TEST 14) asserts this against the real SQL string.

## 6. MCP tools — the LLM's only interface to application data

`backend/BAL/Service/DashboardMcpToolService.cs` exposes exactly 6 tools, matching spec §14:

`get_dashboard_count`, `get_detail_data`, `search_detail_records`, `get_cached_data_status`,
`refresh_detail_data`, `get_data_source`.

Guarantees, enforced in `DashboardMcpToolService.GuardAsync` before any tool body runs:

- **No arbitrary SQL / no arbitrary URL** — `module` is the only caller-controlled routing value,
  and it is checked against `DashboardModule.All` before any DB or HTTP call.
- **Authentication** — `userId <= 0` is rejected outright.
- **Rate limiting** — a 30-calls-per-minute-per-user in-process sliding window (MCP tools are
  invoked programmatically from `AIService`, not through the ASP.NET HTTP rate limiter, so they
  need their own guard).
- **Audit logging** — every call logs tool name, user, module, success/failure, duration.
- Every tool delegates to the *same* `IModuleAdapterRegistry` / `IDetailCacheService` /
  `ICountCacheService` the REST controller uses — there is no second, unaudited code path.

These 6 tools are merged into the existing AI assistant's tool catalog in `AIService`
(`GetMcpToolsAsync`/`ExecuteMcpToolAsync`), alongside the pre-existing `IMCPToolService` tools. The
legacy `MCPToolService` (which contains hard-coded example figures such as
`TotalMemberApplications = 251483`) was deliberately left untouched rather than patched — it serves
a separate, older part of the AI widget — and none of its hard-coded output is used by the new
grounded path.

## 7. RAG / grounding

`backend/BAL/Service/DetailRecordRetrievalService.cs` retrieves from `detail_api_records`:
**STRUCTURED** mode when the caller already supplied district/division/metric filters, **KEYWORD**
mode (stop-word-stripped `LIKE` search over `search_text`) otherwise. There is no embeddings
provider anywhere in this stack, so "semantic retrieval" here means keyword/full-text matching, not
vector similarity — documented explicitly in the interface so it's never assumed to be more than it
is.

`AIService.ProcessChatQueryAsync` / `StreamChatQueryAsync` both call this retrieval and prepend a
**"Live Dashboard Data"** block plus a fixed `GroundingRules` block to the system prompt, e.g.:

```
DATA GROUNDING RULES (must follow exactly):
1. Only state a specific count/district/status/detail if it appears in the Live Dashboard Data
   block or was returned by an MCP tool call in this conversation.
2. Never invent, estimate, round, or infer a number/district/division/status not explicitly present.
3. If a record is marked STALE, say so in the answer.
4. If no matching data was retrieved, say so plainly instead of guessing.
5. Policy/guideline RAG context must not be blended into a numeric claim.
```

Every returned record carries its own `stale` flag and `lastSuccessAt`, joined in from
`detail_api_cache` at query time (`DetailCacheRepository.SearchRecordsAsync`), so staleness can
never be silently dropped between the DB and the prompt.

## 8. Frontend

- `frontend/src/app/core/models/index.ts` — `DASHBOARD_MODULES` config array + `ClickContext`,
  `NormalizedCount`, `NormalizedDetailRecord`, `DashboardCacheResult<T>`, `DashboardDataStatus`,
  `DashboardRefreshResult` — field names match the backend DTOs exactly (ASP.NET's default
  camelCase JSON policy makes this a 1:1 mapping with no translation layer).
- `frontend/src/app/core/services/data.service.ts` — `getModuleCount`/`getModuleDetail`/
  `getModuleDataStatus`/`getModuleDataSource`/`refreshModuleDetail`. Deliberately does **not**
  follow this file's usual "return fabricated mock data on HTTP failure" pattern — an HTTP failure
  here degrades to an honest `unavailable: true` result, matching the backend's own contract.
- `frontend/src/app/modules/multi-dashboard/` — `MultiDashboardComponent`: module tabs → COUNT
  table → click a row → inline-expanding DETAIL panel (same expand-in-place pattern as the existing
  `dashboard-md` screen), with a `DataStatus` badge (FRESH/STALE/API_FAILED/EMPTY,
  "last confirmed" timestamp) and a manual Refresh button on both the count table and the detail
  panel. Registered at route `/multi-dashboard`, gated by the same `{ apps: [...] }` route-data
  convention as every other module screen.
- The global `AiAssistantComponent` needed no changes — it already calls `POST /api/v1/ai/chat`,
  which now carries the grounding block/rules automatically from the backend change in §7.

## 9. Configuration

`backend/API/appsettings.json` gained two sections:

- `DataFreshnessPolicy.Modules.<MODULE>` — `CountTTLSeconds`/`DetailTTLSeconds` per module
  (default 300/600s for all 7; tune independently once real traffic patterns are known).
- `ModuleApiConfig.Modules.<MODULE>` — `CountUrl`/`DetailUrl`/`TimeoutSeconds`/`MaxRetries` per
  module, populated with the real QA URLs supplied in the spec (`qatelp.pixous.info`,
  `scst.pixous.info`, `timeqa.pixous.info`, `thms.tahdco.com`, `tams.tahdco.com`,
  `testtncwwbv2-qa.pixoustech.app`). No secrets/API keys are embedded in these URLs or in any
  frontend code — the 7 upstream endpoints used in this project don't require an API key/token in
  the request itself (confirmed against the supplied Postman collection).

All 15+ new services/adapters are registered in
`backend/API/Infrastructure/ServiceCollectionExtensions.cs` (`AddAppServices`).

## 10. Tests

`backend/API.Tests/` — `DetailCacheServiceTests.cs`, `CountCacheServiceTests.cs`,
`SingleFlightRegistryTests.cs`, `DetailCacheRepositoryTests.cs`, `DashboardMcpToolServiceTests.cs`.
16 named scenarios total, covering: fresh-cache short-circuit, stale-cache-returns-immediately,
no-cache success/failure, manual refresh success/failure (and that failure never calls
`UpsertSuccessAsync`), data-status fresh/stale/missing, data-source CACHE/STALE/NONE, COUNT-side
mirror of the fresh/failure behavior, request de-duplication (concurrent identical calls invoke the
factory exactly once), the SQL-level "failure never touches response/normalized data" guarantee,
MCP module-validation-before-any-downstream-call, and MCP per-user rate limiting. All use Moq
against the interfaces — no real database or network call.

## 11. What this document does not claim

This sandbox has no .NET SDK, no MySQL server, no root access, and the outbound proxy returns
`403` for every one of the 7 upstream API hosts plus `nuget.org`/`dot.net`. As a direct consequence:

- **Nothing in this feature has been compiled.** All cross-referencing of method signatures,
  namespaces, and constructor parameters was done by careful manual reading of every dependency
  before writing each call site — but a `dotnet build` has not run, and cannot run here.
- **No migration has been applied to a real database**, and no adapter has ever received a real
  response from any of the 7 upstream APIs — normalization logic is generic/shape-tolerant by
  necessity, not validated against real payloads.
- **No test in `API.Tests/` has been executed.** They are written to compile against the exact
  interfaces defined in this session and follow the existing test project's Moq/xUnit conventions,
  but "written correctly by inspection" is not the same as "green."
- **No Angular build has run** — `ng build`/`ng serve` were not available in this sandbox either.

Before this ships: run `dotnet build` (and fix whatever it finds), run `dotnet test`, apply
migration `06_detail_cache_schema.sql` to a real MySQL instance, capture one real response sample
per module (COUNT and DETAIL) from an environment that can reach the upstream hosts and tighten
`NormalizeCountResponse`/`NormalizeDetailResponse` against those real shapes, and run
`ng build`/`ng serve` against the real backend.
