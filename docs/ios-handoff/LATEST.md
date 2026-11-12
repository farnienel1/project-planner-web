# iOS follow-on — rulebook 1.38.0

Generated 2026-11-12 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.38.0 → 1.38.0
Packed hash: c6044a495a3481c282116ae3b9905e206c68fb2374ade3e2f0f5e0aa9984c454
Rulebook sha256: d6d2d6e8c4836d644ef97825dfdca8a919bea5d1c7f5ca69fafcae3bf6e4828a
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 59d6bc6123f250e1f57599240eb3190ab48f5cd2532f8281a99360d9e187d86b
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md
Done when:
- [ ] Packed hash in iOS equals c6044a495a3481c282116ae3b9905e206c68fb2374ade3e2f0f5e0aa9984c454
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 d6d2d6e8c4836d644ef97825dfdca8a919bea5d1c7f5ca69fafcae3bf6e4828a)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.38.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.38.0

- **Data check** (new §27, owner decision 11 Nov): each app compares the server's `count()` of each listener's own query with the documents it holds for that query (projects, small works, users, operatives, managers, clients, bookings and manager site bookings in the loaded window, annual leave, tasks), re-reads and re-attaches a list that differs, checks again and keeps the last 20 results on the device. Nothing is shown in the launch build (owner change 11 Nov): the admin panel in Settings → Data health, with **Check now**, appears only while `platformConfig/app.dataCheckPanel` is on (`DATA_CHECK_PANEL_SWITCH_FIELD`, `DATA_CHECK_PANEL_ORGANIZATION_IDS_FIELD`, `dataCheckPanelEnabled`, `dataCheckPanelVisible`; missing = off). Read-only: no writes, no rules change. `DATA_PARITY_CHECKS`, `dataParityCheck`, `dataParityCheckDue`, `DATA_PARITY_MIN_INTERVAL_MS`, `dataParityLogEntry`, `dataParityLogAppend`, `DATA_PARITY_LOG_LIMIT`, `dataParitySummary`, `dataParitySumCounts`, `dataParityCheckDefinition`, `DATA_PARITY_SKIP_REASONS` (with `pendingWrites` and `awaitingServerSnapshot`), `DATA_PARITY_TRIGGERS`, `dataParityConfirm`, `DATA_PARITY_CONFIRM_DELAY_MS`.
- **Review fixes (before release):** the device count is the listener's documents by stored id with case kept (iOS counted its filtered store lists and case-folded UUIDs, so placeholder rows, nameless clients and unreadable documents read as differences); lists with unconfirmed local writes or no server answer yet are skipped; a difference is re-read only after a second look finds it again (`dataParityConfirm`); a re-read keeps this device's unconfirmed documents and a plan restart keeps its rows until the server answers (no flicker); the throttle is shared by every browser tab; no console or device-log output in production builds; the panel sits under Data health on both apps (iOS Settings → Data health). The fixture gains operatives, managers and clients (`rawLists`). Re-review: listeners run with metadata changes so a quiet list's server answer is seen (metadata-only snapshots stop at the check's flags); a heal never runs after a company switch; iOS forgets confirmed jobs of a re-attached job list.
- **Two-app comparison in CI** (§27): `lib/canonical/data-parity-fixture.json`, mirrored to iOS (`ProjectPlannerTests/DataParityFixture.json`, `dataParityFixtureSha256` in the manifest), fed through each app's own store and merge code by web `lib/dataParity/dataParityFixture.test.ts` and iOS `DataParityFixtureTests`.
- **Web fix found by the fixture:** a cache snapshot shorter than the list on screen no longer replaces it (it only adds and updates rows, like iOS); only a server snapshot removes a row (`retainLoadedRows` with `authoritative: false`). The listener and store merges are now pure modules (`lib/firebase/orgCollectionMerge.ts`, `lib/stores/jobListMerge.ts`, `lib/stores/bookingListMerge.ts`, `lib/staff/rosterDocuments.ts`).

## iOS work for 1.38.0

