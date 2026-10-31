# iOS follow-on — rulebook 1.1.0

Generated 2026-10-31 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.0.0 → 1.1.0
Packed hash: 13c1194b676fb6ba3e42585ea7bc9cf2e165af5fbb74fc4d1a9ed55dfb7dc0c7
Rulebook sha256: 36f61c979df49622f619e6c101e83b9d24e4d7694e494db53762af3c2b9e826c
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: NOTIFICATION_TOGGLE_HIDES_INBOX_ROW, TIMESHEET_ENTRY_ARRAY_FIELDS, TIMESHEET_ENTRY_DECISIONS, TIMESHEET_ENTRY_REVIEWS_FIELD, TIMESHEET_REVIEWER_ONLY_FIELDS, TIMESHEET_SELF_SIGNED_OWNER_FIELDS, canChangePersonPay, devicePushAllowed, notificationShowsInInbox, parseTimesheetEntryDecision, parseTimesheetEntryReviews, timesheetEntryDecision, timesheetEntryEffectiveAmount, timesheetEntryReviewWriteFields, timesheetEntryReviewsAfterWrite, timesheetOwnerWriteFields, timesheetWriterIsReviewer
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/notificationPreferences.ts, lib/canonical/payAccess.ts, lib/canonical/timesheetEntryReviews.ts
Done when:
- [ ] Packed hash in iOS equals 13c1194b676fb6ba3e42585ea7bc9cf2e165af5fbb74fc4d1a9ed55dfb7dc0c7
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 36f61c979df49622f619e6c101e83b9d24e4d7694e494db53762af3c2b9e826c)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.1.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.1.0

- My notifications toggles stop the device push only; the inbox row and unread count always show the notice (`notificationShowsInInbox`, `devicePushAllowed`). The app-icon badge matches the inbox.
- Every variation notification type sends a device push (`variation_renumbered`, `variation_added`, `variation_from_tracker`, `variation_numbers_updated` join `variation`).
- Pay and manager decisions are protected on every path (security rules and shared rules; see §8 and §16).

## New rulebook sections

- 1.1.0 — 2026-10-31

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
