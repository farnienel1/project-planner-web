# iOS follow-on — rulebook 1.5.0

Generated 2026-11-02 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.4.0 → 1.5.0
Packed hash: 292cfebb21b67af80e4bbf4e23954a1eccfe35765d1025c549dbe6a439ca0583
Rulebook sha256: d3ee515087cded87ce544048b749e0847ca9dec35fe5cf894298dd71758a624e
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: HOLIDAY_DOCUMENT_KEYS, HOLIDAY_STATUS_SYNONYMS, holidayDocumentDayKey, labourHolidayInput, parseHolidayDocument, parseHolidayDocuments
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/leaveCoverage.ts, lib/canonical/leaveRequests.ts, lib/canonical/parity-fixture.json, lib/canonical/warningRows.ts, lib/canonical/holidayDocument.ts
Done when:
- [ ] Packed hash in iOS equals 292cfebb21b67af80e4bbf4e23954a1eccfe35765d1025c549dbe6a439ca0583
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 d3ee515087cded87ce544048b749e0847ca9dec35fe5cf894298dd71758a624e)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.5.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.5.0

- One reader for annual leave documents: `parseHolidayDocument` / `parseHolidayDocuments` (with `holidayDocumentDayKey`, `labourHolidayInput`, `HOLIDAY_DOCUMENT_KEYS`). Web and iOS read `holidayBookings` with different keys, status words, id rules and day conversion, so the same record fed `unbookedLabourRows` different inputs (iOS listed an admin on approved leave as unbooked). Every platform now reads leave only through this function and passes its organisation-zone day keys to warnings and Daily Overview (§9).
- Status synonyms are shared (`HOLIDAY_STATUS_SYNONYMS`, `normalizeHolidayStatus`): declined, denied and cancelled are rejected and requested / awaiting / submitted are pending (web read them as approved). Slot synonyms morning / afternoon read as AM / PM (`normalizeHolidayTimeSlot`) (§9).
- Unbooked labour and leave coverage match ids without case (`normalizeDocumentId`): an iOS upper-case `userId`, `operativeId` or booking `personId` matches a web lower-case id and the reverse, so leave and bookings are no longer missed by letter case; returned rows keep the stored ids (`unbookedLabourRows`, `unbookedLabourRowsOnDay`, `leaveCoverageRows`) (§5).
- §1 lists the shared document readers; `users/{uid}` documents and `operatives` roster rows are known gaps without one.

## New rulebook sections

- 1.5.0 — 2026-11-02

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
