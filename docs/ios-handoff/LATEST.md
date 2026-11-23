# iOS follow-on — rulebook 1.71.0

Generated 2026-11-23 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.70.0 → 1.71.0
Packed hash: 924b7ef2fb89d62146b7e5f4c9149d2650733a1cc5910e624994311bfd6280e7
Rulebook sha256: 2f9661384d84aee67faa7798508c73f08e6b08cc51d3b5623d12ba81c045ad86
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
Exports added: COMPANY_EXPORT_REFUSED_MESSAGE, canExportCompanyData, timesheetLineReviewActionsAllowed
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/timesheetPeriod.ts, lib/canonical/timesheetRevisions.ts, lib/canonical/companyDataExport.ts
Done when:
- [ ] Packed hash in iOS equals 924b7ef2fb89d62146b7e5f4c9149d2650733a1cc5910e624994311bfd6280e7
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 2f9661384d84aee67faa7798508c73f08e6b08cc51d3b5623d12ba81c045ad86)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.71.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.71.0

- **Company data export is the Super Admin's** (§12, owner decision 23 Nov, issue 11): new `canExportCompanyData(viewer, organization)` / `COMPANY_EXPORT_REFUSED_MESSAGE` (`lib/canonical/companyDataExport.ts`, on `isOrganizationSuperAdmin`), used by every web way in and the runner (checked again on the organisation document read). Guardrail 3: admins who are not the Super Admin lose the Export company data row and page. Export content (web `lib/companyExport`, not packed): an anchored member whose own account belongs to another company is exported with name and contact only; former people, report checks and material contacts get their own files; worksListPicks, invitations and account confirmations are listed as excluded; a cell starting with a line feed is formula-guarded too.
- **No ✓ ✕ ⚙ on an exported timesheet** (§8, issue 22A): new `timesheetLineReviewActionsAllowed(sheet)` (false once `resolveTimesheetExportedAtMs` says exported). Web's review page no longer offers line actions on an exported sheet.
- **Create revision wording** (§8, issue 22B): `TIMESHEET_CREATE_REVISION_LABEL` is "Create revision to adjust this timesheet" and `TIMESHEET_CREATE_REVISION_HELP` the owner's text; web drops the "(REV n)" suffix on the button.

## iOS work for 1.71.0

1. **No ✓ ✕ ⚙ on an exported timesheet (issue 22A).** In `Views/InvoicingView.swift` (`OperativeTimesheetReviewView` / the manager review rows) and `Views/TimesheetManagerReviewSupport.swift`, offer approve / decline / Edit hours on labour lines, price work, expenses and late extras only while `timesheetLineReviewActionsAllowed(sheet)` is true (pass the stored sheet fields, at least `exportedAt` and `invoiceGeneratedAt`). An exported sheet is read-only; the live 1.54.1 rules already refuse any change to it.
2. **Create revision wording (issue 22B).** The reviewer's revision button shows `TIMESHEET_CREATE_REVISION_LABEL` exactly ("Create revision to adjust this timesheet", no "(REV n)" suffix) and `TIMESHEET_CREATE_REVISION_HELP` under it (`Core/Rulebook+TimesheetRevisions.swift`, `Views/InvoicingView.swift`). Read both from `CanonicalBusinessEngine`; keep no copy in Swift.
3. **Company data export (issue 11).** iOS has no export screen; nothing to build. `canExportCompanyData` is packed so a future iPhone export asks the same Super Admin rule.

## New rulebook sections

- 1.71.0 — 2026-11-23

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
