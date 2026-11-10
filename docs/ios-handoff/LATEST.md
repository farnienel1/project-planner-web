# iOS follow-on — rulebook 1.33.1

Generated 2026-11-10 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.33.0 → 1.33.1
Packed hash: 20ddc046ee16f033a744098c33ebd1a0746eababd4a4031528ba07dd26af9b3e
Rulebook sha256: b0f513e1a252f705b1d4e2319ae46bb200b5e88614843ae04aa6c6023d41c63f
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 2cdfce213103271f346105163c0d4ceb6098a677a363f311281db01866a03de2
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules
Done when:
- [ ] Packed hash in iOS equals 20ddc046ee16f033a744098c33ebd1a0746eababd4a4031528ba07dd26af9b3e
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 b0f513e1a252f705b1d4e2319ae46bb200b5e88614843ae04aa6c6023d41c63f)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.33.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.33.1

- **Security rules hotfix, no allow/deny change** (§13, §16). A notification create carrying a server-timestamp `createdAt` — the shape both apps write (`notificationCreateFields`, 1.16.0) — crashed the rules engine on the emulator (`IllegalStateException: ternary operator predicate is always boolean`) and errored in production (Rules metrics: 21 errors). A notification **update** written with a merge-set or full set plus a server timestamp hung on the 1.33.0 rules too, not only creates. The client got no answer and retried for ever, so on iOS every later write from that phone stayed "Pending sync". The notifications `allow create, update` that 1.32.2 merged with a `request.method` ternary is split back into `allow create` and `allow update` with the same conditions. An invitation create with a server-timestamp field crashed the same way (no app writes one today: both use a client `Timestamp`): its privilege-type check now runs before the ternary as a plain `&&` term (same decision). `orgBillingOpen` reads `accessClosesAt` directly once its type is checked (same value; pays for the split). New permanent suite `tests/methodTernary.rules.test.ts`: every allow that serves more than one method, plus a sweep of every organisation collection and the people documents, written with server timestamps, must answer; with `FIRESTORE_EMULATOR_LOG` set it also asserts no `IllegalStateException`. Static compile cost 237,518 → 236,475.

## iOS work for 1.33.1

Rulebook 1.33.1 is a Firestore security rules hotfix. No rulebook function, export, data shape or screen changes.

Three-factor check: **Web** (no app code change), **iOS** (sync only, below), **Shared rule** (`firestore.rules`:
the notifications `allow create` / `allow update` split, the invitation privilege check moved ahead of its ternary;
no packed-script change beyond the rulebook stamp).

1. Run `scripts/sync-rulebook-from-web.sh` and the iOS tests (`RulebookParityTests`). Nothing else to build.
2. Background for testers: before the owner publishes 1.33.1, creating an inbox row with
   `FieldValue.serverTimestamp()` as `createdAt` (`NotificationDocument` via `notificationCreateFields`,
   `Rulebook+CreateDocuments.swift`) made the rules engine fail; the Firestore SDK retried it for ever and every later
   write from that phone queued behind it ("Pending sync"). A notification update written as a merge-set or full set with a server timestamp hung the same way. After the
   publish the queued writes are **expected** to go through by themselves (the SDK retries them) — untested, so the
   owner checks one affected phone. Do not change the iOS payload (it is the rulebook shape) and do not add a client workaround.
3. If a tester's phone still shows "Pending sync" a few minutes after the publish with the app open and online,
   report the device and time to the web agent (it is a rules question, not an iOS one).

## New rulebook sections

- 1.33.1 — 2026-11-10

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
