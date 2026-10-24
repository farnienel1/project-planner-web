# Prompt 0 — start here (web or iOS)

Paste this as the first message when changing a Project Planner **operational rule or shared behaviour** (bookings, warnings, invoicing, labour, organisation, leave, timesheets, variations, Firestore shape). Not a visual-only tweak.

You are working on Project Planner. Web and iOS do not call each other at runtime. They share:

1. The canonical rulebook. Source is web `lib/canonical` (TypeScript). Commits that touch it pack `canonical-business.js`. iOS commits that file to `Project Planner/Canonical/` and calls `CanonicalBusinessEngine`. Do not hand-edit the JS. Do not invent a second calculator.
2. The same Firebase project. Keep field names, document shapes, and enums. A save on one device must not drop fields the other still uses. If the website is down, iOS still runs from its packed copy + Firebase.

Do this before coding:

- Read web `docs/CANONICAL_ARCHITECTURE.md` (and the repo `AGENTS.md`). Search `lib/canonical` / `CanonicalBusinessEngine` and call the existing function.
- Organisation-scoped work: `adoptCurrentOrganization` / `organizationContextStillCurrent`. Cache keys include the organisation id.
- If the platforms disagree: find the first divergence (database, query, org context, business rule, date rule, cache, then UI). Do not patch a screen number to copy the other platform.

If both platforms must agree: change TypeScript under web `lib/canonical`, export it, add `lib/canonical/canonical.test.ts`, update `docs/CANONICAL_ARCHITECTURE.md` when the boundary moves. iOS copies the packed file and calls `CanonicalBusinessEngine`. Do not restyle the hub and call the job done.

When finished, emit this box for the **other** platform (iOS if you ran in web; web if you ran in iOS). If web changed the rulebook after an iOS start, send a new iOS box with the new hash.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the [iOS | web] agent                     ║
╚══════════════════════════════════════════════════════════════════╝
Started on: [web | iOS]
What changed: [one sentence]
Shared rule (lib/canonical): [function names]  OR  Firebase-only: [fields / collections / rules]
Packed hash: [sha256 from lib/canonical/dist/canonical-business.sha256, or unchanged]
Copy packed file (if hash changed):
  web lib/canonical/dist/canonical-business.js
  → iOS Project Planner/Canonical/canonical-business.js
  (and the .sha256 sibling). Do not edit the JS by hand.
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

Then do the work described in my next message.
