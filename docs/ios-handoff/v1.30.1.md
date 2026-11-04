# iOS follow-on — rulebook 1.30.1

Generated 2026-11-04 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.30.0 → 1.30.1
Packed hash: 4cb06375b34b12530a4ae925a37630865da708f759b17afa6a9155845ff6dc7e
Rulebook sha256: e4b381d6cdefc57141e6efc4c0a06f6dc6fcb8b5b1cd8e53d7429c826d7f59f9
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 7f70ec28920ac6114068b4e44eaf893706d5b6af1b21d77b69f946074d74e126
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: PRICE_WORK_JOB_NUMBER_LABEL, PRICE_WORK_JOB_NUMBER_MAX, PRICE_WORK_JOB_NUMBER_MISSING_TEXT, PRICE_WORK_JOB_NUMBER_REQUIRED_MESSAGE, PRICE_WORK_JOB_NUMBER_TOO_LONG_MESSAGE, priceWorkJobNumberError, priceWorkJobNumberText, timesheetPriceWorkJobNumberError
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/parity-fixture.json, lib/canonical/payeClaims.ts, lib/canonical/reportPay.ts, lib/canonical/priceWorkJobNumber.ts
Done when:
- [ ] Packed hash in iOS equals 4cb06375b34b12530a4ae925a37630865da708f759b17afa6a9155845ff6dc7e
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 e4b381d6cdefc57141e6efc4c0a06f6dc6fcb8b5b1cd8e53d7429c826d7f59f9)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.30.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.30.1

- **Price work needs a job number** (owner decision 4 Nov), in both places (§8, §26): PAYE price work (`priceWorkItems`) and timesheet price work entries (`priceWorkEntries`). New shared module `priceWorkJobNumber.ts`: `priceWorkJobNumberError` (trimmed, 1–60, `PRICE_WORK_JOB_NUMBER_REQUIRED_MESSAGE` "Add the job number for this price work.", `PRICE_WORK_JOB_NUMBER_TOO_LONG_MESSAGE`, `PRICE_WORK_JOB_NUMBER_MAX`), `priceWorkJobNumberText` ("—", `PRICE_WORK_JOB_NUMBER_MISSING_TEXT`, for items and entries stored before 1.30.1), `timesheetPriceWorkJobNumberError(previous, next)` (an owner's new or edited entries only; untouched older entries and reviewer decisions never ask).
- PAYE price work: `PriceWorkDraft.jobNumber`, `priceWorkValidationError` (after the name), `priceWorkWriteFields` (writes `jobNumber`), `parsePriceWorkDocument` (`jobNumber`, '' when none), `payeClaimListRow` (dates · job number · approver), `payeClaimReportSnapshot` (keeps price work's `jobNumber`), `payeClaimReportRows` ("—" for none).
- Timesheets: `timesheetInvoiceRows` rows carry `jobNumber`; web shows it on the sheet, the review list, the invoice, the weekly report price work rows and exports, and Users' read-only rows (`timesheetClaimRows`).
- **Security rules** (§16): `priceWorkItems` create requires `jobNumber` (string, 1–60); update: if present 1–60. No timesheet rule — older iOS builds save entries without it.

## New rulebook sections

- 1.30.1 — 2026-11-04

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
