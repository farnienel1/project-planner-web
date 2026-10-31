# Project Planner — iOS Alignment Master Prompt (iOS App Agent)

> Paste this whole file into the agent working in **project-planner-ios**. It is self-contained. The canonical rulebook is reproduced in full at the end (Appendix A).

## Your role and scope

You are working on the **Project Planner iOS app** (SwiftUI + Firebase iOS SDK). It shares one Firebase project with the **web app** (`project-planner-web`, projectplanner.us). An Android app will follow and must reuse the same rules.

Both platforms run **one rulebook** and **one Firebase data model**:
- Rule text: `docs/RULEBOOK.md` — **version 1.1.0**. The copy in `project-planner-web` is canonical. iOS keeps a **byte-identical mirror** at `docs/RULEBOOK.md`. Never edit the mirror by hand.
- Rule code: `project-planner-web/lib/canonical`, packed into `canonical-business.js`. iOS evaluates it through `Project Planner/Canonical/CanonicalBusinessEngine.swift`. iOS never re-implements a rule in Swift.
- Published pack for 1.1.0:
  - packed script sha256 `13c1194b676fb6ba3e42585ea7bc9cf2e165af5fbb74fc4d1a9ed55dfb7dc0c7`
  - rulebook sha256 `36f61c979df49622f619e6c101e83b9d24e4d7694e494db53762af3c2b9e826c`
  - source: web branch `main-kr70k9` (until it merges to `main`).

**Precedence.** Where web and iOS differ, the web data model and rules win and iOS conforms. Exceptions — web has adopted these iOS features, and iOS now reads/writes them the shared way: organisation currency, the invoicing schedule summary, rates on the profile, VAT/UTR billing details, scheduled working-hours changes. Where web has a feature iOS lacks (custom schedule items on/off, address line 2 / county, approved-clashes section on the weekly report), iOS gains it.

**Ground rules.**
- Edit **only the iOS repo**. Read the web repo for reference (clone it beside this repo as `../project-planner-web`). Never edit web code; a web-side gap goes into your report for the web agent (see the end).
- **Do not invent rules.** If code and rulebook disagree on something the rulebook does not settle, list it as **"Decision needed"**. Do not pick an answer yourself.
- "No gap found" is a valid outcome for an area.
- No second calculator: if a rule exists in the packed script, Swift calls `CanonicalBusinessEngine`. Delete Swift copies of rules once callers move (e.g. `WarningsComputation.unbookedPeople/unbookedNames`, `InvoicingPeriodResolver`, `PayrollRateResolver`, `OrgWarningDetectionSettings.coverageEnd`).
- Field names, types, enums and document shapes must match web exactly (`ORGANIZATION_DOCUMENT_FIELDS`, `USER_DOCUMENT_FIELDS`, `OPERATIONAL_COLLECTION_PATHS` in the packed script). Writes are **partial updates of changed fields only** (`updateData` with dotted keys). Never use a dotted key with `setData(merge:)` — it becomes a literal field name.
- Every shared write adds `updatedBy`/`updatedFrom: "ios"` (`writeMetadataFields(uid, "ios")`) and `updatedAt: FieldValue.serverTimestamp()`.
- Firestore security rules are deployed **only from the web repo**. The updated web rules (not yet deployed) will refuse several writes iOS makes today — see §C.11. Fix those before the rules go live.

---

## How this runs (three phases, with stops)

### Phase 1 — Sync, investigate, Gap Report (no feature code changes)
1. **Install the rulebook sync first** (§B). This is the only code change allowed in Phase 1, because every later check depends on it. Run it, commit the mirrored files, run the tests.
2. **Map the iOS stack**: SwiftUI state (stores/observable objects), Firebase usage (Firestore listeners vs one-off reads, offline cache, the `OfflineOutboxStore` queue), where each shared rule is computed.
3. **Find every place iOS computes a shared rule itself** (Daily Overview, warnings, overtime, timesheets, weekly report, My Schedule, pay, leave) and whether it calls `CanonicalBusinessEngine`.
4. **Compare iOS with web field-by-field** for every shared setting and record (names, types, defaults, units, time zone, listener vs fetch).
5. **Verify every item in §C** (known iOS gaps found by the web agent) and anything else you find.
6. **Output the Gap Report in chat**, then **STOP and wait for the user**.

**Gap Report format.** Short summary first (stack, rulebook mirror status, number of gaps by severity). Then a numbered list, each item with:
- **#. Title** — area
- **Finding** — plain English
- **Evidence** — file paths, functions, fields (iOS, and web where relevant)
- **Rule** — the RULEBOOK.md section heading that applies
- **Severity** — High (data wrong or out of sync), Medium (feature missing on one side), Low (cosmetic/UX)
- **Solution** — the recommended fix
- **Action** — Platform: iOS / Web (report to web agent) / Firebase rules / Rulebook text / **Decision needed**; Claude can fix: Yes / No (reason)

Finish with a short list of **items that need web changes**. Keep it concise; no large code blocks.

### Phase 2 — Implement only what the user approves
Implement only approved iOS items. Then report: what changed (files + why), anything you could not do, and anything that needs web changes. **STOP and wait.**

### Phase 3 — Report web-side gaps
Write a short hand-off for the web agent listing every web-side gap or rule question you found (same Finding/Evidence/Rule format). Never "fix" a web gap by diverging on iOS.

---

## B. Rulebook sync — make drift impossible (do this first)

The web repo already enforces its side: every rule change bumps `docs/RULEBOOK.md` `Version:`, adds a changelog entry, re-packs the script (with the rulebook version and sha256 stamped inside), writes `lib/canonical/dist/canonical-manifest.json`, and writes the iOS hand-off `docs/ios-handoff/LATEST.md`. A daily web CI job goes red while iOS lags. Build the matching iOS half:

1. **`scripts/sync-rulebook-from-web.sh`** — copies, byte for byte, from `../project-planner-web` (or, when that checkout is missing, from `https://raw.githubusercontent.com/farnienel1/project-planner-web/<branch>/…` with the branch as an argument, default `main`):
   - `lib/canonical/dist/canonical-business.js` → `Project Planner/Canonical/canonical-business.js`
   - `lib/canonical/dist/canonical-business.sha256` → `Project Planner/Canonical/canonical-business.js.sha256`
   - `lib/canonical/dist/canonical-manifest.json` → `Project Planner/Canonical/canonical-manifest.json`
   - `docs/RULEBOOK.md` → `docs/RULEBOOK.md`
   - `lib/canonical/parity-fixture.json` → `ProjectPlannerTests/CanonicalParityFixture.json`
   It verifies the sha256 values against the manifest and prints the rulebook version. Add `canonical-manifest.json` to the app target's resources.
