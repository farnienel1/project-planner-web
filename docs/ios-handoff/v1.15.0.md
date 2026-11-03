# iOS follow-on — rulebook 1.15.0

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.15.0 → 1.15.0
Packed hash: 3bd8a1778794034b04da47af4a21454c7446a6a7e3a1505fc01d15ef058c67d3
Rulebook sha256: 5d3c236c485cfb736a043500f5eef29009117af79ce756d55eb97a945f387b00
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: d655dd7d122e53a1167569216d43cba7598670671310ca84c59ea7e46373b7e6
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md
Done when:
- [ ] Packed hash in iOS equals 3bd8a1778794034b04da47af4a21454c7446a6a7e3a1505fc01d15ef058c67d3
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 5d3c236c485cfb736a043500f5eef29009117af79ce756d55eb97a945f387b00)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.15.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.15.0

- Owner decisions round 6. A user type change keeps every saved toggle (§11): `accountTypePermissions` keeps the stored toggles and changes only the level flags; `accountTypeWritePermissions` takes the screen's values only for toggles the new level can change. Admins still read every toggle on and locked except Annual Leave Management; the stored values return on demotion.
- Material quotes and orders (§16): `canSendMaterialOrders` (admins, super admins outside operative mode, managers); `materialOrderRecipientCheck` (saved wholesaler contacts, the sender's copy, at most 3 typed addresses — `MATERIAL_ORDER_TYPED_RECIPIENTS_MAX`). Enforced by the email function `material_request` and the web send route; `materialSendRecords` stays admins and managers in the rules.
- Company deletion (new §20, §16): `organizationDeletionState`, `organizationDeletionWriteFields`, `DELETION_RESTORE_DAYS` (60), `organizationDeletedMessage`, `canRestoreOrganization`, `organizationDeleteConfirmationError`, `organizationEraseDue`, `erasedOrganizationAuditFields`. Rules lock a scheduled organisation (`orgBillingOpen`) and allow only the super admin's restore; a daily function erases organisations past `eraseAfter`, only while `platformConfig/app.organizationErasureEnabled` is true (otherwise a logged dry run).
- Delete my account (§11): `accountDeletionPath` → `delete` | `handover_required` | `delete_with_company`; web `/api/account/delete` replaces 409 `sole_admin` with a super admin handover and company deletion (restorable only by the platform owner).


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
