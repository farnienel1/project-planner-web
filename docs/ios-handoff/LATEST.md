# iOS follow-on — rulebook 1.84.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.83.0 → 1.84.0
Packed hash: af9fdd334942c32b156a41860d6707b2a03c1e1c3db54b7cbf35dbaeffe73fc8
Rulebook sha256: c6a93907c39554db96676d2fb5287b4cc0a19128c16120007a66fdd167cbc05f
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: d2d465abcf0ab7c7747385346b87d2b47226412b1014602c5a26bff8e951c0ca
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: CLIENT_ERRORS_COLLECTION, CLIENT_ERRORS_PER_DAY, CLIENT_ERROR_BUILD_MAX, CLIENT_ERROR_DAY_MS, CLIENT_ERROR_FIELDS, CLIENT_ERROR_MESSAGE_MAX, CLIENT_ERROR_ORGANIZATION_ID_MAX, CLIENT_ERROR_PLATFORMS, CLIENT_ERROR_ROUTE_MAX, CLIENT_ERROR_SOURCES, CLIENT_ERROR_TTL_DAYS, clientErrorCreateFields, clientErrorDayIndex, clientErrorDocId, clientErrorGroups, clientErrorHashInput, clientErrorSignature, clientErrorThrottle, parseClientErrorDocument, sanitizeClientErrorRoute, sanitizeClientErrorText
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/index.ts, lib/canonical/liveSources.ts, lib/canonical/clientErrors.test.ts, lib/canonical/clientErrors.ts
Done when:
- [ ] Packed hash in iOS equals af9fdd334942c32b156a41860d6707b2a03c1e1c3db54b7cbf35dbaeffe73fc8
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 c6a93907c39554db96676d2fb5287b4cc0a19128c16120007a66fdd167cbc05f)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.84.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.84.0

- **Client error reports** (new §32, owner decision D7, 16 Nov; new `lib/canonical/clientErrors.ts`): `CLIENT_ERRORS_COLLECTION`, `CLIENT_ERROR_FIELDS`, `CLIENT_ERROR_PLATFORMS`, `CLIENT_ERROR_SOURCES`, `CLIENT_ERRORS_PER_DAY` (20), `CLIENT_ERROR_TTL_DAYS` (30), the caps, `sanitizeClientErrorText`, `sanitizeClientErrorRoute`, `clientErrorDayIndex`, `clientErrorHashInput`, `clientErrorDocId`, `clientErrorSignature`, `clientErrorThrottle`, `clientErrorCreateFields`, `parseClientErrorDocument`, `clientErrorGroups`. `LIVE_COLLECTIONS` lists `clientErrors` (platform scope, never shown to members; `CONTRACT_NO_READER`). `firestore.rules`: create-only in the exact shape under the id the rules recompute (`hashing.sha256(uid|day)` + slot 0–19), owner-only read. Web: `reportClientError` (window errors, unhandled rejections, the dashboard, root and timesheet error boundaries); owner console → Errors (`/developer/errors`, `/api/owner/errors`). iOS: `ClientErrorReporter` (`logAndReportError` on the logged error lines, uncaught exceptions on next launch).
- **Security rules headroom** (no allow / deny change): one-use helpers written out in their callers, repeated expressions bound once with `let`, the match variable `{organizationId}` renamed `{orgId}`, the last comments moved to `docs/firestore-rules-notes.md` ("1.84.0 headroom"). Static compile cost 224,751 → 219,452 before the new rules (−2.4%); 155,533 → 151,286 bytes (−2.7%); functions behind the requests closest to the 1,000-expression limit are left as they were (a −11% variant refused 17 requests). New proof tool `scripts/rules-cost/equiv.py` (every allow fully inlined, compared token for token) and the transformation scripts `scripts/rules-cost/headroom_*.py`.

## iOS work for 1.84.0

## iOS work for 1.84.0

1. **Error reports** (§32, D7): `Core/ClientErrorReporter.swift` — `ClientErrorReporter.install()` at launch (`Project_PlannerApp.init`), `logAndReportError(_:)` in place of the existing `print("❌ …")`, `print("Error …")` and failing `print("⚠️ …")` lines. Fields, sanitiser, id and throttle from the packed rulebook (`clientErrorCreateFields`, `clientErrorHashInput`, `clientErrorDocId`, `clientErrorThrottle`, `clientErrorSignature`) through `CanonicalBusinessEngine.callJSON`; the hash is CryptoKit SHA-256 in lower-case hex (the rules recompute it). Uncaught Objective-C exceptions are kept on the device and sent on the next launch. Signed-out devices send nothing. Tests: `ClientErrorReporterTests`.
2. **Rules headroom**: nothing to do on iOS (no rule decides differently). The rules' match variable is now `{orgId}`; the iOS repo keeps no copy of `firestore.rules` it edits.

## New rulebook sections

- 32. Client error reports (1.84.0)
- 1.84.0 — 2026-11-24

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
