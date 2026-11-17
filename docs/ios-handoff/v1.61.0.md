# iOS follow-on — rulebook 1.61.0

Generated 2026-11-17 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.60.1 → 1.61.0
Packed hash: bcc9774abf1cdc3b4cbf27eba82fac47b944c96cfa1da6d514390e422f7787ce
Rulebook sha256: 61d74ad112bde913c8ee9f592d33fc8f4304fd57be9ef40a6170a769d0726431
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 8b94c46c4735a448870cfd962ba2097f14c5ede9baf5bc16f180ead937c17f1a
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: SITE_AUDIT_FIELD_LABELS, SITE_AUDIT_FIELD_LIMITS, SITE_AUDIT_REPORT_COLORS, SITE_AUDIT_REPORT_CONTINUED, SITE_AUDIT_REPORT_FIXTURE_EXPECTED, SITE_AUDIT_REPORT_FIXTURE_INPUTS, SITE_AUDIT_REPORT_PAGE, siteAuditAuthorSignature, siteAuditFieldCounter, siteAuditFieldLength, siteAuditFieldLimitError, siteAuditItemTakenMs, siteAuditReferenceCode, siteAuditReportFixtureForApps, siteAuditReportItemFields, siteAuditReportLayout, siteAuditReportPageLabel, siteAuditReportPhotoBox, siteAuditReportText, siteAuditReportTextLines, siteAuditReportTextWidth, wrapSiteAuditReportText
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/cross-platform-contract.json, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/index.ts, lib/canonical/siteAuditReport.ts, lib/canonical/siteAuditReportFixture.ts, lib/canonical/siteAuditReportFixtureInputs.ts, lib/canonical/siteAuditReportFont.ts
Done when:
- [ ] Packed hash in iOS equals bcc9774abf1cdc3b4cbf27eba82fac47b944c96cfa1da6d514390e422f7787ce
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 61d74ad112bde913c8ee9f592d33fc8f4304fd57be9ef40a6170a769d0726431)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.61.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.61.0

- **Site audits** (new §29; owner bug and decisions 17 Nov). Saving keeps the audit on the device before any upload and lists it as Not sent with Retry / Discard until saved; uploads run a few at a time, a stalled one is cancelled and retried, a refusal fails at once with its reason (web outbox and watched upload; iOS stall watchdog on site audit photos). Web reads and writes `imageCapturedAt` (owner Q1).
- **One report on both apps**: `siteAuditReportLayout` (pages of drawing ops, shared Helvetica widths `siteAuditReportFont.ts`), `wrapSiteAuditReportText`, `siteAuditReportText`, `siteAuditReportTextWidth`, `siteAuditReportPhotoBox`, `siteAuditReportItemFields`, `siteAuditItemTakenMs`, `siteAuditReportPageLabel`, `siteAuditReferenceCode`, `siteAuditAuthorSignature`, `siteAuditReportTextLines`, `SITE_AUDIT_REPORT_CONTINUED`, `SITE_AUDIT_REPORT_PAGE`, `SITE_AUDIT_REPORT_COLORS`, and the shared fixture `SITE_AUDIT_REPORT_FIXTURE_INPUTS` / `SITE_AUDIT_REPORT_FIXTURE_EXPECTED` (`siteAuditReportFixtureForApps`). Fixes the iPhone report: fixed-height cards cut off Annotations, photos were a strip in a grey box, "Page n of n". Web's HTML print is replaced by a downloaded PDF from the same layout. Owner Q2–Q5: "Location", report order Location / Assignee / Comments / Annotations, tagline removed, "—" / "None".
- **Field limits** (owner decision 17 Nov): `SITE_AUDIT_FIELD_LIMITS`, `SITE_AUDIT_FIELD_LABELS`, `siteAuditFieldLength`, `siteAuditFieldCounter`, `siteAuditFieldLimitError` — new edits only, stored longer text never cut.
- Cross-platform contract: a full site audit written by each app (every item field, `imageCapturedAt`).

## New rulebook sections

- 29. Site audits: saving and the report (1.61.0)
- 1.61.0 — 2026-11-17

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
