# iOS follow-on — rulebook 1.86.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.86.0 → 1.86.0
Packed hash: ce4d1fa7b2a744de0da5f22706ce5929fb0b77de48632d6fc25031471ecbba9d
Rulebook sha256: 4cdab0b48c7be52601d42bce6f57472b58737b9538b454a1c40701651defbc27
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
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/canonical.test.ts, lib/canonical/offlineReplace.ts
Done when:
- [ ] Packed hash in iOS equals ce4d1fa7b2a744de0da5f22706ce5929fb0b77de48632d6fc25031471ecbba9d
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 4cdab0b48c7be52601d42bce6f57472b58737b9538b454a1c40701651defbc27)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.86.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.86.0

- **Offline Replace on iPhone** (§2, §5, owner decision 24 Nov "Replace works offline, is queued, and is applied when signal returns"): `booking.replace` is `allowedOffline` in `OFFLINE_ACTIONS` (was `onlineOnly` from 1.41.0). New `lib/canonical/offlineReplace.ts`: `offlineReplaceReplayDecision` (`apply`, `createOnly`, `alreadyApplied`, `dropLocal`, `refuseChanged`, `refusePermission`, per-target outcomes), `offlineReplaceRefusalDecision` (the `offlineDeleteRefusalDecision` mapping), `OFFLINE_REPLACE_REPLAY_DECISIONS`, `OFFLINE_REPLACE_TARGET_OUTCOMES`, `OFFLINE_REPLACE_CHANGED_MESSAGE`, `OFFLINE_REPLACE_REFUSED_MESSAGE`. A replaced booking changed on another device refuses the whole Replace (nothing written, both bookings as the server has them). Web unchanged (online only). No rules change.
- Review of #446 (same version): a replaced booking with no read row, or a read with no answer, refuses instead of reading as gone; a read row without a collection is matched to its target by id. iOS keeps an item queued when the script does not answer, restores replaced bookings on `dropLocal`, and never merges into or replaces around an item being sent. Emulator test of the replay transaction reading the missing new booking and its tombstone.

## iOS work for 1.86.0

- Companion PR: project-planner-ios #293 (branch `ios-1.86-offline-replace`): `Core/Rulebook+OfflineReplace.swift`, `Core/FirebaseBackend+OfflineReplace.swift`, `Core/OfflineOutboxStore.swift` (`.replaceBooking`), `Core/OfflineSyncCoordinator.swift` (`replayReplace`, `undoReplace`), `Core/BookingStore.swift` / `Core/ManagerScheduleStore.swift` (queue when offline), `Views/OfflineStatusBanner.swift` (Undo replace).
- iOS never passes `mayCreate` to `offlineReplaceReplayDecision`: the new booking's write permission was checked when the Replace was queued (`writeRefusal`), and on replay the security rules decide (a refusal is read with `offlineReplaceRefusalDecision`).
- Every replaced booking is read in the transaction and passed with its collection; a read with no answer is never passed as missing (`live: null` only for a document the read found missing).
- When the script does not answer, or `bookingReplaceWrites` returns nil, the item stays queued (retry), never removed.


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
