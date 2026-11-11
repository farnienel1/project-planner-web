# iOS follow-on — rulebook 1.39.0

Generated 2026-11-11 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.37.0 → 1.39.0
Packed hash: 5f1eae2fa2147cc3f7876a459f2e4cc92e5741daf6bda51233e81737a2e8ef1e
Rulebook sha256: 6516250c32db29df26531c84927bf02162d6bc7bc93702066bb4bf7bd0496653
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 59d6bc6123f250e1f57599240eb3190ab48f5cd2532f8281a99360d9e187d86b
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: bookingHoursExplanation, bookingShortfall
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bookingHoursExplanation.test.ts, lib/canonical/bookingHoursExplanation.ts, lib/canonical/bookingSlots.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/parity-fixture.json
Done when:
- [ ] Packed hash in iOS equals 5f1eae2fa2147cc3f7876a459f2e4cc92e5741daf6bda51233e81737a2e8ef1e
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 6516250c32db29df26531c84927bf02162d6bc7bc93702066bb4bf7bd0496653)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.39.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.39.0

- **Booking hours explained** (§4.3, owner request 11 Nov): new `bookingHoursExplanation` and `bookingShortfall` (new `bookingHoursExplanation.ts`); `weekendBookingBreakdown` rows gain `explanation: { rule, steps }`. Every booking picker on both apps shows the day's rule and the steps behind each figure (owner examples: "Booked 07:30–10:30 = 3h of the 6.5h window → 8h × 3 ÷ 6.5 = 3.69h"; "07:30–14:00 = 8h (full day) + 14:00–16:00 = 2h × 2 = 4h → 12h"; "Sunday every hour at 2×: 07:30–10:30 = 3h × 2 = 6h"), and weekdays the same (working day, unpaid break, overtime at the multiplier). iOS "Missing to standard day" becomes `bookingShortfall`'s "Short of a full Saturday (8h)", compared with that day's own full day; none on a day paid every hour at a multiplier. Wording only — no figure, write or rule changes; the parity fixture gains the `explanation` field and six cases.
- **Whole-row selection** (owner request 11 Nov, UI only): on iOS a person's whole tile selects or deselects them on Select people and the other people pickers; web rows were already whole-row buttons and now say whether they are selected (`aria-pressed`). No rule change.
- Merges after 1.38.0 (data parity, in flight); version 1.38.0 is that release's.

## New rulebook sections

- 1.39.0 — 2026-11-11

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