2. **`CanonicalBusinessEngine.rulebookStamp()`** — expose the packed `rulebookStamp()` (`{ version, sha256 }`).
3. **`ProjectPlannerTests/RulebookParityTests.swift`** — fails when:
   - the sha256 of the bundled `canonical-business.js` ≠ `canonical-manifest.json.bundleSha256` or the `.sha256` file;
   - `rulebookStamp().version` ≠ the `Version:` line in `docs/RULEBOOK.md`, or `rulebookStamp().sha256` ≠ the sha256 of `docs/RULEBOOK.md`;
   - any function named in `manifest.exports` is missing from the evaluated script;
   - the existing parity fixture cases fail.
4. **iOS Claude Code guard** — add `.claude/settings.json` with a Stop hook that runs a small script (`scripts/rulebook-guard.sh`): if the working tree changes `Project Planner/Canonical/canonical-business.js`, `canonical-manifest.json` or `docs/RULEBOOK.md` other than via the sync script (sha256 ≠ manifest), or if Swift files add logic for an area the rulebook owns without a `CanonicalBusinessEngine` call, it exits 2 with the reason. Respect `stop_hook_active` to avoid loops. Also add a SessionStart hook that prints the mirrored rulebook version and, when `../project-planner-web` exists, whether web has a newer version.
5. **`CLAUDE.md` / `AGENTS.md` (iOS)** — state: `docs/RULEBOOK.md` is a mirror of web and is never edited here; rule changes start in web `lib/canonical`; iOS calls `CanonicalBusinessEngine`; every web-side gap is reported to the web agent. Remove or replace the iOS copies that drifted: `docs/CANONICAL_ARCHITECTURE.md` (point to the web file), the iOS `docs/agent-rules/*` duplicates, and the stale `Project Planner/firestore.rules` (delete it; rules deploy only from web).
6. **iOS CI (if the repo has one, or add a GitHub Action)** — run `RulebookParityTests`, and fail when web's published manifest (raw GitHub, `main`) has a different `bundleSha256` than iOS — the same drift alarm web runs.

---

## C. Known iOS gaps (verify each; file refs from the web agent's read of the iOS repo)

### C.1 Sync and data
1. **Packed script is stale** — iOS hash `02e6d9ae…` lacks `resolvedWarningKeys`, `isWarningActive` and every 1.0.0 / 1.1.0 function. Sync (§B).
2. **Org settings not live** — the org listener (`FirebaseBackend.swift:331-355`) applies only schedule options, material cut-off and billing; every other setting comes from sign-in or the local cache (`:1103-1106`). Apply every field from the live `organizations/{orgId}` snapshot. Manage Users lists use one-off `getDocuments` (`Core/UserStore.swift:376-470`) — make them live.
3. **Write metadata** — only `updatedAt` from the device clock (~64 `Timestamp(date:)`). Use server timestamps + `updatedBy`/`updatedFrom`.
4. **Time zone** — use `organizationTimeZone(countryCode)` everywhere. Device-calendar day keys: `Core/PayrollTimePolicyCatalog.swift:66-81`, `Core/BookingStore.swift:378-435`, `WeeklyReportView.swift:97-105,781-794`, `MyScheduleView.swift:626`, `DailyOverviewView.swift:47,292`, `PayrollRateResolver.swift:83-85,110`, holiday day checks. `CanonicalBusinessEngine.coverageWindow` passes a fixed "Europe/London" (`:375`) — pass the org zone.

### C.2 Company details and currency
5. **Currency save reverts** — `FirebaseBackend.swift:5211-5217` uses `setData(merge:)` with key `"settings.currencyCode"` (stored as a literal field), then reads nested first (`:1275-1282`). Same bug for `"settings.bankHolidayRegionId"` (`:5139`, `:5181`, read `:1267-1274`). Use `updateData(organizationCurrencyWriteFields(code))`; read with `resolveOrganizationCurrency`.
6. **Currency never used for money** — hard-coded £ in `InvoicingView` (23 places), `TimesheetManagerReviewSupport` (9), `PayrollRateResolver` (3), `OperativeProfileView:86`, `SettingsHubSupportViews.swift:228-234` (`"£%.2f"`); locale symbols in `OperativesView:12`, `ManageUsersView:3864-3866`. Use `formatMoney(amount, orgCurrency)` everywhere. Picker = `CURRENCY_OPTIONS` (the same 11), default `defaultCurrencyForCountry`.
7. **Company details** — `Views/CompanyDetailsEditView.swift`, `FirebaseBackend.updateOrganizationCompanyDetails` (`:5341-5396`): add Address line 2 and County, read with `parseCompanyDetails` (nested `officeAddress` fallback), save with `companyDetailsWriteFields` (deletes `officeAddress`, deletes blanks), validate with `companyDetailsValidationError`.

### C.3 Working hours and payment runs
8. **Working hours** — apply-now writes `payrollTimePolicyScheduled: NSNull()` (`FirebaseBackend.swift:4978-5020`), cancelling a pending change; prior = current instead of yesterday's rules; device day key. Use `payrollTimePolicyApplyNowWriteFields` / `payrollTimePolicyScheduleWriteFields` / `payrollTimePolicyCancelScheduleWriteFields`; read with `effectivePayrollTimePolicy` / `payrollTimePolicyTimeline` (replace `appliedPolicyState` / `policy(for:)`, `FirebaseBackend.swift:1286-1312`). Limits = `validatePayrollTimePolicy` / `PAYROLL_POLICY_LIMITS` (break 0–120, paid and counts-as 1–12, multipliers ×1–×3) — today iOS is 0–90 / 1–24 / clamp. Add a cancel-scheduled action.
9. **Payment runs** — `Core/InvoicingPeriodResolver.swift:84-94` diverges from the canonical fallback; use `activePaymentRunSummary`. `OrganisationInvoicingSettingsView` must enforce `validateInvoicingSettings` (run 1 ends by the 27th) and show "Paid on" from `paymentRunPayDate`. History is built from the in-memory copy (`:5035-5082`) — read the server copy.

### C.4 Warnings
10. **Pending users flagged** — iOS never passes the user `status` to `unbookedLabourRows` (`WarningsComputation.swift:1161-1172`, per-day path ~`:955`; `AppUser` has no `status`, `Models/AppModels.swift:396`). Add it.
11. **Material cut-off** — own Swift copy (`WarningsComputation.swift:330-336,602-650`). Call `materialCutOffWarningRows({ now: ISO, timeZone, cutOff: settings.materialCutOff, projects:[{id,jobNumber,siteName}], bookings:[{projectId,status,dayKey}], materials:[{id,projectId,status,dayKey}], sendRecords:[{requestType,materialIds}] })` and use the row `id` as `resolutionKey` (today `materials-{uuid}-{epoch}`).
12. **Clash approvals** — operative clash key `op-clash-{uuid}-{epoch}-{i}` (`:487`) → `clashResolutionKey`. `WarningResolutionStore.approve` (`:164-185`) → `clashApprovalWrites`; `unapprove` (`:220-237`) must also delete `acceptedBookingClashes/{clashPairKey}`. `WarningsService.swift:313-316` → `isClashApproved`. The UserDefaults approval cache only ever adds (`WarningResolutionStore.swift:101-111`) — Firebase wins; drop removed approvals. Use `resolvedWarningKeys` / `isWarningActive`.
13. **Full week** — `Models/OrgWarningDetectionSettings.swift:97-125,205,222-226` describe and compute Full week as Mon–Sun; use `coverageWindow` + `clashScanDays`, show `fallbackReason` notices. Copy at `OrganisationWarningsSettingsView.swift:152`.
14. **Warning settings resist a reset** — iOS keeps its in-memory copy when the server looks like defaults (`FirebaseBackend.swift:4936-4944`). Firebase always wins.
15. **Manager-clash fallback** — Swift grouping (`WarningsComputation.swift:563-586`) when the script returns nothing; remove once the script is current.

