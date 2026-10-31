# Shared operational change (web ↔ iOS)

Use this for fundamental operational or rule work (bookings, warnings, invoicing, labour, organisation, leave, timesheets, variations, Firestore shape). Skip it for a CSS, copy, or layout-only tweak.

This file is also the start prompt for the iOS repo: when shared work begins there, paste this file as the first message, then describe the change.

Web and iOS do **not** call each other at runtime. They share:

1. Rulebook source: web `lib/canonical` (TypeScript). A commit that touches it packs `lib/canonical/dist/canonical-business.js`. iOS commits that file to `Project Planner/Canonical/` and calls `CanonicalBusinessEngine`.
2. The same Firebase project. Field names, document shapes, and enums must stay iOS-decodable. If the website is down, iOS still runs from its packed copy + Firebase.

Do not invent a second calculator. Do not hand-edit either packed JS file.

## Start here

1. Read `docs/CANONICAL_ARCHITECTURE.md`. Search `lib/canonical` and call the existing function.
2. Keep Firebase fields and shapes (`ORGANIZATION_DOCUMENT_FIELDS`, `USER_DOCUMENT_FIELDS`, `OPERATIONAL_COLLECTION_PATHS`, `firestore.rules`). A save on one device must not drop fields the other still uses.
3. Organisation-scoped async work uses `adoptCurrentOrganization` / `organizationContextStillCurrent`. Cache and persistence keys include the organisation id.
4. If the platforms disagree, find the first divergence: database → query → org context → business rule → date rule → cache → UI. Do not patch a screen number to copy the other platform.

## If both platforms must agree

Same change: edit TypeScript under `lib/canonical/` (export from `index.ts` and `bundleEntry.ts`); add a test in `lib/canonical/canonical.test.ts`; update `docs/CANONICAL_ARCHITECTURE.md` when the boundary moves. Record the hash in `lib/canonical/dist/canonical-business.sha256`. UI and navigation stay in the app. Do not restyle the hub and call the job done.

## After the change — always emit the hand-off

In the web repo the box is generated, not hand-written: bump `Version:` in `docs/RULEBOOK.md`, add the changelog entry, run `npm run build:canonical` and `npm run rulebook:handoff`, and paste `docs/ios-handoff/LATEST.md` to the user. The pre-commit hook and the Claude Code Stop hook refuse to finish otherwise. The generated file follows this box; fill any line by hand only when working in the iOS repo:

Fill every line. Target **iOS** when this work ran in the web repo. Target **web** when this work ran in the iOS repo (or these instructions were pasted there). If web had to change `lib/canonical` after an iOS start, send a new iOS box with the new hash.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the [iOS | web] agent                     ║
╚══════════════════════════════════════════════════════════════════╝
Started on: [web | iOS]
What changed: [one sentence]
Shared rule (lib/canonical): [function names]  OR  Firebase-only: [fields / collections / rules]
Rulebook version: [old → new from docs/RULEBOOK.md]
Packed hash: [sha256 from lib/canonical/dist/canonical-business.sha256, or unchanged]
Copy packed file (if hash changed):
  web lib/canonical/dist/canonical-business.js
  → iOS Project Planner/Canonical/canonical-business.js
  (and the .sha256 sibling, canonical-manifest.json → Project Planner/Canonical/, docs/RULEBOOK.md → iOS docs/RULEBOOK.md).
  iOS: run scripts/sync-rulebook-from-web.sh. Do not edit the JS or the rulebook mirror by hand.
Call: iOS CanonicalBusinessEngine / web @/lib/canonical — no second calculator.
Firebase keep: [exact field names / document shapes / enums]
Files / screens on your side: [paths]
Do not: restyle the hub; stop at the landing screen; invent a parallel window, midpoint, or hour value.
Done when:
- [ ] Nested screens + behaviour match (not hub tiles)
- [ ] Same Firebase fields read and written
- [ ] Calculator is CanonicalBusinessEngine (iOS) or @/lib/canonical (web)
- [ ] Packed hash matches: [hash or n/a]
- [ ] Any disagreement traces the first divergence — no copied screen number
```
