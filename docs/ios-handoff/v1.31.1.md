# iOS follow-on — rulebook 1.31.1

Generated 2026-11-04 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.31.0 → 1.31.1
Packed hash: 12283f3f090dc458b14d6987dfa911cf9855717f50315f5fc79d658992320232
Rulebook sha256: e3393a92ae54c3ccb5787710db16d7f72b0a14d91c4f65dff42fd3478ce606af
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
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/canonical.test.ts, lib/canonical/userProfile.ts
Done when:
- [ ] Packed hash in iOS equals 12283f3f090dc458b14d6987dfa911cf9855717f50315f5fc79d658992320232
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 e3393a92ae54c3ccb5787710db16d7f72b0a14d91c4f65dff42fd3478ce606af)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.31.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.31.1

- firestore.rules slimmed and restructured so it compiles reliably and every `users/{uid}` and `materials` update is decided by the rules, not by Firestore's 1,000-expression limit. The deploy compile (`firebaserules` `:test`) began returning HTTP 503 as the file grew (180 KB at 1.30.2, 188 KB at 1.31.0); it is now 127 KB (comment blocks moved to `docs/firestore-rules-notes.md`, dead and duplicate functions removed, single-use wrappers inlined).
- **Now take effect as 1.31.0 intended** (§11, owner decision 7): an operatives manager's edits of an operative's users document — names and contact, pay (day / hourly rate, pay basis), active flag, employment type and its dates, line manager, leave fields and the operative toggles — and the legacy by-name material claim (an operative claims a material whose `addedBy` is their email or full name). Before, some of these requests were refused because they ran out of expressions, depending on the documents involved.
- **Refused by the rule logic, not the limit:** an operatives manager changing an operative's role, admin / super admin / manager / Operatives flags, self-manage toggles, `hasNoLineManager`, email, organisation or alias ids (`formerUserIds`, `sameEmailUserIds`); a person changing their own pay, line manager, active flag or privileges; anyone editing another person they do not manage; an owned material reassigned or edited by someone else. 1.31.1 also refuses an operatives manager *adding* `email` or alias ids to an operative that had none (1.31.0's field list only looked at changed keys). It also refuses an admin switching their own Annual Leave Management or Timesheet self-sign off through their own profile (§8, 1.28.0: nobody changes their own; the rules' self-edit path let an admin lower them, and in 1.31.0 such requests were refused only by the expression limit). The Super Admin and the organisation's creator still may.
- **Security (second review):** a privilege flag (`isSuperAdmin`, `adminAccess`, `manager`, `operatives`, `annualLeaveSelfBook`, `timesheetSelfSign`) counts as on when it is on in **either** place — the top level or `permissions.{key}` — in every rule that stops a privilege being gained (`privilegeFlag`, `noPrivilegeFlags`), the way `adminLikeUser` already granted admin from either place. Before 1.31.1 an operatives manager could write `permissions.adminAccess: true` onto an operative whose stored top-level `adminAccess` was false (the operative-edit check read the top level first), and an operatives manager could **create** an operative with `permissions.adminAccess` or `manager` / `operatives` set (the create check read only the top-level `adminAccess` and `isSuperAdmin`) — the second was open on the deployed rules. Both are refused, as is a person setting `permissions.isSuperAdmin` on themself. An admin editing their own profile keeps their alias ids (`formerUserIds`, `sameEmailUserIds`) and email link, as everyone else already did. Not changed: the self-edit path still matches a person by their sign-in email without requiring a verified email (an unverified sign-up on an invitee's email can edit the pending placeholder); requiring it would refuse the same-email copies a web profile save writes for every unverified account (no app flow verifies invitees' emails). **Superseded by F5 below** (owner decision 4 Nov: fixed in this release with invitation proof instead of `email_verified`).
- **Security (third review, §16):** (B1) only the organisation's Super Admin creates a users document with `isSuperAdmin` (top level or `permissions`); another admin's create of one is refused. (B2) an operatives manager acts only on a real operative — `managerMayManageOperative` reads the target (the operative level, no admin / Super Admin / manager / Operatives flag in either place, no admin or manager role) for the users update, delete, membership delete, email-claim delete, `operativeDayRateHistory`, `payProfiles` and `operativeProfiles`, and refuses acting on themself. (S1) re-creating your own profile (self-create, re-join, bootstrap) never sets your own pay (`dayRate`, `hourlyRate`, `payBasis`), employment type and its dates, line manager ids or `hasNoLineManager`, unless `members` lists you as admin; listed as an operative you re-create at the operative level only. (S3) an operatives manager creates only a plain operative (no privilege flag, no alias ids, no `hasNoLineManager`, an email with no live claim in the organisation) and writes an email claim only to an operative they manage, replacing only a claim that is empty, names no users document, or names an operative they manage. (S4) an `operatives` row's account link (`userId`, `linkedUserId`, `uid`) is changed only by an admin, or by an operatives manager to an operative they manage; a `managers` row's link by an admin only. Not changed: self-delete of your own users document (the apps delete accounts through `/api/account/delete`; four tests and the account-deletion flow rely on it — owner to decide); `orgRootCallerIsSuperAdmin` keeps reading the stored flag the way the other grant readers do (reading it in either place would widen a grant).
- **Security (F5, owner decision 4 Nov — fixed now, §11, §16):** accepting an invitation needs proof of the emailed invitation, not only its email. The new `users/{authUid}` that copies a pending placeholder carries the invitation's secret `invitationId` (new field in `USER_DOCUMENT_FIELDS`) and the invitation (for that email and organisation, not used) is marked used in the same batch (`inviteBeingAccepted` via `getAfter`); web `completeInviteSetup` writes both in one batch. The later accept steps — taking the email claim from the placeholder, updating or deleting a pending placeholder (`passwordSet` not true) by email, reading or removing its tax ids, copying its invited pay — need the caller's own account created that way in the placeholder's organisation (it lists the placeholder in `formerUserIds`). The invitee marks an invitation used only with the account or membership written with its id. Before 1.31.1 anyone signed in with an invitee's email (an unverified sign-up was enough) could copy the placeholder, take the claim and act at the invited level. No `email_verified` requirement, so web same-email profile sync is unchanged. iOS has no accept flow of its own (it sends invitees to the web link) and needs no change. Organisation updates by someone with no tie to the organisation, an invitation's own mark-used and own-email claims are now refused by the rule logic, not the expression limit.
- **Security (fourth review, §11, §16):** (B-1) an operatives manager lists, deletes and changes only the invitations they sent (`invitedBy` is them; their queries name it) and creates only an operative invitation in their own name for an email no one else holds (`opsManagerEmailFree`), so they can no longer read an admin invitation's secret id or mint an operative invitation for an admin invitee's email. Accepting an invitation never copies a placeholder above the invitation's level: an operative invitation copies no admin, Super Admin, manager or Operatives flag and no admin / manager role; a manager invitation no admin or Super Admin; nobody accepts a Super Admin (`selfCreateWithinInvitationLevel`). A membership from an invitation takes exactly its role and permissions (unchanged, now judged first).
- **Invite accept writes the membership with the account (fourth review S-1, §11):** web `completeInviteSetup` writes `users/{authUid}/orgMemberships/{orgId}` in the accept batch in the `inviteMembershipWrites` shape. Before, a non-admin invitee's separate membership write was refused after the account was created ("Missing or insufficient permissions"), and a retry then found the invitation used. A later fallback write never stops the setup.
- `&&` does not short-circuit on a false left side that reads document data; expensive branches are gated with a ternary on a cheap condition (`docs/firestore-rules-notes.md` "Expression budget"). Rules tests can assert a logical denial (`tests/rulesAssert.ts`).

## New rulebook sections

- 1.31.1 — 2026-11-04

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