### C.5 Schedule options
16. **Custom items toggle missing** — add the on/off toggle (`settings.myScheduleOptions.customItemEnabled`) in `Views/GeneralAppSettingsView.swift`. Deleting an item does not persist (`Core/AppSettingsStore.swift:128-139,227-231` merges the old list back); duplicate names crash the save (`:47`, `GeneralAppSettingsView.swift:172`). Save with `scheduleOptionsWriteFields`; pickers use `enabledScheduleLocations` (`MyScheduleOptions+ScheduleLocations.swift:58-62`, `MyScheduleView.swift:745`).

### C.6 Profile, users and pay
17. **Pay basis** — iOS never writes `payBasis` or `hourlyRate` on `users/{uid}` or on `operativeDayRateHistory` rows (`FirebaseBackend.swift:5514-5519,5928-5932,7857-7861`; `Models/AppModels.swift:279-288`). Write exactly one basis and clear the other, as web does. Rate on a day = `payRateOnDay` (replace `Core/PayrollRateResolver.swift:87-180`).
18. **Stale line manager** — roster load overrides `assignedManagerUserId` and `dayRate` from `operativeProfiles` (`Core/UserStore.swift:434-451,2673-2692`); `isLineManager` ignores `hasNoLineManager`. Stop overriding; use `lineManagerIds`.
19. **Full-document user saves** — `saveUser` (`FirebaseBackend.swift:5425-5550`) writes the whole document, including `organizationId` (`:5433`) and `profilePhotoURL` (`:5527-5531`) from the in-memory copy; `deactivateUser` does a full save (`UserStore.swift:1517-1528`). Write changed fields only. Never write another user's `organizationId`.
20. **Photo** — read optional `profilePhotoUpdatedAt` to refresh a cached avatar; re-fetch `getDownloadURL` on a 403.
21. **Profile** — Settings profile shows `dayRate` else `hourlyRate`, ignoring `payBasis` (`SettingsHubSupportViews.swift:228-234`). Use `readStoredRates` + `formatMoney`.
22. **Password** — `ChangePasswordView.swift:85-90` requires 6. Use `passwordPolicyError` / `passwordMinLength` (8; developer account 10) on sign-up, invite set-up, reset and change.

### C.7 Timesheets, hours and leave
23. **PAYE days dropped** — `Core/TimesheetPayrollCollector.swift:76-80`. Keep them as 0 lines flagged PAYE.
24. **Overlapping bookings merged** — `Models/OperativeBookingInterval.swift:63-110` (used at `TimesheetPayrollCollector.swift:87`). Pay every booking; flag `overlappingBookingIds` in amber with `OVERLAPPING_BOOKING_NOTE` for the person and line manager.
25. **Leave on timesheets** — add `timesheetLeaveLines` info rows (no hours, pay or edit; never on an invoice).
26. **Daily Overview standard hours** — `DailyOverviewView.swift:259-266` computes standard = paid − OT. Use `workedHoursSplit`.
27. **Leave documents** — `HolidayView.swift:1572,1617`, `OperativeAnnualLeaveViews.swift:1297` write one document per day; write one per range (`holidayRequestRanges`, `holidayRequestWriteFields`). Decisions via `holidayDecisionWriteFields` (`FirebaseBackend.saveHolidayBooking:7622`); statuses `pending` / `approved` / `rejected`. Day counting via `leaveRecordDayKeys` / `annualLeaveBalance`.
28. **Leave approvers** — `NotificationService.swift:877-911,1770-1800` `holidayRequestRecipients` picks super admins only when there is no line manager. Use `leaveApproverIds` (all active admins + super admins). Approver queue (`HolidayView.swift:1740-1755`): admins see unrouted requests and their own reports — keep consistent with `leaveApproverIds`.
29. **My Schedule** — label pending leave as pending (`MyScheduleView.swift:1080-1093`); match people by account only — remove the first-name/surname fallback (`Core/WorkAccess.swift:192-195`).
30. **Notifications inbox** — `NotificationService.swift:~1582` uses `.limit(to: 150)` without ordering; add `.order(by: "createdAt", descending: true)` (index ships in web `firestore.indexes.json`). Variations toggle appears via `visibleNotificationPreferenceKeys`; the `variation_*` types iOS writes (`variation_added`, `variation_from_tracker`, `variation_numbers_updated`) map to it, and **every variation type now sends a device push** (`DEVICE_PUSH_NOTIFICATION_TYPES`, user decision).
31. **Toggles hide the push, never the inbox row** (user decision, rulebook §13). Today iOS hides inbox rows and local alerts for switched-off types (`NotificationService.swift:1443` `shouldShowNotification` → `deliveryAllowed` at `:1476-1480`, used for the inbox list at `:1606` and local alerts at `:1541`, `:2030`). Change it: the inbox list and unread count use `notificationShowsInInbox` (always shows the row); only pushes and local alerts use `devicePushAllowed` / `notificationPreferenceAllowsDelivery`. The app-icon badge counts every unread inbox row.

### C.8 Security rules — iOS writes the new rules will refuse
31a. Booking deletes must batch a tombstone: `deleteBooking` (`FirebaseBackend.swift:7485`) and `deleteManagerSiteBooking` (`:7617`) → `deletedBookings/{id}` with `bookingTombstoneWriteFields` + `deletedAt: serverTimestamp()`.
32. `ProjectStore.saveData` writes `settings/jobTypes` on every save — refused for operatives; write only when an admin/manager edits job types.
33. Timesheet saves from a stale local draft that predates a manager's signature are now refused (owner cannot change sign-off fields) — reload before saving and never resend sign-off/export fields from the owner.
34. Leave approval by a manager who is not the person's line manager is now refused; timesheet edits by a non-line-manager manager too. Gate the UI with `leaveApproverIds` / `userTimesheetSubjects`.
35. `acceptedBookingClashes` / `warningResolutions` writes are admins and managers only — gate the UI.

