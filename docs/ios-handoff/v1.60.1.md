# iOS follow-on — rulebook 1.60.1

Generated 2026-11-17 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.60.1 → 1.60.1
Packed hash: 307f0a84edfaf2a648420c4d9ca99faf4f00450ce10ef2c9f546325cf171f21d
Rulebook sha256: 4fd40a02d6900065570111d6f03d90cc3688ff33a4c939830ef8e17930f7c0b5
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 5b2615b5540b55f716d40617dd791dbcda6290348ef18951186f47e2e5b7cd20
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md
Done when:
- [ ] Packed hash in iOS equals 307f0a84edfaf2a648420c4d9ca99faf4f00450ce10ef2c9f546325cf171f21d
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 4fd40a02d6900065570111d6f03d90cc3688ff33a4c939830ef8e17930f7c0b5)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.60.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.60.1

- **Timesheet notices: one per signature** (§13, owner report 17 Nov: line managers got no timesheet push on iPhone). `timesheetNotificationDedupeKey` takes `signedAtMs` and adds `|sig{ms}`, so a re-sign of the same pay run — after a cleared signature or a booking change that reopened the sheet (1.47.0) — writes its own `timesheet_pending_manager_signoff` row (and push) instead of hitting the first signature's row, which the create-once rule left alone (no write, no push, no log line). Without the instant the key is unchanged. Web and iOS pass the person's signature instant for the line manager's notice and the line manager's counter-sign instant for `timesheet_signed_by_manager` (so a counter-sign again after a reopen reaches the person) and for the `line_manager_peer_update` row it writes.


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
