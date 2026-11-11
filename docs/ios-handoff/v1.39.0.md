# iOS follow-on — rulebook 1.39.0

Generated 2026-11-11 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.39.0 → 1.39.0
Packed hash: 00f7afac575c1a2ba9b3c5f2403a0550136fc71649786444b754d24a69acc203
Rulebook sha256: 0a5255ef56f60b111c0b5949d62c4316709e3134018120511d02f677fe0dcc48
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 59d6bc6123f250e1f57599240eb3190ab48f5cd2532f8281a99360d9e187d86b
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: MY_SCHEDULE_CLASH_DISMISSED, MY_SCHEDULE_CLASH_NOT_IN_PERIOD, bookingBreakDeductionText
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bookingHoursExplanation.test.ts, lib/canonical/bookingHoursExplanation.ts, lib/canonical/bookingHoursText.test.ts, lib/canonical/bookingHoursText.ts, lib/canonical/bundleEntry.ts, lib/canonical/index.ts, lib/canonical/myScheduleClash.ts, lib/canonical/parity-fixture.json
Done when:
- [ ] Packed hash in iOS equals 00f7afac575c1a2ba9b3c5f2403a0550136fc71649786444b754d24a69acc203
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 0a5255ef56f60b111c0b5949d62c4316709e3134018120511d02f677fe0dcc48)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.39.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.39.0

- **Booking hours explained** (§4.3, owner request 11 Nov): new `bookingHoursExplanation` and `bookingShortfall` (new `bookingHoursExplanation.ts`); `weekendBookingBreakdown` rows gain `explanation: { rule, steps }`. Every booking picker on both apps shows the day's rule and the steps behind each figure (owner examples: "Booked 07:30–10:30 = 3h of the 6.5h window → 8h × 3 ÷ 6.5 = 3.69h"; "07:30–14:00 = 8h (full day) + 14:00–16:00 = 2h × 2 = 4h → 12h"; "Sunday every hour at 2×: 07:30–10:30 = 3h × 2 = 6h"), and weekdays the same (working day, unpaid break, overtime at the multiplier). iOS "Missing to standard day" becomes `bookingShortfall`'s "Short of a full Saturday (8h)", compared with that day's own full day; none on a day paid every hour at a multiplier. Wording only — no figure, write or rule changes; the parity fixture gains the `explanation` field and six cases.
- **Whole-row selection** (owner request 11 Nov, UI only): on iOS a person's whole tile selects or deselects them on Select people and the other people pickers; web rows were already whole-row buttons and now say whether they are selected (`aria-pressed`). No rule change.
- **Hours, overtime and break labels** (§4.3, owner answers 11 Nov): new `overtimeTotalText`, `overtimeIncludedText`, `bookedWithOvertimeText`, `bookingHoursCountText`, `onSiteHoursText`, `saveHoursLabel`, `bookingBreakText`, `bookingHoursTiles` (new `bookingHoursText.ts`). Daily Overview tile "12 OT 1.5×" → "12h OT × 1.5 = 18h"; job line "60.5h booked · +12h OT" → "60.5h booked (incl. 12h OT × 1.5)"; Daily Overview booking rows show the times and the hours pill only; My Schedule total "incl. 6h OT × 1.5 = 9h"; Edit booking tiles "9 Standard (−0.5 break)", "6 OT" (no break tile); "break included" → "30 min unpaid break 11:30–12:00"; "30 mins deducted around midday" → "30 mins deducted 11:30–12:00"; "17.5h paid" → "17.5 hours", "Save · 17.5 hours". Figures unchanged.
- **The break in the hours explanation** (§4.3, owner answer 11 Nov): `bookingHoursExplanation` names the lunch break on the part it falls in, from that day's working hours (unpaid and taken off, paid and not deducted, or removed on the booking), and gains `summary` (one line). Its `steps` change wording: a weekday or set-window break is no longer a separate "− 0.5h unpaid break" step (hours at a multiplier keep it); the parity fixture is regenerated.
- **My Schedule booking clash marker** (§10, owner answer 11 Nov): new `myScheduleClashMarkers`, `MY_SCHEDULE_CLASH_TITLE`, `MY_SCHEDULE_CLASH_APPROVED_TITLE`, `MY_SCHEDULE_CLASH_APPROVED_MESSAGE`, `MY_SCHEDULE_CLASH_ASK_MANAGER`, `MY_SCHEDULE_CLASH_OPEN_WARNINGS` (new `myScheduleClash.ts`), on the Warnings clash rules. Display only.
- **Review fixes (11 Nov)**: `myScheduleClashMarkers` takes `scanDayKeys` and offers "Open Warnings" only for a clash Warnings lists now (`MY_SCHEDULE_CLASH_NOT_IN_PERIOD`, `MY_SCHEDULE_CLASH_DISMISSED`), with the viewer's real scope; `bookingShortfall` takes the day's bookings and measures coverage of the working day (lunch window excluded), never paid hours (breaking for the 1.39.0 draft that took paid hours); new `bookingBreakDeductionText`; `bookingBreakText.toggleLabel`; `bookingHoursExplanation` names a booking's own overtime rate.
- **Daily Overview moves in one batch** (§6, owner answer 11 Nov, web): the new booking, the old booking's delete and its tombstone are one write (was a create then a delete).
- Not in this release (reported to the owner): "Replace existing booking" beside a double-booking row (item 2) — see the PR.
- Merges after 1.38.0 (data parity, in flight); version 1.38.0 is that release's.


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
