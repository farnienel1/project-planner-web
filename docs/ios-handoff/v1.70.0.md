# iOS follow-on — rulebook 1.70.0

Generated 2026-11-23 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.69.0 → 1.70.0
Packed hash: 716aeb1477f584efc0542b8010931f4dcd4e7051f1fe355d2db5bd0b36292cf6
Rulebook sha256: eca16306df4a87b940d7b79d85e6edb2cd2eb74ef0a41f54d878f33cb579e1fa
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 926b910948b674b1fa259e8f933ddd15f14bad00b8e0b050ccbd88c723bf64aa
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: OVERLAPPING_BOOKING_REVIEWER_NOTE, leaveRecordFormerPerson, overlappingBookingNote, timesheetLineDisplay
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/pushTokens.ts, lib/canonical/timesheetLines.ts, lib/canonical/weeklyReportPay.ts, lib/canonical/timesheetLineDisplay.ts
Done when:
- [ ] Packed hash in iOS equals 716aeb1477f584efc0542b8010931f4dcd4e7051f1fe355d2db5bd0b36292cf6
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 eca16306df4a87b940d7b79d85e6edb2cd2eb74ef0a41f54d878f33cb579e1fa)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.70.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.70.0

- **A tapped push opens the right person** (§13): `pushPayloadFields` / `PUSH_PAYLOAD_KEYS` add `deepLinkUserId` and `deepLinkWeekStartMs`; `userId` is still the recipient. iOS routes a push by `deepLinkUserId` first (`timesheet_pending_manager_signoff`, `timesheet_signed_by_manager`, `timesheet_revision_to_sign`, `timesheet_bookings_changed`, `overtime_request_submitted`). The push Cloud Function sends them once redeployed.
- **Overlap note for reviewers** (§8): `OVERLAPPING_BOOKING_REVIEWER_NOTE`, `overlappingBookingNote({ reviewing })`. The person keeps the old wording.
- **How a timesheet booking line reads** (§8, owner approved 23 Nov): `timesheetLineDisplay` — job number and name (or the place), and times on every line, a Full day / AM / PM line its window that day. Display only.
- **Former people's leave** (§7, §11): `leaveRecordFormerPerson`; `weeklyReportLeaveRows` takes `formerPeople` ("Former: Jane Smith", `unmatched[].formerPersonId`); Data health lists it apart. Web's person delete counts leave under the email and `operativeId` too.

## iOS work for 1.70.0

## iOS work for 1.70.0

1. **Push opens the subject's sheet.** `Navigation/NotificationDeepLink.swift` `payloadFields(from:)` adds `"deepLinkUserId": value("deepLinkUserId")` and `"deepLinkWeekStartMs": value("deepLinkWeekStartMs")` to the row it passes to `pushPayloadFields`; `route(userInfo:user:)` passes `deepLinkUserId: fields?["deepLinkUserId"] ?? <the current targetUserId>` to `notificationDestination` (payload `userId` is the recipient — never the subject). `weekStart(from:)` also reads `deepLinkWeekStartMs` (a string of epoch ms in FCM data) as `Date(timeIntervalSince1970: ms / 1000)`. Covers `timesheet_pending_manager_signoff`, `timesheet_signed_by_manager`, `timesheet_revision_to_sign`, `timesheet_bookings_changed` and `overtime_request_submitted`. The in-app row path (`deepLinkUserId ?? userId`) is already right. Works once the push Cloud Function is redeployed.
2. **Overlap note.** The timesheet overlap note calls `overlappingBookingNote(reviewing:)` — true when the viewer reviews someone else's sheet (line manager or admin), false on the person's own sheet.
3. **Timesheet line rows.** Each booking line's title and times come from `timesheetLineDisplay(line, dayPolicy)` (the line's `jobNumber`, `projectName`, `details`, `dayKey`; the working hours in effect that day). Display only — do not change stored line fields, amounts, hours, fingerprints or signed snapshots.
4. **Weekly report leave.** Pass the organisation's `deletedPeople` records (`parseFormerPersonDocument`) as `formerPeople` to `weeklyReportLeaveRows` so a deleted person's leave reads "Former: Jane Smith".

## New rulebook sections

- 1.70.0 — 2026-11-23

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