### C.9 Pay can only be changed by the people allowed to (rulebook §8, §16 — user decision: "fix for all platforms")
36. **Profile mirror bypass** — `Core/UserStore.swift:2208-2215`: when the `users/{uid}` write is denied, iOS falls back to writing pay into `operativeProfiles/{uid}` (`FirebaseBackend.swift:5948-5996` `saveOperativeProfileMetadataFallback`). That was the bypass and is now refused — remove the fallback. Gate `saveOperativeProfileMetadataFallback` and `recordOperativeDayRateChange` (`FirebaseBackend.swift:7841-7868`; callers `UserStore.swift:2171-2187`, `2359-2373`, `OperativesView.swift:1095-1110`) on `canChangePersonPay`. Stop applying `operativeProfiles` overrides on roster load (`UserStore.swift:434-451`, also item 18).
37. **Roster-row pay** — `operatives/{id}` and `managers/{id}` pay fields (`dayRate`, `hourlyRate`, `payBasis`, `employmentType*`) are now writable only by admins, or by an operatives manager for an operative row that is not their own (manager rows: admins only). `syncActiveOperativesWithUserAccounts` (`UserStore.swift:2555-2595`, run from `ContentView.swift:462,509` on every device) mirrors rates into those rows — run it only when the signed-in user can change pay (`canChangePersonPay`), or send only changed non-pay fields; otherwise operatives' devices get refused writes.
38. **Timesheet entry decisions** — the authoritative decision for a price-work or expense entry is now `extraEntryReviews[entryId] { decision, revisedAmount, reviewedAmount, reviewedByUserId, reviewedAtMs }` (manager/admin-only). Read decisions with `timesheetEntryDecision(sheet, entry)` in `Views/InvoicingView.swift:887-951` (`fromFirestoreMap`), not the inline `managerDecision`. After each reviewer save (`InvoicingView.swift:3921-3929`, `4297-4344`, `OperativeTimesheetReviewView`) `updateData` the output of `timesheetEntryReviewWriteFields` (stored = `parseTimesheetEntryReviews(raw)`); keep writing the inline values for older builds.
39. **Owner timesheet saves** — `MyTimesheetView.saveDraft` (`InvoicingView.swift:2269-2300`) via `saveToCloud` (`:819-835`) must pass the payload through `timesheetOwnerWriteFields` (`subjectHasLineManager`, `managerSigned`). The owner never writes `payrollLineReviews` / `extraEntryReviews`, writes `weeklyReportOverride` only with no line manager, and cannot change price work / expenses after sign-off. Without this, saves after sign-off are silently refused (`try?`). `managerNote` stays the owner's note to the manager. Use `timesheetWriterIsReviewer` to decide reviewer vs owner.

---

## D. Offline mode (RULEBOOK §2 — required)

Build the offline rules as a separable layer (e.g. `Core/Offline/OfflinePolicy.swift` deciding allowed / online-only / read-only per action, plus the existing outbox), so Android can port the same table.
- **Allowed offline, queued with a visible "Pending sync" state until the server confirms:** create/edit/cancel bookings (projects and small works), annual leave requests, the user's own profile fields, the user's own notification toggles. Extend `OfflineOutboxStore` / `OfflineSyncCoordinator` to leave requests, own profile and own toggles; replay as **partial updates of changed fields**, never a full stale booking with `setData(merge:)` (`OfflineSyncCoordinator.swift:55-58`).
- **Online-only, controls disabled offline with "Connect to the internet to change this":** all organisation settings (company details, currency, working hours incl. scheduled changes, warning settings incl. excluded users, payment runs, material cut-off, schedule options incl. custom items); all Manage Users changes; approvals (leave, timesheet signing, clash approvals); sign-in, password change, switching organisation.
- **Read-only offline:** Daily Overview, warnings, weekly report and My Schedule show the last synced data labelled "Last updated [date/time]" and are never recalculated from unsynced local changes.
- **Conflicts:** last write wins by server timestamp. A replay refused with permission-denied is final (`bookingReplayRefusedIsFinal`): remove the outbox entry (not `markFailed`), drop the local row, show `BOOKING_REPLAY_REFUSED_MESSAGE`. Queued writes to online-only areas refused on replay are final too. Double bookings made offline are not blocked; warnings pick them up after sync.

---

## E. iOS-only UI fixes (final section)
1. **Working hours** — after **Save** (apply or schedule), save and return to the previous screen (`OrganisationWorkingHoursView.swift:168-174,1005-1052` stay on screen today). Cancel keeps its confirm-and-discard behaviour.
2. **Roles & permissions** — keep it opening Manage Users. Remove the **Done** button (`ManageUsersView.swift:96-103`); keep only the back arrow; remove the nested `NavigationStack` (`:58`) inside the pushed page. Remove the **"View"** buttons on the Operatives and Managers pages (`ManageUsersView.swift:452-495` — they only close the screen and never switch tab).
3. **Schedule options** — the custom items on/off toggle (C.16), reading and writing `settings.myScheduleOptions.customItemEnabled`.
4. **Company details** — align with web (C.7).
5. **Warnings settings** — show "YOUR INVOICING SCHEDULE" from `activePaymentRunSummary` only when Invoicing period is selected; "Set up payment runs" when not configured; Full week copy per §5.
6. Any other iOS-specific item you find in Phases 1–2.

---

## F. Finally
Report every **web-side gap** you discover (format as in the Gap Report) for the web agent. Do not fix a web gap by diverging on iOS. When the web agent ships a new rulebook version, it produces `docs/ios-handoff/LATEST.md`; run `scripts/sync-rulebook-from-web.sh` and follow it.

---

# Appendix A — The canonical rulebook (docs/RULEBOOK.md, version 1.1.0, verbatim)

# Project Planner Rulebook

Version: 1.1.0
Updated: 2026-10-31

This is the one rulebook for every Project Planner platform: web, iOS and (later) Android. It is written platform-neutral. Each rule names the shared function in `lib/canonical` that implements it; platforms call that function (web `@/lib/canonical`, iOS `CanonicalBusinessEngine`, Android the same packed script) and never keep a second copy.

**Where it lives.** The canonical copy is `docs/RULEBOOK.md` in `project-planner-web`. iOS keeps a byte-identical mirror at `docs/RULEBOOK.md`; the packed script carries this file's version and sha256 (`rulebookStamp()`), so a platform can prove at test time that its mirror matches the rules it runs. Never edit a mirror by hand. See "How the rulebook changes" at the end.

---

## 1. Data, sync and source of truth

