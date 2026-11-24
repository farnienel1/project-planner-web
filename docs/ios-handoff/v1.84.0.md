# iOS follow-on — rulebook 1.84.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.83.0 → 1.84.0
Packed hash: b31ded389d4833f09e3492a0c31e56fe51cbd3c198b489edf5d9e189a07371df
Rulebook sha256: d63be3c1c90bba0d8abbc9d6c5ced4e0ff9ff4c2c3eac6e0bc40b12b6ceb1d09
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
Exports added: CLIENT_ERRORS_COLLECTION, CLIENT_ERRORS_PER_DAY, CLIENT_ERROR_BUILD_MAX, CLIENT_ERROR_DAY_MS, CLIENT_ERROR_FIELDS, CLIENT_ERROR_KIND_MAX, CLIENT_ERROR_KNOWN_MESSAGES, CLIENT_ERROR_ORGANIZATION_ID_MAX, CLIENT_ERROR_OTHER_MESSAGE_KEY, CLIENT_ERROR_PLATFORMS, CLIENT_ERROR_ROUTE_MAX, CLIENT_ERROR_SOURCES, CLIENT_ERROR_TTL_DAYS, CLIENT_ERROR_WHERE_MAX, clientErrorBuild, clientErrorCreateFields, clientErrorDayIndex, clientErrorDocId, clientErrorGroups, clientErrorHashInput, clientErrorKind, clientErrorMessageKey, clientErrorNextSlot, clientErrorRoute, clientErrorSignature, clientErrorThrottle, clientErrorWhere, parseClientErrorDocument, redactClientErrorTokens
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.indexes.json, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/clientErrors.test.ts, lib/canonical/clientErrors.ts, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/index.ts, lib/canonical/liveSources.ts
Done when:
- [ ] Packed hash in iOS equals b31ded389d4833f09e3492a0c31e56fe51cbd3c198b489edf5d9e189a07371df
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 d63be3c1c90bba0d8abbc9d6c5ced4e0ff9ff4c2c3eac6e0bc40b12b6ceb1d09)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.84.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.84.0

- **Client error reports** (new §32, owner decision D7, 16 Nov; new `lib/canonical/clientErrors.ts`; review of #448: no message text, pseudonymous): `CLIENT_ERRORS_COLLECTION`, `CLIENT_ERROR_FIELDS`, `CLIENT_ERROR_PLATFORMS`, `CLIENT_ERROR_SOURCES`, `CLIENT_ERRORS_PER_DAY` (20), `CLIENT_ERROR_TTL_DAYS` (30), the caps, `CLIENT_ERROR_KNOWN_MESSAGES`, `clientErrorMessageKey`, `clientErrorKind`, `clientErrorWhere`, `clientErrorRoute`, `clientErrorBuild`, `redactClientErrorTokens`, `clientErrorNextSlot`, `clientErrorDayIndex`, `clientErrorHashInput`, `clientErrorDocId`, `clientErrorSignature`, `clientErrorThrottle`, `clientErrorCreateFields`, `parseClientErrorDocument`, `clientErrorGroups`. `LIVE_COLLECTIONS` lists `clientErrors` (platform scope, never shown to members; `CONTRACT_NO_READER`). `firestore.rules`: create-only in the exact shape under the id the rules recompute (`hashing.sha256(uid|day)` + slot 0–19), owner-only read; composite indexes on `clientErrors` (platform / organizationId + createdAt). Web: `reportClientError` (window errors, unhandled rejections, the dashboard, root and timesheet error boundaries); owner console → Errors (`/developer/errors`, `/api/owner/errors`). iOS: `ClientErrorReporter` (`logAndReportError` on the logged error lines, uncaught exceptions on next launch).
- **Security rules headroom** (no allow / deny change): one-use helpers written out in their callers, repeated expressions bound once with `let`, the match variable `{organizationId}` renamed `{orgId}`, the last comments moved to `docs/firestore-rules-notes.md` ("1.84.0 headroom"). Static compile cost 224,751 → 219,452 before the new rules (−2.4%); 155,533 → 151,286 bytes (−2.7%); functions behind the requests closest to the 1,000-expression limit are left as they were (a −11% variant refused 17 requests). New proof tool `scripts/rules-cost/equiv.py` (every allow fully inlined, compared token for token) and the transformation scripts `scripts/rules-cost/headroom_*.py`.

## iOS work for 1.84.0

## iOS work for 1.84.0

1. **Error reports** (§32, D7; no message text, pseudonymous): `Core/ClientErrorReporter.swift` — `ClientErrorReporter.install()` at launch (chains to any earlier uncaught-exception handler; the pending crash report is sent from a background task, and again after sign-in), `logAndReportError(_:file:function:)` in place of the existing `print("❌ …")`, `print("Error …")` and failing `print("⚠️ …")` lines (kind `LoggedError`, `where` = `#fileID` + `#function`, message text only hashed). Fields, key, id, throttle and next slot from the packed rulebook (`clientErrorCreateFields`, `clientErrorHashInput`, `clientErrorDocId`, `clientErrorThrottle`, `clientErrorSignature`, `clientErrorNextSlot`) through `CanonicalBusinessEngine.callJSON`; hashes are CryptoKit SHA-256 in lower-case hex. A create refused because the slot is used tries the next slot. Signed-out devices send nothing. Tests: `ClientErrorReporterTests`.
2. **Rules headroom**: nothing to do on iOS (no rule decides differently). The rules' match variable is now `{orgId}`; the iOS repo keeps no copy of `firestore.rules` it edits.

## New rulebook sections

- 32. Client error reports (1.84.0)
- 1.84.0 — 2026-11-24

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
