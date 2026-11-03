# iOS follow-on — rulebook 1.20.2

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.20.1 → 1.20.2
Packed hash: d5808ccec9102919e2fa2246ce6933fec2c0cb1b12a2f38664405fbecc64e22a
Rulebook sha256: 5b8ca46347fa93842af738e991901602dba25f1ea18f4f9657e2cb1c691c941b
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: c9e307b0604e78284baf3a4f217f0fb3ecc4b227aec957c901bdd93e4e31a306
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: PAYROLL_POLICY_TIME_STEP_MESSAGE, PAYROLL_POLICY_TIME_STEP_MINUTES, bookingHoursLabel, bookingRequestIdentity, isSameBookingRequest, payrollPolicyTimeOnStep
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bookingSlots.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/payrollPolicySchedule.ts
Done when:
- [ ] Packed hash in iOS equals d5808ccec9102919e2fa2246ce6933fec2c0cb1b12a2f38664405fbecc64e22a
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 5b8ca46347fa93842af738e991901602dba25f1ea18f4f9657e2cb1c691c941b)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.20.2)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.20.2

- A new booking never replaces or hides another: "already booked" is the same person, day, slot, place and — for custom hours — the same start, finish and break (`bookingRequestIdentity`, `isSameBookingRequest`). Web My Schedule and Book labour compared without the times, so a second weekend booking at the same place was silently dropped after the double-booking row was ticked, and My Schedule showed two such bookings as one. Creates always use a fresh id and a plain create write (§2).
- Booking rows on every list show the times ("Custom 07:30–14:00") and the pay rule's hours for that day with the multiplier sum (`bookingHoursLabel`): Saturday 07:30–14:00 on an 8h window → "8h", Sunday every hour × 2 → "13h (6.5h × 2)". Daily Overview's day total is the paid hours, split into standard hours and hours at the multiplier (§6, §10).
- Working-hours clock times are on 30-minute steps (`PAYROLL_POLICY_TIME_STEP_MINUTES`, `payrollPolicyTimeOnStep`, `validatePayrollTimePolicy(policy, previous)`: "Working hours use 30-minute steps (e.g. 07:30)."); break length stays any minutes 0–120; a time stored off the step passes until changed. iOS: offer 30-minute pickers (§4.3).

## New rulebook sections

- 1.20.2 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