- **Firebase is the single source of truth** for shared data. No shared data is kept only on a device or in a browser. Device storage is a cache or a per-device preference only.
- **Identical field names, types, defaults and enums** on every platform. Where platforms differed, the web schema wins. Shapes are listed in `ORGANIZATION_DOCUMENT_FIELDS`, `USER_DOCUMENT_FIELDS` and `OPERATIONAL_COLLECTION_PATHS`.
- **Live screens use real-time listeners.** A screen showing shared data listens for changes (Firestore snapshot listener), so a save on one platform appears on the other without a refresh. Organisation settings come from one live listener on `organizations/{orgId}`; the signed-in user's profile and the Manage Users roster are live too.
- **Bounded downloads.** Booking listeners start at `bookingLoadStart`: the earlier of this week's Monday and the warning window start, filtered on the booking `date`. A screen showing an older day moves the start earlier (never later); history screens ask for the full archive. The notification inbox loads the newest 150 rows for the signed-in user (`createdAt` descending).
- **Writes carry metadata.** Every write to a shared document includes `updatedAt` (server timestamp), `updatedBy` (signed-in user id) and `updatedFrom` (`web` | `ios` | `android`) — `writeMetadataFields(uid, platform)`; each app adds its SDK server timestamp. Security rules never reject a write only because these are missing (older app builds).
- **Partial writes only.** A save writes the fields it changed (dotted partial update). It never rewrites a whole document from a possibly stale copy, and never deletes a field just because the local copy lacks it. A dotted key (`settings.currencyCode`) is only used with a partial update, never with a merge-set, where it would become a literal field name.
- **Shared calculations run on each device from one packed script.** Warnings, overtime, timesheet figures, Daily Overview and pay are calculated on each device by the same packed rulebook script, not re-implemented per platform. Moving a calculation to the server (Cloud Functions) is a separate decision; until then the function named here is the exact specification (inputs, edge cases, rounding) and is locked by tests in `lib/canonical/canonical.test.ts` and `lib/canonical/parity-fixture.json`.
- **One business time zone per organisation**, from `organizations/{orgId}.countryCode` (`organizationTimeZone`): GB → Europe/London; missing or unknown → Europe/London. Every day key, warning window, payment run, timesheet day, cut-off clock and effective date uses this zone, with BST/GMT handled by the zone rules. Never the phone or browser zone.
- **The week starts on Monday** and runs Monday–Sunday for every organisation. Monday–Friday are working days; Saturday and Sunday count only where a setting says so (for example "Include weekends in unbooked labour"). This is fixed, not an organisation setting.
- **Security rules enforce permissions on the server.** Firestore rules enforce role permissions, approvals and who may change organisation settings. Hiding a control in an app is never the only guard.

## 2. Offline rules

- **Web:** online only. No offline editing.
- **iOS and Android:** offline mode with restrictions. The logic is kept separate from screens so Android can reuse the same rules.

**Allowed offline** (queued on the device, pushed automatically when the connection returns; each queued item shows **"Pending sync"** until the server confirms it):
- Create, edit and cancel bookings (projects and small works).
- Annual leave requests.
- The user's own personal profile fields.
- The user's own notification toggles.

**Online only** (controls disabled offline with the message **"Connect to the internet to change this"**):
- All organisation settings: company details, currency, working hours and overtime (including scheduled changes), warning settings (including excluded users), payment runs, material order cut-off and schedule options (including custom items).
- All Manage Users changes: role, line manager, employment status, day/hourly rate and effective dates, exclusions, inactive flag, invites.
- Approvals: annual leave approval, timesheet signing, clash approvals.
- Account actions: sign-in, password changes, switching organisation.

**Read-only offline.** Daily Overview, warnings, weekly reports and My Schedule show the last synced data, labelled "Last updated [date/time]", and are never recalculated from unsynced local changes.

**Conflicts.**
- Last write wins, by server timestamp.
- A booking cancelled or deleted on another device cannot be brought back by an offline edit. Deleting a booking (`bookings` or `managerSiteBookings`) writes a tombstone at `organizations/{orgId}/deletedBookings/{bookingId}` in the same batch (`bookingTombstonePath`, `bookingTombstoneWriteFields`; the app adds the server `deletedAt`); security rules refuse any later create or update of that booking id. A booking stored as `Cancelled` can only be moved off Cancelled by an admin or manager. A refused replay is final (`bookingReplayRefusedIsFinal`): the device removes the queued item, drops the local row and shows `BOOKING_REPLAY_REFUSED_MESSAGE` ("This booking was cancelled or deleted on another device").
- Double bookings created offline are not blocked; warnings pick them up after sync.
- Queued writes to online-only areas are refused by the security rules when they replay.

## 3. The data flow (in order)

1. **Scheduling** (projects and small works) books people onto days.
2. **Daily Overview** is a snapshot of each day: who is booked (and on what), who is unbooked, who is on annual leave. It is driven by bookings, annual leave and organisation settings.
3. **Warnings** consume the same day data plus warning settings and organisation settings.
4. **Weekly Report** is an extraction of Daily Overview and warnings for a chosen date range.
5. **Timesheets** are fed by bookings, annual leave, working hours/overtime rules, payment runs and each person's effective-dated employment profile.
6. **My Schedule** is each person's own view of their bookings and annual leave.

A change upstream flows to everything downstream on every platform.

## 4. Organisation settings

All organisation settings live on `organizations/{orgId}` and are identical on every platform. They are online-only edits, saved only when the user presses **Save**, and a save on one platform appears on the other through the live listener. Settings screens keep an unsaved draft and only refresh it from the server while the draft is unchanged. A value that looks like the factory default on the server is still the server value — no platform re-saves its own cached copy over it.

### 4.1 Company details
Flat fields on the organisation document: `name`, `officeAddressLine1`, `officeAddressLine2`, `officeCity`, `officeCounty`, `officePostcode`, `countryCode` (two letters, GB when missing), `documentAbbreviation` (1–3 characters), `companyLogoURL`, `defaultLatitude`, `defaultLongitude`, `bankHolidayRegionId` (`parseCompanyDetails`, `companyDetailsWriteFields` → `{ set, remove }`, `companyDetailsValidationError`). A legacy nested `officeAddress` map is read only as a fallback and every save deletes it. Blank optional fields are deleted, never saved as empty text; with no office, all address fields are deleted. A missing map pin leaves the saved pin alone. A blank name is never saved (`organizationNameWriteFields`). The country sets the business time zone and the default currency.

### 4.2 Currency
One organisation currency (`resolveOrganizationCurrency`), chosen from `CURRENCY_OPTIONS` (GBP, EUR, USD, CAD, AUD, NZD, SEK, NOK, DKK, PLN, AED). Until one is saved it defaults from the country (`defaultCurrencyForCountry`; GBP when unknown). A save writes `currencyCode`, `currency` and `settings.currencyCode` as one partial update (`organizationCurrencyWriteFields`). Every money figure — timesheets, rates, invoices, weekly report, exports, PDFs — is shown with `formatMoney(amount, currency)`. Subscription prices are billing, not organisation money.

