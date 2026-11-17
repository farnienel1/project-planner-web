# iOS follow-on — rulebook 1.61.1

Generated 2026-11-17 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.61.0 → 1.61.1
Packed hash: e54d3febbc9ec1b588a9df56773acbbb6652ad12d264fd9b1a5807a7794c1bb1
Rulebook sha256: c80d74b81beefb78f8b20db8825679f0635d311b96152ea3bb0549e3636b4eb9
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
Exports added: SITE_AUDIT_REPORT_LOGO_BOX, SITE_AUDIT_REPORT_LOGO_PADDING, siteAuditReportLogoPlacement
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/canonical.test.ts, lib/canonical/siteAuditReport.ts, lib/canonical/siteAuditReportFixture.ts, lib/canonical/siteAuditReportFixtureInputs.ts
Done when:
- [ ] Packed hash in iOS equals e54d3febbc9ec1b588a9df56773acbbb6652ad12d264fd9b1a5807a7794c1bb1
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 c80d74b81beefb78f8b20db8825679f0635d311b96152ea3bb0549e3636b4eb9)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.61.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.61.1

- **The company logo at the top right of the site audit report** (§29, owner request 17 Nov): `SITE_AUDIT_REPORT_LOGO_BOX` (110 × 64, right edge on the margin), `SITE_AUDIT_REPORT_LOGO_PADDING`, `siteAuditReportLogoPlacement` (fitted whole, aspect kept, top right, on a white tile); the initials badge when there is no logo or it could not be loaded. Shared fixture cases `logo-very-wide`, `logo-very-tall`, `logo-missing-or-failed`. The 1.61.0 logo box (72 × 64, centred, no tile) is replaced; the owner's report now draws its logo on the tile. Web: one logo loader (`lib/pdf/companyLogo.ts`: https only, 10 s timeout, type from the bytes, WebP / HEIC redrawn, PDF → badge), also used by `familyLogo`.

## New rulebook sections

- 1.61.1 — 2026-11-17

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
