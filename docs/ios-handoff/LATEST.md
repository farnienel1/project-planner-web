# iOS follow-on — rulebook 1.15.0

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.14.0 → 1.15.0
Packed hash: 8958960db13c57b7268e396fbebcac180b1aeb839f2fbbdea3672b34153b3e87
Rulebook sha256: a972d243b87678a85857aa44af31ea1948138a032c39d06b0fd98d22bb2d9d0f
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: d655dd7d122e53a1167569216d43cba7598670671310ca84c59ea7e46373b7e6
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: ACCOUNT_DELETE_WITH_COMPANY_MESSAGE, ACCOUNT_HANDOVER_REQUIRED_MESSAGE, DELETION_RESTORE_DAYS, ERASED_ORGANIZATIONS_COLLECTION, MATERIAL_ORDER_NO_RECIPIENT_MESSAGE, MATERIAL_ORDER_SEND_REFUSED_MESSAGE, MATERIAL_ORDER_TYPED_RECIPIENTS_MAX, MATERIAL_ORDER_TYPED_RECIPIENTS_MESSAGE, ORGANIZATION_DELETE_BODY, ORGANIZATION_DELETE_CONFIRMATION, ORGANIZATION_DELETE_SUPER_ADMIN_ONLY_MESSAGE, ORGANIZATION_DELETE_TITLE, ORGANIZATION_RESTORED_MESSAGE, accountDeletionPath, accountTypeWritePermissions, canRestoreOrganization, canSendMaterialOrders, deletionTimeMs, erasedOrganizationAuditFields, isOrganizationSuperAdmin, materialOrderRecipientCheck, organizationDeleteConfirmationError, organizationDeletedMessage, organizationDeletionState, organizationDeletionWriteFields, organizationEraseDateLabel, organizationEraseDue, parseOrganizationDeletion
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.indexes.json, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/materialOrderAccess.ts, lib/canonical/organizationDeletion.ts
Done when:
- [ ] Packed hash in iOS equals 8958960db13c57b7268e396fbebcac180b1aeb839f2fbbdea3672b34153b3e87
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 a972d243b87678a85857aa44af31ea1948138a032c39d06b0fd98d22bb2d9d0f)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.15.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.15.0

- Owner decisions round 6. A user type change keeps every saved toggle (§11): `accountTypePermissions` keeps the stored toggles and changes only the level flags; `accountTypeWritePermissions` takes the screen's values only for toggles the new level can change. Admins still read every toggle on and locked except Annual Leave Management; the stored values return on demotion.
- Material quotes and orders (§16): `canSendMaterialOrders` (admins, super admins outside operative mode, managers); `materialOrderRecipientCheck` (saved wholesaler contacts, the sender's copy, at most 3 typed addresses — `MATERIAL_ORDER_TYPED_RECIPIENTS_MAX`). Enforced by the email function `material_request` and the web send route; `materialSendRecords` stays admins and managers in the rules.
- Company deletion (new §20, §16): `organizationDeletionState`, `organizationDeletionWriteFields`, `DELETION_RESTORE_DAYS` (60), `organizationDeletedMessage`, `canRestoreOrganization`, `organizationDeleteConfirmationError`, `organizationEraseDue`, `erasedOrganizationAuditFields`. Rules lock a scheduled organisation (`orgBillingOpen`) and allow only the super admin's restore; a daily function erases organisations past `eraseAfter`.
- Delete my account (§11): `accountDeletionPath` → `delete` | `handover_required` | `delete_with_company`; web `/api/account/delete` replaces 409 `sole_admin` with a super admin handover and company deletion (restorable only by the platform owner).

## New rulebook sections

- 20. Company deletion (1.15.0)
- 1.15.0 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