### 4.3 Working hours and overtime
`payrollTimePolicy`: standard day window, break, paid hours, weekday overtime multiplier, Saturday and Sunday rules, paid break. Limits for every platform (`validatePayrollTimePolicy`): paid hours 1–12, break 0–120 minutes, multipliers 1–3. The standard day and its AM/PM halves are `halfDayWindows`; no platform computes a midpoint itself.
Limits also cover weekend "counts as" hours (1–12) — `PAYROLL_POLICY_LIMITS`.

A change is either applied from today or **scheduled** from a chosen date after today (`payrollTimePolicyScheduled { policy, effectiveFrom }`, day keys in the organisation zone). The rules in effect on a day (`effectivePayrollTimePolicy(org, dayKey)`, `payrollTimePolicyTimeline`) are: the scheduled change once its day has arrived (even before any app promotes it); before `payrollTimePolicyEffectiveFrom`, `payrollTimePolicyPrior`; otherwise `payrollTimePolicy`.
- **Apply from today** (`payrollTimePolicyApplyNowWriteFields`) saves the new rules, keeps yesterday's rules as the prior, sets today as the start, removes a scheduled change that is already due and keeps a future one.
- **Schedule** (`payrollTimePolicyScheduleWriteFields`) replaces any pending change; a due change is promoted first so it is not lost.
- **Cancel** (`payrollTimePolicyCancelScheduleWriteFields`) removes a pending change.
No save ever cancels a scheduled change it was not asked to cancel.

The working week is `WORKING_WEEK` (`isStandardWorkingWeekday`): Monday–Sunday, Monday–Friday working.

### 4.4 Annual leave settings
`annualLeaveDefaults { daysPerYear, startMonth, endMonth, carriesOver }` (defaults 25, 1, 12, false) and the bank-holiday region, saved together in one write. Allowance, the leave year and a one-year override are `annualLeaveBalance`.

### 4.5 Payment runs (the invoicing period)
Two modes (`invoicing.paymentRunMode`):
- **Set payment run date ranges** (`date_ranges`): two runs per month on fixed days, e.g. 1st–15th and 16th–last day. "16th–31st" means 16th to the last day of that month in 28, 29, 30 and 31-day months. Run 1 starts on the 1st and must end by the 27th so run 2 exists every month; run 2 starts the day after and ends on the 31st (`validateInvoicingSettings`, `PAYMENT_RUN_1_LAST_END_DAY`). A run is paid on its payment day: the first one on or after the run ends, otherwise that day next month (clamped to short months).
- **Recurring timeframe** (`recurring_timeframe`): a weekly work period (e.g. Monday–Sunday) paid in arrears on the first pay weekday after the period ends (e.g. the following Friday) — `paymentWeekdayAfterPeriodEnd`, shared with timesheet reminders.

The **active payment run** is the work period that contains today in the organisation zone (`invoicingPeriod`); if no date-range run contains today, the run with the latest end day. Its pay date is `paymentRunPayDate`. The summary shown to users is `activePaymentRunSummary(invoicing, now, timeZone)`: `{ start, end, payDate, label }`, e.g. "Mon 26 Oct – Sun 1 Nov · paid Fri 6 Nov", or `{ notConfigured: true }` when the organisation has no payment runs.

### 4.6 Warning settings
`warningDetection { detectClashes, clashLookaheadMode, clashLookaheadDays, includeWeekendsForUnbookedLabour, excludedUserIdsFromUnbookedWarnings }`, parsed by `parseWarningDetection`. See §5.

### 4.7 Material order cut-off
`settings.materialCutOff { materialOrderCutOff, materialCutOffHour, materialCutOffMinute, materialCutOffOnSaturday, materialCutOffOnSunday }` (`parseMaterialCutOff`, `resolveMaterialCutOffClock`). A missing hour defaults to 16:00; a saved 15:30 stays 15:30. A user's notification preferences never hold the clock.

### 4.8 Schedule options
`settings.myScheduleOptions { showOffice, showWorkingFromHome, showSiteSurvey, customItems[], customItemEnabled{name: bool} }`. Missing flags mean on. Every location picker offers exactly `enabledScheduleLocations(options)`. A save writes exactly the list on screen, with names de-duplicated ignoring case (`scheduleOptionsWriteFields`) — it never merges back a deleted item.

## 5. Warnings

Warnings refresh whenever bookings, leave, settings or users change, and when the day changes (midnight in the organisation zone, and when the app or tab returns to the foreground).

**Detection period** (`coverageWindow`):
- **Set number of days:** today through N calendar days including today (2 = today and tomorrow). N is a whole number 1–365; a missing, blank, non-numeric or below-1 value falls back to 7 and both the settings screen and the Warnings screen show a notice (`coverageWindow` → `fallbackReason`, `parseWarningDetection` → `clashLookaheadDaysFallback`, never saved) — never a silent failure.
- **Invoicing period:** every past, present and future day of the active payment run. Selecting it shows the **invoicing schedule summary** (`activePaymentRunSummary`); with no payment run configured the screen asks the user to set one up. The summary is hidden for the other two options.
- **Full week:** Monday–Friday of the current week, including days already past. Saturday and Sunday are added for unbooked labour only when "Include weekends in unbooked labour" is on.
- **Clash days** (`clashScanDays`): clashes follow the scan window. In Full week, a Saturday or Sunday of the current Monday–Sunday week is also checked when it has a booking. Set number of days and Invoicing period are calendar days, so their weekends are always checked. The include-weekends toggle never affects clashes.

