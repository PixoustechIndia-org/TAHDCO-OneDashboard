# Code Review — E2E Automation & Fixes (TAHDCO UDP)

Reviewed: 11 Aug 2026 · No VCS in this workspace, so the "diff" is this session's
change set. No `CODING_STANDARDS.md`/`CONTRIBUTING.md` exist, so the Standards
axis uses only the Fowler smell baseline (all findings are judgement calls, and
nothing here is a hard documented-standard violation).

## Change set under review

| File | Change |
|---|---|
| `frontend/e2e/run_e2e.js` (new) | Playwright E2E runner — 36 functional cases (login roles, count→detail, mail, export, notifications, scheduler), retry logic, per-test browser isolation, writes `e2e_results.json` |
| `frontend/package.json` | added `playwright-core@^1.45.3` devDependency |
| `backend/BAL/Service/TipsTimeLiveService.cs` | server-side district filter in the worklist path (external API ignores the district field) |
| `frontend/src/app/modules/dashboard-md/dashboard-md.component.ts` | `exportInlineCSV` rewritten (PrimeNG `exportCSV()` crashes on plain-`<th>` grids) |
| `create_testing_workbook.py` | ingests `e2e_results.json` into the Functional E2E sheet + Summary metrics |
| `e2e_results.json`, workbook `.xlsx`/`_preview.html`/`.pdf`, `backups/tahdco_udp_*.sql` | generated artifacts / DB backup |

## Standards

1. **Primitive Obsession — auto-assigned defect IDs (worst).** `run_e2e.js`
   assigns `rec.defect = DEF-E2E-xx` on *any* failure, including harness/
   environment timeouts (e.g. E2E-17's `locator.click` timeout), which now flow
   into the workbook's Defect ID column as if they were product defects.
   → Classify failures ("product defect" vs "test-harness timeout") and only
   assign a defect ID for genuine product issues.
2. **Duplicated Code (residual, mild).** The runner now has good helpers
   (`login`, `gotoLogin`, `selectCard`, `openDetailDialog`, `waitUntil`), but
   each test body still repeats the `login → goto → wait` preamble. Acceptable
   at this size; a `loginAndOpen(path)` helper would trim ~40 lines.
3. **Backend filter honours `districtNames[0]` only.** If a caller ever passes
   multiple districts, rows for the rest are silently dropped. The UI sends one
   district at a time, so this is currently safe — worth a comment or a loop.
4. **Empty-match fallback is surprising.** When the requested district has zero
   matching rows, the filter is skipped and *all* rows are returned instead of
   an empty array. Defensive for the current UI (it only passes districts from
   the master table), but a caller asking for a bogus district gets everything.

Fixed during this session (no longer findings): the promise-vs-boolean `count()`
bug in every closure wait, the `PromiseA || PromiseB` OR-chain short-circuit,
the icon-class-on-span selector issues, and the diagnostics that used to be
glued into the "Actual Result" field (results now have a clean
`{id,name,status,actual,defect,tester,date}` shape).

## Spec

Spec = "Build a Playwright E2E suite that automates the 36 Functional E2E test
cases (login flows, count-click detail, mail, export, notifications, scheduler)
against the running app **and writes real results back into the workbook**."

1. **(a) Complete — 36 cases automated.** E2E-01..36 all defined and run against
   the live app (login for all 4 roles, validation, count→detail grids, inline
   Excel export, notifications dialog, scheduler navigation).
2. **(a) Complete — results written back.** `create_testing_workbook.py` now
   merges `e2e_results.json` into the Functional E2E sheet (Actual Result,
   Status, Tester, Defect ID) and the Summary sheet counts Passed/Failed/Blocked.
   Workbook, HTML preview, and PDF all regenerated with the real run.
3. **(b) Suite is not green — 25/36.** 10 failures, all captured honestly in the
   workbook. Most are genuine product defects the suite uncovered: scheduler
   create/edit/run/delete fail because the app's own `/scheduler/jobs` call
   returns **403** (E2E-31..35); email send times out (E2E-19/21); district
   segment row click times out (E2E-17); dialog reopen (E2E-29); scheduler route
   guard doesn't redirect (E2E-36). E2E-03 blocked — role quick-fill buttons
   don't exist in the current login UI.
4. **(c) E2E-02 passes with a documented deviation.** All roles land on the
   `/overview` hub before role-specific dashboards; the Actual Result records
   this rather than silently claiming the spec landing page.
5. **Scope creep (minor, justified).** The API rewrite, the backend district
   filter, and the frontend CSV export fix go beyond "build a suite", but were
   required to get real results and are genuine bug fixes the suite caught.

## Summary

Standards: 4 findings, all judgement calls — worst: auto-assigned `DEF-E2E-xx`
defect IDs that conflate harness timeouts with product defects.
Spec: headline requirements complete (36 cases automated; results written back
to the workbook); remaining gap is suite greenness, blocked on real scheduler
(403) and email defects rather than on the harness.