**Sync first.** 1.38.0 adds the read-only data check and the two-app comparison fixture (§27, owner decision 11 Nov). No Firestore field, rules or `minimumIosBuild` change. New exports `DATA_PARITY_CHECKS`, `dataParityCheck`, `dataParityCheckDue`, `dataParityLogEntry`, `dataParityLogAppend`, `dataParitySummary`, `dataParitySumCounts`, `dataParityCheckDefinition`, `DATA_PARITY_*`; new mirrored file `ProjectPlannerTests/DataParityFixture.json` (manifest `dataParityFixtureSha256`).

1. **Sync** — add `lib/canonical/data-parity-fixture.json|ProjectPlannerTests/DataParityFixture.json` to `scripts/sync-rulebook-from-web.sh` (checked against the manifest like the contract) and to `scripts/rulebook-guard.sh`; `RulebookParityTests` checks its sha256.
2. **Bridge** — `Core/Rulebook+DataParity.swift`: `CanonicalBusinessEngine.dataParityCheck(lists:)`, `dataParityCheckDue(...)`, `dataParityLogEntry(...)`, `dataParityLogAppend(...)`, `dataParitySummary(...)`, `dataParityChecks`.
3. **Monitor** — `Core/DataParityMonitor.swift`: per list, the server `count()` (`AggregateSource.server`) of exactly the listener's query (the read plan's queries summed; a plan with document reads is `skipped: documentReads`), the store's held list before rulebook filters (projects/small works from `ProjectStore`, small works via `ProjectWorksMerge.smallWorksList`; users `organizationUserDocuments` whose stored organisation is the open one; bookings within the launch window), plus the placeholder job document as `readerDroppedCount`. On a mismatch remove the store's listener and attach it again (self-heal), wait, compare again, keep the last 20 results in `UserDefaults` per organisation. Triggers: open, foreground (`scenePhase` active) and a 10-minute timer while active; never offline; `dataParityCheckDue` decides.
4. **Data health — hidden in the launch build** (owner change 11 Nov). The check runs silently for everyone; results stay in the device log. The admin "Data check" card (`dataParitySummary`, organisation zone, **Check now**) is shown only when `dataCheckPanelVisible({ viewerIsAdmin, dataCheckPanelEnabled: dataCheckPanelEnabled(platformConfig/app, orgId) })` — `platformConfig/app.dataCheckPanel` missing = hidden, read like `ghostAccounts`.
5. **CI fixture** — `ProjectPlannerTests/DataParityFixtureTests.swift` feeds `DataParityFixture.json` through `LiveSnapshotMerge`, `ProjectStore.liveWorkSliceResult` + `ProjectWorksMerge.smallWorksList`, `BookingStore.liveBookingsMerge` and `UserStore.liveRosterMerge` (with the full reload a server removal triggers) and asserts `expectedHeld`, `expectedVisible` (`worksListMembership`) and `expectedParityMismatches` after every step. Extract `liveWorkSliceResult` from `applyLiveWorkSlice` and `liveBookingsMerge` from `applyRemoteBookings` without changing behaviour.
6. **Review fixes (same release, before merge).** (a) Count what the listener received, by stored document id with case kept — never the store's filtered list or `String(describing: uuid)`: `DataParityListenerLedger` records each listener's raw document ids (`listenOrganizationQuery`, `listenPlannedSources`) merged with `DataParityListenerLedger.merge` (the `LiveSnapshotMerge` rule on ids); operatives, managers, clients, annual leave, tasks, bookings and manager site bookings use it; projects / small works keep the store list and take `readerDroppedCount` from the ledger's `INITIAL-PLACEHOLDER` (no extra server read). (b) Skip a list whose last snapshot had `hasPendingWrites` unless `Firestore.waitForPendingWrites` finishes within 5 s (`pendingWrites`), and one whose listener has no server snapshot yet (`awaitingServerSnapshot`). (c) Two looks: compare again after `DATA_PARITY_CONFIRM_DELAY_MS` and heal only `dataParityConfirm(...)`'s lists. (d) `NSLog` only in DEBUG. (e) The panel lives in Settings → Data health (a row shown only while `dataCheckPanelVisible`), follows the switch and the organisation switch, and adds no gap when hidden. (f) `DataParityFixtureTests` reads `rawLists` (operatives, managers, clients) through `DataParityListenerLedger.merge`, compares them with case kept, and feeds bookings to `dataParityCheck` the way the monitor does.


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