**Warning types and severity:**
- **Booking clashes** — a person double-booked on the same date. Operative clashes are **High**; manager/admin overlaps are **Medium**. A clash can be **approved** (online, managers and admins only): `clashApprovalWrites` writes `acceptedBookingClashes/{clashPairKey}` and `warningResolutions/{clashResolutionKey}` with status `approved` — the key is the booking-pair key for operative clashes and `mgr-clash-…` for manager clashes. Un-approving deletes both. A clash is approved when either document exists (`isClashApproved`). Approved clashes are listed separately on the weekly report and no longer count as open. Whether any row still counts is `isWarningActive` over `resolvedWarningKeys`.
- **Unbooked labour (High)** — an operative not booked on a working day in the window (`unbookedLabourRows`). Skipped: excluded users (silently), inactive users, pending users who have not finished sign-up, days on approved annual leave, weekends unless included, anonymised deleted profiles (`listedCurrentLabourPeople`).
- **Low:** materials not ordered by the cut-off (`materialCutOffWarningRows`: once the organisation clock passes the cut-off, each job with an active booking tomorrow warns if tomorrow has no material lines or any line is not ordered — a line counts as ordered when its status is `ordered` or an order send record lists it (`materialLineCountsAsOrdered`); a Saturday or Sunday tomorrow only if that day's flag is on; key `materials-{projectId}-{YYYY-MM-DD}` for tomorrow); qualification expiry including already expired (`qualificationExpiryRows`); unverified accounts (`unverifiedOperativeRows`).

**Excluded users** are a per-user, all-or-nothing exemption from unbooked-labour warnings, for people who are never bookable (office PAYE staff, directors). Temporarily unavailable operatives use the **inactive** flag instead.

Display order (Oldest/Newest) is a per-device preference (`sortWarningsByDate`).

## 6. Daily Overview

One entry per day listing booked people (with project or small work), unbooked people (`unbookedLabourRowsOnDay`) and people on approved annual leave. It respects the organisation working hours (`effectivePayrollTimePolicy`), the fixed working week, include-weekends, exclusions and active/inactive status. Standard and overtime hours are `workedHoursSplit`. It is identical on every platform for the same day.

## 7. Weekly Report

Generated live for any chosen date range from current bookings, Daily Overview, warnings and timesheets. Contents: hours, overtime, warnings including approved clashes, totals. Reports are **not stored**: a report is produced and downloaded (PDF/XLSX/HTML or the share sheet) and that is all. Producing a report again for the same range reflects any changes made since.

## 8. Timesheets and employment profile

**Profile fields** on `users/{uid}`: employment status (`employmentType`: PAYE or self-employed), pay basis (`payBasis`: day or hourly), `dayRate`, `hourlyRate`. A rate save writes exactly one basis and removes the other.

**Effective dating.** Status and rate are both effective-dated; a change asks when it takes effect. Status: `employmentTypeTransitionFrom` / `employmentTypeEffectiveAt` (`applyEmploymentTypeChange`, `employmentTypeOnDay`). Rate: `organizations/{orgId}/operativeDayRateHistory` rows `{ userId, operativeId, dayRate, payBasis, effectiveAt, createdAt }`. History is never rewritten.

**Rate on a day** (`payRateOnDay`): a PAYE day has rate 0 (the line keeps its hours and is flagged PAYE). Otherwise the rate is the latest history row for the person whose effective day (organisation zone) is on or before the day; an explicit 0 is a real rate. If the live profile is hourly, an hourly row stays in force until a day-rate row falls on a later day. With no history row the live profile applies (`users/{uid}`, then the operative row). With nothing set the rate is "rate not set".

**Pay rules.**
- PAYE days pay 0 (in the organisation currency) and still appear on the timesheet as a 0 line.
- Self-employed days pay the effective day or hourly rate.
- Example: PAYE → self-employed changed on Tuesday, effective Wednesday: Monday and Tuesday show 0, Wednesday onwards show figures for days worked.
- **Overlapping bookings are each paid** and never merged. An overlap is a warning managers should have caught; on the timesheet each overlapping line is shown in amber for the person and their line manager with "Overlaps another booking — check with your manager" (`overlappingBookingIds`, `OVERLAPPING_BOOKING_NOTE`). Times that only touch do not overlap.

**Who may change pay** (`canChangePersonPay`). A person never changes their own pay, line manager or employment type on any path — `users/{uid}`, `operativeProfiles/{uid}`, `operativeDayRateHistory`, or the pay fields of `operatives/{id}` and `managers/{id}`. An admin may (including their own rate). A manager with Operatives access may change an operative's pay in the same company, never their own or another manager's; a manager's pay is changed by admins only. Resending an unchanged value is not a change.

**Timesheet review** (`timesheetEntryReviews`). Only the person's line manager or an admin writes `payrollLineReviews` and `extraEntryReviews`. The decision for a price-work or expense entry is `extraEntryReviews[entryId] { decision, revisedAmount, reviewedAmount, reviewedByUserId, reviewedAtMs }` (`timesheetEntryDecision`, written with `timesheetEntryReviewWriteFields` as dotted partial updates). A review made against a different amount is stale and the entry is pending again; an entry nobody reviewed counts at its own amount. The inline `managerDecision` / `managerRevisedAmount` on an entry is still written for older builds and counts only when it lowers what is paid, or on a legacy sheet (no map) the line manager already signed. Owner saves go through `timesheetOwnerWriteFields`: the person writes `weeklyReportOverride` only when they have no line manager (self-signed), cannot change price work or expenses once the line manager has signed, and writes `managerNote` (their own note to the manager). Whether a writer is a reviewer is `timesheetWriterIsReviewer`.

**Calculation.** Hours, overtime and pay come from bookings, the working-hours policy in effect that day and payment runs (`payrollHoursResult`, `workedHoursSplit`). Timesheets are grouped by payment run (`timesheetPeriodFromInvoicing`, `selectableTimesheetPaymentRunPeriods`); status Awaiting / Signed off / Exported is `timesheetListBucket`.

**Annual leave on timesheets.** Each approved leave day in the period appears as an information line "Annual leave (full day / AM / PM)" for the person and their line manager, with no edit control and no hours or pay (`timesheetLeaveLines`, `timesheetLeaveLabel`). Leave never appears on a generated invoice.

**Line manager.** A person's line managers are `assignedManagerUserIds` (else the single `assignedManagerUserId`; `hasNoLineManager` means none) — `lineManagerIds`. Line managers receive that person's timesheets for signing, annual leave requests and other approval items (`userTimesheetSubjects`, `leaveApproverIds`). With no current active line manager, all active admins and super admins receive them. Nobody approves their own items. Routing is read at the time — changing the line manager on any platform re-routes everything, nothing is stored on the request.

## 9. Annual leave

One document per request at `organizations/{orgId}/holidayBookings/{id}`: a run of calendar-consecutive days with the same slot is one record from `startDate` to `endDate` (`holidayRequestRanges`, `holidayRequestWriteFields`), with `timeSlot` (`FULL DAY` / `AM` / `PM`, applying to every day) and `status` (`pending`, `approved`, `rejected`). Cancelling approved leave is a request (`cancellationRequestedAt`, `cancellationRequestedByUserId`) that an approver accepts (the record is removed) or refuses. Older one-document-per-day records stay valid. A decision writes `status`, `approvedByUserId`, `approvedAt` and an optional trimmed `decisionNote` (blank clears it) shown to the requester (`holidayDecisionWriteFields`, `parseHolidayDecisionNote`). Day counting (`leaveRecordDayKeys`, `annualLeaveBalance`): a single-day record counts its day; a multi-day record counts each day except weekends and bank holidays, each in its own leave year. Submitting a request notifies every approver (`holiday_request_submitted`). Approved leave affects Daily Overview, unbooked-labour warnings (`leaveCoverageRows`), timesheets (information lines) and My Schedule. Only the requester's line managers or an admin may approve or decline — enforced by security rules.

## 10. My Schedule

Every person sees their own bookings and annual leave (approved, and pending marked as pending), matched by account (`bookingIdsForAccount`) — never by name. It updates live when a booking or leave changes on any platform. Hours split as in §6.

## 11. Manage Users

All Manage Users changes — role, line manager, employment status and rates with effective dates, inactive flag, exclusions, invites — are online-only, sync to every platform through live listeners, and are written as partial updates of the changed fields only. People lists use `rosterPeople` / `listedRosterUsers`; Active / Inactive / Pending is `userRosterSegment`. A user may not change their own rates, pay basis, employment type, active flag, line manager or permissions — enforced by security rules. **Roles & permissions** opens Manage Users directly.

## 12. My Profile

Matches on every platform and updates live: profile photo (`profilePhotoURL`), contact details, day/hourly rate and employment status (read-only), and billing details — VAT number and UTR — stored privately at `users/{uid}/private/taxIds` (`sensitiveProfile`). A photo upload stores a fresh download URL; a stale profile copy never removes or rolls back the photo.

## 13. Notifications

- **My notifications** toggles are personal (`users/{uid}.notificationPreferences`), written as dotted partial updates, and sync across platforms (`parseUserNotificationPreferences`, `userNotificationPreferenceFieldPatch`).
- Which toggles a person sees depends on role and features (`visibleNotificationPreferenceKeys`). People who can see variations (`canSeeVariations`: admins and managers) have a **Variations** toggle (`variations`, on by default) covering all five variation types.
- A toggle turned off stops that notification type's **device push** everywhere (`notificationPreferenceAllowsDelivery`, `devicePushAllowed`; enforced by the push Cloud Function). It **never hides the inbox row**: every notice addressed to the person stays in the notification centre and the unread count, on every platform (`notificationShowsInInbox`, `NOTIFICATION_TOGGLE_HIDES_INBOX_ROW = false`). The app-icon badge counts the same unread rows.
- Types that send a device push are `DEVICE_PUSH_NOTIFICATION_TYPES`, including every variation type (`variation`, `variation_renumbered`, `variation_added`, `variation_from_tracker`, `variation_numbers_updated`).
- Organisation settings (material cut-off, schedule options) never appear in My notifications.
- Web never sends browser or OS notifications.

## 14. Authentication and organisations

- Sign-in and passwords use Firebase Auth email/password on every platform; a password change applies everywhere. Every password — sign-up, invite set-up, reset, change — must be at least 8 characters; the platform owner's developer account needs 10 (`PASSWORD_MIN_LENGTH`, `passwordMinLength`, `passwordPolicyError` → "Password must be at least N characters."). No complexity rule.
- **Switching organisation is per device.** Each platform remembers the last organisation it opened (web `pp.webActiveOrg:{userId}`, iOS `cached_organizationId`) and reopens to it (`chooseSessionOrganization`). Switching on one platform does not change another platform, and does not write `users/{uid}.organizationId`.
- **Membership is shared.** The list of organisations a person belongs to is shared data (`sessionMembershipIds`).

## 15. Platform-specific (not synced)

- Light and dark mode.
- Warning display order (Oldest/Newest).

## 16. Server-side permissions (Firestore security rules)

Deployed only from `project-planner-web/firestore.rules`. Apps hide controls too, but these rules are the guard:
- **Organisation:** only a current admin edits `organizations/{orgId}`; billing is never written by an app; ownership (`creatorUserId`) passes only from the current Super Admin to another admin (or by the platform owner). A demoted creator cannot edit.
- **Company settings documents** (`settings/{id}` such as job types and trades): admins and managers. Deadlines and health & safety documents stay open to the team.
- **Profile and pay:** a person cannot change their own pay (`dayRate`, `hourlyRate`, `payBasis`), line manager, active flag, employment type or permissions — on `users/{uid}`, `operativeProfiles/{uid}`, `operativeDayRateHistory`, `operatives/{id}` or `managers/{id}`. Pay changes are admins, or operatives managers for operatives (§8). Resending an unchanged value always passes.
- **Annual leave:** a person creates and edits their own pending request and asks to cancel; only an admin or the person's line manager approves or rejects (any manager when the person has no line manager). People allowed to book their own leave save it approved.
- **Timesheets:** a person never counter-signs or exports their own timesheet; only their line manager or an admin writes the sign-off and export fields and the review maps (`payrollLineReviews`, `extraEntryReviews`); after sign-off the person cannot change price work or expenses.
- **Warnings:** only admins and managers accept a clash or approve/dismiss a warning resolution.
- **Bookings:** tombstones as in §2.
- **Write metadata** (`updatedBy` = the signed-in user, `updatedFrom`, `updatedAt`) is validated when present and never required.

---

## How the rulebook changes

1. A rule change starts in `project-planner-web`: edit the function in `lib/canonical`, add a test in `lib/canonical/canonical.test.ts`, and edit this file.
2. Bump `Version:` (major: a breaking field or behaviour change; minor: a new rule; patch: wording) and add a `### <version> — <date>` entry under Changelog.
3. `npm run build:canonical` packs the script with this file's version stamped in, writes `lib/canonical/dist/canonical-manifest.json`, and mirrors the files into `../project-planner-ios` when it is checked out.
4. `npm run rulebook:handoff` writes the iOS follow-on prompt to `docs/ios-handoff/v<version>.md` and `docs/ios-handoff/LATEST.md`.
5. Enforcement: the pre-commit hook, CI (`.github/workflows/rulebook.yml`) and the Claude Code Stop hook (`.claude/settings.json`) all run `node scripts/rulebook-sync.mjs check` and refuse a change to `lib/canonical`, `firestore.rules`, `storage.rules`, `firestore.indexes.json` or this file without a version bump, a changelog entry, a fresh pack and a hand-off. A daily CI job compares the iOS repo's mirror with this version and fails when iOS is behind.
6. iOS runs `scripts/sync-rulebook-from-web.sh`, and its `RulebookParityTests` fail when its mirror, manifest or packed script differ from what web published.
7. A gap found on iOS is reported to the web agent and fixed here first — never by diverging on iOS.

## Changelog

### 1.1.0 — 2026-10-31
- My notifications toggles stop the device push only; the inbox row and unread count always show the notice (`notificationShowsInInbox`, `devicePushAllowed`). The app-icon badge matches the inbox.
- Every variation notification type sends a device push (`variation_renumbered`, `variation_added`, `variation_from_tracker`, `variation_numbers_updated` join `variation`).
- Pay and manager decisions are protected on every path (security rules and shared rules; see §8 and §16).

### 1.0.0 — 2026-10-31
- First versioned rulebook. Consolidates the rules previously spread across `docs/CANONICAL_ARCHITECTURE.md`, `AGENTS.md` and the iOS copies into this one file, mirrored to iOS.
- Decisions: organisation currency used for every money figure (11 currencies, country default); one business time zone per organisation from its country; fixed Monday–Sunday week; scheduled working-hours changes on every platform; recurring payment runs paid in arrears after the work period; weekend clashes checked when a weekend booking exists; overlapping bookings each paid and shown in amber; PAYE days shown at 0; annual leave shown on timesheets as information (never on invoices); one leave document per request with a decision note; weekly reports never stored; booking tombstones stop offline resurrection; password minimum 8; Variations notification toggle; write metadata `updatedBy` / `updatedFrom`.
