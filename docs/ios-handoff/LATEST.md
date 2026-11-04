# iOS follow-on — rulebook 1.31.1

Generated 2026-11-04 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.31.1 → 1.31.1
Packed hash: 040fe96362a9437c1dd572b1b101bb47a0d159962bf92fb58c4368d6805eedea
Rulebook sha256: c1d012ebe3f54616e0b89de8f2b7ee57f1b15f47630360429bfa9f4c0bcbd810
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 7f70ec28920ac6114068b4e44eaf893706d5b6af1b21d77b69f946074d74e126
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules
Done when:
- [ ] Packed hash in iOS equals 040fe96362a9437c1dd572b1b101bb47a0d159962bf92fb58c4368d6805eedea
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 c1d012ebe3f54616e0b89de8f2b7ee57f1b15f47630360429bfa9f4c0bcbd810)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.31.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.31.1

- firestore.rules slimmed and restructured so it compiles reliably and every `users/{uid}` and `materials` update is decided by the rules, not by Firestore's 1,000-expression limit. The deploy compile (`firebaserules` `:test`) began returning HTTP 503 as the file grew (180 KB at 1.30.2, 188 KB at 1.31.0); it is now 127 KB (comment blocks moved to `docs/firestore-rules-notes.md`, dead and duplicate functions removed, single-use wrappers inlined).
- **Now take effect as 1.31.0 intended** (§11, owner decision 7): an operatives manager's edits of an operative's users document — names and contact, pay (day / hourly rate, pay basis), active flag, employment type and its dates, line manager, leave fields and the operative toggles — and the legacy by-name material claim (an operative claims a material whose `addedBy` is their email or full name). Before, some of these requests were refused because they ran out of expressions, depending on the documents involved.
- **Refused by the rule logic, not the limit:** an operatives manager changing an operative's role, admin / super admin / manager / Operatives flags, self-manage toggles, `hasNoLineManager`, email, organisation or alias ids (`formerUserIds`, `sameEmailUserIds`); a person changing their own pay, line manager, active flag or privileges; anyone editing another person they do not manage; an owned material reassigned or edited by someone else. 1.31.1 also refuses an operatives manager *adding* `email` or alias ids to an operative that had none (1.31.0's field list only looked at changed keys). It also refuses an admin switching their own Annual Leave Management or Timesheet self-sign off through their own profile (§8, 1.28.0: nobody changes their own; the rules' self-edit path let an admin lower them, and in 1.31.0 such requests were refused only by the expression limit). The Super Admin and the organisation's creator still may.
- **Security (second review):** a privilege flag (`isSuperAdmin`, `adminAccess`, `manager`, `operatives`, `annualLeaveSelfBook`, `timesheetSelfSign`) counts as on when it is on in **either** place — the top level or `permissions.{key}` — in every rule that stops a privilege being gained (`privilegeFlag`, `noPrivilegeFlags`), the way `adminLikeUser` already granted admin from either place. Before 1.31.1 an operatives manager could write `permissions.adminAccess: true` onto an operative whose stored top-level `adminAccess` was false (the operative-edit check read the top level first), and an operatives manager could **create** an operative with `permissions.adminAccess` or `manager` / `operatives` set (the create check read only the top-level `adminAccess` and `isSuperAdmin`) — the second was open on the deployed rules. Both are refused, as is a person setting `permissions.isSuperAdmin` on themself. An admin editing their own profile keeps their alias ids (`formerUserIds`, `sameEmailUserIds`) and email link, as everyone else already did. Not changed: the self-edit path still matches a person by their sign-in email without requiring a verified email (an unverified sign-up on an invitee's email can edit the pending placeholder); requiring it would refuse the same-email copies a web profile save writes for every unverified account (no app flow verifies invitees' emails) — a follow-up for both apps.
- `&&` does not short-circuit on a false left side that reads document data; expensive branches are gated with a ternary on a cheap condition (`docs/firestore-rules-notes.md` "Expression budget"). Rules tests can assert a logical denial (`tests/rulesAssert.ts`).


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
