# iOS follow-on — rulebook 1.21.0

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.20.4 → 1.21.0
Packed hash: 241c7959f5c0601f28e78cba3d82411968c93a1a7b731462eb18ceaa90a6c154
Rulebook sha256: 061dd211ca69d1f4a31cbe9d8c3237b677acf6d4db652e6e25027298c81d4338
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: c9e307b0604e78284baf3a4f217f0fb3ecc4b227aec957c901bdd93e4e31a306
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: WORKS_TABS, activeJobsCount, bookableJobs, jobDayKeys, jobWorkStatus, operativeJobIds, visibleJobs, worksInTab, worksListMembership, worksListPersonIds, worksTab, worksTabCounts
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/parity-fixture.json, lib/canonical/workDocumentReaders.ts, lib/canonical/worksLists.ts
Done when:
- [ ] Packed hash in iOS equals 241c7959f5c0601f28e78cba3d82411968c93a1a7b731462eb18ceaa90a6c154
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 061dd211ca69d1f4a31cbe9d8c3237b677acf6d4db652e6e25027298c81d4338)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.21.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.21.0

- Job lists are one shared rule (new §21, `lib/canonical/worksLists.ts`): list membership `worksListMembership` (every document of the collection, inactive included; collection decides the kind), per-viewer visibility `visibleJobs` / `operativeJobIds` / `worksListPersonIds`, tabs and counts `jobWorkStatus` / `worksTab` / `worksInTab` / `worksTabCounts` (inactive → Completed; All = every row), booking pickers `bookableJobs`, Home `activeJobsCount`. Stores keep every job: web's shared `projectsIncludeInactive` flag (Projects, Clients and Site Audit hid inactive projects, and changed the store for every other screen by load order) and iOS `ProjectStore.smallWorks` (live only) are removed.
- Operatives see jobs through tasks as well as bookings and deadlines on web too (§17 already said so); web read their job documents from bookings only.
- Booking pickers check `canWriteBooking` and the job's dates on the booking day (web Book labour skipped `canWriteBooking`; My Schedule and the Daily Overview sheet offered inactive jobs under Completed / All).
- A job's status day is the organisation zone everywhere (`jobWorkStatus` takes the zone as a required argument; web defaulted to London).
- Web Daily Overview decides small works by collection (`jobKind`), not by `jobType` text.
- `parseJobDocument` reads a numeric `jobNumber` as text.
- iOS hand-off (audit findings 1–5, 10, 13, 14), every file below calls the §21 functions through `CanonicalBusinessEngine` and keeps no list rule of its own: `Core/ProjectStore.swift` (`smallWorks` keeps every document — drop the `isLive` filter at ~984-986; lookups use the full list); `Views/ProjectSmallWorksRevampTokens.swift` (`WorksListStatusCounts` → `worksTabCounts`, inactive under Completed, All = rows); `Views/ProjectsView.swift` and `Views/SmallWorksView.swift` (membership `worksListMembership`, visibility `visibleJobs` instead of their own code and the name fallback, chips `worksInTab`); `Views/TasksDetailView.swift`, `Views/WeeklyReportView.swift`, `Views/ScheduleOperativeView.swift` and the `TimesheetPayrollCollector` call sites (`Views/InvoicingView.swift`, `Core/WeeklyReportTimesheetFeed.swift`) look jobs up in the full list; `Navigation/MainMenuCatalog.swift` ("N open" → `worksTabCounts(...).active` over `visibleJobs`); `Core/WorkAccess.swift` (`visibleWorks` / `operativeVisibleProjectIds` → `visibleJobs` / `operativeJobIds`; home count at ~128-171 → `activeJobsCount`, used by `Views/HomeView.swift`); `Views/BookLabourFlowView.swift` and `Views/MyScheduleView.swift` (job pickers → `bookableJobs` with the booking day keys); `Views/SiteAuditView.swift` (counts `worksTabCounts`); `Core/ProjectStatusRulebook.swift` / `Models/ProjectModels.swift` (status → `jobWorkStatus` with the organisation zone, no `Calendar.current` fallback). Delete dead `Models/ProjectWorksMerge.swift` `dedupeByJobNumber`.

## New rulebook sections

- 21. Job lists (1.21.0)
- 1.21.0 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
