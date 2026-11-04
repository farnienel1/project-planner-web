# iOS follow-on — rulebook 1.31.1

Generated 2026-11-04 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.31.1 → 1.31.1
Packed hash: 735dc074a193e3cb21600f17ae95daaed576cd0bbc526ca01176f42ab1a3957b
Rulebook sha256: b76670c5c05fe15aa70ebb050852abe1c4899e958695ed9b18ac354413ce1ae3
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
- [ ] Packed hash in iOS equals 735dc074a193e3cb21600f17ae95daaed576cd0bbc526ca01176f42ab1a3957b
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 b76670c5c05fe15aa70ebb050852abe1c4899e958695ed9b18ac354413ce1ae3)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.31.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.31.1

- firestore.rules slimmed and restructured so it compiles reliably and every `users/{uid}` and `materials` update is decided by the rules, not by Firestore's 1,000-expression limit. The deploy compile (`firebaserules` `:test`) began returning HTTP 503 as the file grew (180 KB at 1.30.2, 188 KB at 1.31.0); it is now 127 KB (comment blocks moved to `docs/firestore-rules-notes.md`, dead and duplicate functions removed, single-use wrappers inlined).
- **Now take effect as 1.31.0 intended** (§11, owner decision 7): an operatives manager's edits of an operative's users document — names and contact, pay (day / hourly rate, pay basis), active flag, employment type and its dates, line manager, leave fields and the operative toggles — and the legacy by-name material claim (an operative claims a material whose `addedBy` is their email or full name). Before, some of these requests were refused because they ran out of expressions, depending on the documents involved.
- **Refused by the rule logic, not the limit:** an operatives manager changing an operative's role, admin / super admin / manager / Operatives flags, self-manage toggles, `hasNoLineManager`, email, organisation or alias ids (`formerUserIds`, `sameEmailUserIds`); a person changing their own pay, line manager, active flag or privileges; anyone editing another person they do not manage; an owned material reassigned or edited by someone else. 1.31.1 also refuses an operatives manager *adding* `email` or alias ids to an operative that had none (1.31.0's field list only looked at changed keys). It also refuses an admin switching their own Annual Leave Management or Timesheet self-sign off through their own profile (§8, 1.28.0: nobody changes their own; the rules' self-edit path let an admin lower them, and in 1.31.0 such requests were refused only by the expression limit). The Super Admin and the organisation's creator still may.
- `&&` does not short-circuit on a false left side that reads document data; expensive branches are gated with a ternary on a cheap condition (`docs/firestore-rules-notes.md` "Expression budget"). Rules tests can assert a logical denial (`tests/rulesAssert.ts`).


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
