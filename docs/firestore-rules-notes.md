# firestore.rules notes

Why `firestore.rules` is written the way it is. Rulebook 1.31.1 moved these notes out of the rules file: the deploy compile (`firebaserules.googleapis.com …:test`) began failing with HTTP 503 as the file grew past 180 KB, and comments were 31% of its bytes. The rules themselves are in `firestore.rules`; the rules they enforce are `docs/RULEBOOK.md` (§16 and the sections it names).

Each note sits under the rule it described, in file order, with the match path it was in. Where 1.31.1 merged, inlined or removed a function, the heading says so. Rulebook versions in the notes (1.10.0, 1.13.0 …) are when that rule was added.

When you add a rule, keep the explanation here (or in `docs/RULEBOOK.md`), not as a comment block in `firestore.rules`.

## Static type check (1.31.2)

The Firebase console and the deploy compile run a static type checker that is stricter than the emulator's evaluator. It infers types through function parameters, so passing a literal `null` (or a ternary with a `null` branch, such as `resource == null ? null : resource.data`) to a function that uses that parameter as a map, list, string, number or timestamp is an error, even when the function guards it with `prev == null ? …`. Branch on `resource == null` at the call site (or inside the function on the global `resource`) and never pass a literal `null`.

Check offline before publishing: start the Firestore emulator and `PUT` the file to `http://127.0.0.1:<port>/emulator/v1/projects/<any>:securityRules` with body `{"rules":{"files":[{"name":"firestore.rules","content":…}]}}`. The response lists the same type issues the console reports (as `WARNING`s; the emulator still loads the rules). An empty `{}` means the checker is clean. For `storage.rules`, `StorageRulesRuntime.loadRuleset` in firebase-tools (`lib/emulator/storage/rules/runtime.js`) returns the same issues as `warnings`.

## Expression budget (1.31.1)

Firestore evaluates at most 1,000 expressions per request. A request that reaches the limit is denied with "maximum of 1000 expressions", whatever the rule would have decided, so a denial can flip to allowed when unrelated rules get cheaper.

- **`&&` does not stop at a false left side that reads document data.** On the emulator, `resource.data.x == 'v' && f()` and `request.resource.data.x == 'v' && f()` evaluate `f()` even when the left side is false (rules are also checked against queries, where document values are unknown). A left side on literals, `request.auth` or a function call does stop. `cond ? f() : false` always stops. Gate an expensive branch with a ternary on a cheap condition that cannot error.
- **A gate must be necessary, not just likely.** `g ? X : false` is the same decision as `X` only when `X` cannot be true unless `g` is, and `g` never errors (use `.get(key, default)` and `is string`). Turning `A && B && C` into `A ? (B ? C : false) : false` is the same decision except under `!`, `==` or `!=`; check that the function's result is never negated or compared before converting it.
- **`users/{userId}` update** (1.31.1): one `userUpdateAllowed()` with three gated branches — self (`userUpdateIsSelf`: same uid, or the verified email on both the stored and the written document), operatives manager (`operativesManagerFlags` on the caller's own users document, a different person), admin (the caller's users document is admin-like or `members` lists them as admin; `userAdminUpdateAllowed`). Each branch checks a field only when it changed (`changed.hasAny(K) ? check : true`). For an admin, the self branch requires `selfManageTogglesUnchanged` (computed once per request, only when the stored document is an admin); for everyone else `selfPermissionsNotRaised` already refuses raising a toggle. `let` bindings are evaluated eagerly, so a value that only one branch needs is computed inside that branch, not as a `let` of the rule. The operatives-manager branch refuses privilege and identity keys first, added, changed or removed (`role`, `adminAccess`, `isSuperAdmin`, `manager`, `operatives`, `annualLeaveSelfBook`, `timesheetSelfSign`, `email`, `organizationId`, `formerUserIds`, `sameEmailUserIds`), then applies the 1.31.0 field list (which reads `changedKeys()`, so a new harmless field such as `phone` passes, as in 1.31.0).
- **One privilege reader (1.31.1, second review):** every rule that stops a privilege being gained reads a flag as on when it is on in either place (`privilegeFlag(d, key)`; `noPrivilegeFlags(d)` = none of the six privilege and self-manage flags and no admin / manager role), on the document being written and, where it compares, on the stored one. Rules that *grant* power keep their reader (`adminLikeUser`, `staffFlag`), so writing a flag in one place can never give more than the deny side allows. A denial costs more than an allow of the same expression on the emulator (the denied path evaluates more), so every branch that ends in a denial needs its own cheap gate; the users create rule gates its admin branch on `adminLikeUser(callerHomeData())` or `members` admin, and its self-create branches on `request.auth.uid == userId`.
- **Helpers added in 1.31.1:** `operativeTarget` is `managerMayManageOperative`'s test that the target is an operative; `plainOperative(d)` is `isOperativeProfile(d) && !raisesPrivileges(d)` with both self-manage toggles off, each flag read once the way `staffFlag` reads it; `selfManageFlagsEqual` is the toggle comparison of `selfManageTogglesUnchanged`. `flagOn` was removed (its callers test the key inline).
- **`materials` update** (1.31.1): `materialUpdateAllowed()` gates the Send status write on its key list, the owner edit on the stored `addedByUserId` being the caller, and the legacy claim on the write changing only `addedByUserId` to the caller.
- **Invite accept needs the emailed invitation (1.31.1, F5):** the placeholder copy in `selfCreateJoinsCompany` requires `inviteBeingAccepted` on the new document's `invitationId` (the secret invitation for that email and organisation, unused, `isUsed` true in the same batch via `getAfter`). Every later step (`isOwnEmailClaimWrite` take-over, the users update and delete by email of a pending placeholder, the placeholder's tax ids, `inviteeCopiesOwnInvitedPay`) requires `callerAcceptedPlaceholder(id, org)`: the caller's own users document lists the placeholder in `formerUserIds` and is in the placeholder's organisation (only the proven create writes that list there). The invitee's own mark-used update passes only with `invitationAcceptWrittenWith` (the account or the membership written with that invitation's id). Three cheap gates keep the refusals logical: the invitation update by its addressee changing only `isUsed` / `usedAt` is judged on the proof alone; a claim of the caller's own email to the caller is judged on `isOwnEmailClaimWrite`, platform owner or admin; the organisation root update is judged only for a caller tied to it (`orgRootCallerTied`: a users document, the creator, a `members` entry, or a membership the write creates); invitation create, delete, list and administrator updates only for a caller with a users document or listed as admin (`invitationCallerKnown`); and an operatives manager's email-claim delete is gated on their flags.
- **`operatives` row create / update (1.31.1, S4):** the account-link gate (`rosterRowLinkChanged`) comes first; an operatives manager's link target is checked with the lean `rosterRowLinkTargetOk` (the target users document is in this organisation, not the caller, and `manageableOperative`), and on create the membership test is `isPlatformOwner() || isOrgManagerOrAdmin(org)` alone (it implies `canAccessOrganization`; both read the billing state), so a create by an operatives manager stays within the budget. The pay / email test is one gated check.
- **Fourth review (1.31.1):** the users create rule's alternatives are named functions joined by ternaries (`userCreateSelfJoin`, `userCreateByAdmin`, `userCreateBootstrap`), so an allowed accept stops evaluating at its branch; `noMorePrivilegeThan` reads each flag with `in [true, 1]` instead of `privilegeFlag` (same decision, fewer expressions). Invitations: an operatives manager (operatives flags, not admin-like, not listed as admin) is judged only on `invitationOpsManagerWrite`; everyone else on `invitationAdmin`. A membership carrying `invitationId` on create by its owner is judged only on `membershipFromInvitation`.
- **Typed privilege values (1.31.1, fifth review):** `privilegeCreateTyped` (creates) and `privilegeWriteTyped` (updates; only when a privilege key, `permissions` or `role` is affected) refuse a written non-bool flag or an unknown role; untouched stored values pass (`privilegeKeysTyped` compares the set of written values with the stored ones plus `true`, `false`, `null`). `membersValuesTyped` does the same for `members`. On a users update the check runs only after the self or operatives-manager branch has passed, so a refusal stays logical and an admin's type change keeps its budget; the self branch's admin and Super Admin checks refuse any value but `false` / null. The invite-accept copy (`selfCreateCopiesPlaceholder`) compares with the placeholder through one diff (no changed or added privilege, role, line-manager or pay key) instead of `noMorePrivilegeThan`, which is gone. `payStaysPrivate` reads the private-pay switch first. (A fast path in `orgIdsMatch` / `userDocOrganizationMatches` was tried and removed: it raised the leave-decision guardrail counts.)
- **Tests:** `tests/rulesAssert.ts` `assertLogicalDeny` fails a test whose denial came from the limit; `RULES_STRICT_BUDGET=1 npm run test:rules` makes every suite's `assertFails` strict. In 1.31.1, 49 of the 203 firestore tests (74 at the third review's head `42c69a91`) still contain at least one budget denial (108 on 1.31.0: bookings, invitations, self-create, leave, timesheets, notifications and more); they are a follow-up.
- **Measuring:** pad the `allow` with N copies of a cheap comparison (a balanced `&&` tree; a flat chain of about 600 terms is refused at compile time as "Expression is too complex to evaluate safely") and find the largest N that still evaluates; each copy is about 7 expressions.

## After publishing: check what is really live (6 Nov)

The console's "unknown error" and the CLI's 409 / 503 are not proof that a publish failed. On 6 Nov the console said "Error saving rules – An unknown error occurred", but Google had already saved the ruleset (`ce5ba57d…`, 12:11:56) and pointed the `cloud.firestore` release at it (12:12:05). Earlier "failed" attempts may also have gone live. After every publish, whatever the console says:

1. `GET https://firebaserules.googleapis.com/v1/projects/project-planner-f986c/releases/cloud.firestore` and note `rulesetName` and `updateTime`. The owner can do this on the API Explorer page `projects.releases/get`; a session can do it with a one-hour OAuth token (scope `https://www.googleapis.com/auth/firebase`) saved as a network secret for `firebaserules.googleapis.com`.
2. `GET …/v1/{rulesetName}` and compare `source.files[0].content` with `firestore.rules` on `main`, byte for byte.
3. If they differ and a newer uploaded ruleset matches `main` (`GET …/v1/projects/project-planner-f986c/rulesets`), point the release at it with `PATCH …/releases/cloud.firestore` and body `{"release":{"name":"projects/project-planner-f986c/releases/cloud.firestore","rulesetName":"<that ruleset>"}}`. This does not compile again. Note the previous `rulesetName` first, so the change can be rolled back.
4. Do not press Publish again just because of the error message. Every press uploads another copy.

## Compile cost (1.31.3)

Google's rules compiler gave up on 1.31.0–1.31.2 (CLI `firebaserules …:test` 503, console "unknown error"). Its cost tracks the fully inlined size of every allow condition and every function body (the type checker re-resolves a function body at each call site), not the file size. Tools, measurements and method: `docs/rules-cost/README.md` and `scripts/rules-cost/`. Before asking the owner to publish a rules change:

1. `python3 -c "import sys;sys.path.insert(0,'scripts/rules-cost');import metric;print(metric.total2('firestore.rules')[2])"` must stay clearly below live 1.30.2's 525,898 (1.31.3: 431,665).
2. The emulator type check (`scripts/rules-cost/ctime.py`, PUT `:securityRules`) must report 0 errors.
3. `RULES_STRICT_BUDGET=1 npm run test:rules` must list no new 1,000-expression refusals. A change that cuts compile cost can raise the per-request count: 1.31.3 dropped a merge of the job-manager checks because it added 19.

1.31.3 changes (no allow/deny change; suites 220/220):
- bookings, managerSiteBookings and subcontractorBookings: create, update and delete are one allow per collection that calls `bookingWriteAllowed(collection, request.method)` once; `bookingWriteAllowed` checks the manager's job twice instead of three times.
- `jobListsCaller` builds its pattern once; `canAccessOrganization`, `isOrgCreatorViaParentGet`, `userDocOrganizationMatches`, `userOrgIdMatchesPath`, `callerHomeData` and `isOrganizationAdminAnyBilling` (now `homeIsActiveAdminOf`) read each document path once.
- 79 helpers that had no `let` and one or two callers were written out inside their callers (`scripts/rules-cost/inline.py`). Their names no longer exist in `firestore.rules`; the notes below keep their headings. Where each went:

| Helper (1.31.2) | Now written out inside |
|---|---|
| `actorUserIdValid` | allow create in `/notifications/{notificationId}`, allow update in `/notifications/{notificationId}` |
| `belongsToOrganization` | allow read in `/materialSendRecords/{recordId}`, `canAccessOrganization` |
| `canChangePayOfSubject` | allow create in `/payProfiles/{subjectId}`, allow update in `/payProfiles/{subjectId}` |
| `canClaimLegacyOwnMaterial` | `materialUpdateAllowed` |
| `canCreateOwnMaterial` | allow create in `/materials/{materialId}` |
| `canDeleteOwnMaterial` | allow delete in `/materials/{materialId}` |
| `canDeleteTimesheetSettings` | allow delete in `/settings/{settingId}` |
| `canManagerUpdateOperativeProfile` | `userUpdateAllowed` |
| `canReadTimesheetSettings` | allow read in `/settings/{settingId}` |
| `canReadUserDocument` | allow get in `/users/{userId}`, allow list in `/users/{userId}` |
| `canUpdateOwnMaterial` | `materialUpdateAllowed` |
| `canViewPayOf` | allow get in `/payProfiles/{subjectId}` |
| `canViewPayOfRow` | `canViewPayOfAsMember` |
| `canWriteMaterialSendRecord` | allow create in `/materialSendRecords/{recordId}`, `isStaffMaterialStatusWrite` |
| `canWriteTimesheetSettings` | allow create,update in `/settings/{settingId}` |
| `defaultOnPermissionsOff` | `selfPermissionsNotRaised` |
| `deletionUnchanged` | allow update in `/organizations/{organizationId}`, `orgRootRemovesOneOperativeMember` |
| `hbCaller` | `hbCallerIsOperative` |
| `hbCanDecideBeforeAndAfter` | allow update in `/holidayBookings/{bookingId}` |
| `hbDatesUnchanged` | `hbOwnerEditAllowed` |
| `hbDecisionUnchanged` | `hbOwnerEditAllowed` |
| `hbIsStaffManager` | allow create in `/holidayBookings/{bookingId}` |
| `hbOwnerUpdateAllowed` | allow update in `/holidayBookings/{bookingId}` |
| `idListOrMissing` | `selfCreateAliasesWithin` |
| `invitationAdmin` | `canAdministerInvitation` |
| `invitationOperativesManager` | `canAdministerInvitation` |
| `invitedPayCopyFields` | `copiesInvitedPay` |
| `inviteeOfPlaceholder` | allow delete in `/private/{privateDocId}`, allow read in `/private/{privateDocId}` |
| `isMemberWritableSettingsDoc` | allow create,update in `/settings/{settingId}`, allow delete in `/settings/{settingId}` |
| `isOnlyClaimingLegacyOwnMaterial` | `materialUpdateAllowed` |
| `isOrgAdminViaMembersMapAnyBilling` | `hbIsAdmin`, `isOrgAdminViaMembersMap` |
| `isOrgBootstrapAdminProfileCreate` | allow create in `/users/{userId}` |
| `isOrgMemberViaParentGet` | allow read in `/materialSendRecords/{recordId}`, `canAccessOrganization`, `selfCreateJoinsCompany` |
| `isOrgNonOperativeMember` | allow create in `/materialSendRecords/{recordId}`, `isStaffMaterialStatusWrite` |
| `isOwnEmailClaimWrite` | allow create,update in `/userEmails/{emailKey}` |
| `isOwnNotification` | allow read in `/notifications/{notificationId}`, allow update in `/notifications/{notificationId}` |
| `isOwnTimesheetSettings` | allow read in `/settings/{settingId}`, `timesheetCallerIsSubject` |
| `isTimesheetReviewer` | allow read in `/settings/{settingId}` |
| `isVariationSettingsDoc` | allow read in `/settings/{settingId}` |
| `legacyMaterialAddedByMatchesCurrentUser` | allow delete in `/materials/{materialId}`, `materialUpdateAllowed` |
| `lockedPermissionFalseMap` | `selfPermissionsNotRaised` |
| `lockedPermissionsOn` | `selfPermissionsNotRaised` |
| `managerCanCreateOperativeUser` | allow create in `/users/{userId}` |
| `managerMayRecordRateRow` | `canWriteRateRow` |
| `materialManagerLikeUser` | `callerOrgRoleAnyBilling` |
| `membershipSelfWriteAllowed` | allow create,update in `/orgMemberships/{membershipOrgId}` |
| `operativeProfileStampOnly` | allow create,update in `/operativeProfiles/{userId}` |
| `operativeRowBaseAllowed` | allow create,update in `/operatives/{operativeId}` |
| `operativeRowGuardedWrite` | allow create,update in `/operatives/{operativeId}` |
| `operativeRowIsCaller` | allow create,update in `/operatives/{operativeId}` |
| `operativeTarget` | `manageableOperative` |
| `operativesManagerFlags` | `managerMayManageOperative`, `userUpdateAllowed` |
| `operativesManagerForOtherRow` | allow create,update in `/operatives/{operativeId}` |
| `orgRootCallerIsSuperAdmin` | allow update in `/organizations/{organizationId}`, `orgRootSuperAdminRestore` |
| `orgScheduledForErasure` | allow update in `/organizations/{organizationId}`, `orgRootSuperAdminRestore` |
| `organizationExists` | allow create in `/users/{userId}`, `userUpdateAllowed` |
| `overtimeTextFieldValid` | `overtimeLineManagerBookingUpdate` |
| `payProfileKeysValid` | allow create in `/payProfiles/{subjectId}`, allow update in `/payProfiles/{subjectId}` |
| `payeClaimCommonValid` | `expenseItemValid`, `priceWorkItemValid` |
| `permissionValue` | `staffFlag` |
| `privilegeWriteTypedChanged` | `privilegeWriteTyped` |
| `rosterRowEmailChanged` | allow create,update in `/managers/{managerId}`, allow create,update in `/operatives/{operativeId}` |
| `rosterRowLinksManageable` | allow create,update in `/operatives/{operativeId}` |
| `rosterRowPayKeysChanged` | allow create,update in `/managers/{managerId}`, allow create,update in `/operatives/{operativeId}` |
| `selfCreateSelfManageOff` | allow create in `/users/{userId}`, `selfCreateJoinsCompany` |
| `selfKeepsStoredFlags` | `selfUpdateKeepsManagedFields` |
| `selfSuperAdminKept` | `userUpdateAllowed` |
| `timesheetManagerFieldsUnchanged` | allow create,update in `/settings/{settingId}` |
| `timesheetOwnerLeavesList` | `timesheetOwnerReviewFieldsUnchanged` |
| `timesheetSelfSignsUid` | `timesheetSelfSignedOwnerWrite` |
| `timesheetStoredManagerSigned` | `timesheetOwnerReviewFieldsUnchanged` |
| `timesheetSubjectIsCaller` | allow delete in `/settings/{settingId}`, `timesheetCallerIsSubject` |
| `userAdminUpdateAllowed` | `userUpdateAllowed` |
| `userCreateBootstrap` | allow create in `/users/{userId}` |
| `userCreateByAdmin` | allow create in `/users/{userId}` |
| `userCreateSelfJoin` | allow create in `/users/{userId}` |
| `userSelfUnmasksSuperAdmin` | `userUpdateAllowed` |
| `userSelfUpdateKeepsPrivileges` | `userUpdateAllowed` |
| `userUpdateKeepsOrganization` | `userUpdateAllowed` |

### 1.32.2 — second cut (6 Nov)

Google refused to publish 1.32.1 (static cost 429,072; console "unknown error", CLI 409 then 503) although 1.31.3 (431,665) had published, so the margin was gone. 1.32.2 cuts the static cost to **383,790** (−10.6%; 1.30.2 live 525,898) with no allow/deny change. CI now fails above **395,000** (`scripts/check-rules-budget.mjs`, `firestoreRulesMaxCompileCost` in `scripts/rules-budget.json`) and on any type-check error (`scripts/check-rules-typecheck.mjs`, job `rules-typecheck` in `web-ci.yml`).

`let` bindings are lazy for errors (1.32.3: but not for the expression budget, see below) (checked on the emulator: an unused `let x = request.auth.uid` does not fail an unauthenticated request, and a `let` is evaluated only where it is used), so moving a pure expression into a `let` never changes a result. What changed:

- **Repeated document paths** inside one function are one `let hpN = /databases/…;` (`hoist`: 16 functions, e.g. `selfCreateJoinsCompany`, `callerManagesJobAt`, `hbIsAdmin`, `materialUpdateAllowed`). A path that uses one of the function's own `let`s is left alone; `callerListedRole` and `isManagerWithOperativesAccess` were rewritten the same way by hand.
- **`userDocOrganizationMatches`** computes the `orgIdsMatch` test once (`let w = v is path ? v[4] : v`, `let m = …` with `o` = `organizationId.lower()`), instead of calling `orgIdsMatch` in both the string and the path branch. `orgIdsMatch` stays for its other callers.
- **`canAccessOrganization`** reads the caller's users document once (`let home`) and calls `userDocOrganizationMatches(home, …)` directly (it was `userOrgIdMatchesPath`, whose `request.auth != null` is already checked there), and tests the organisation's `members` entry and `creatorUserId` under one `exists(orgPath)`: `(E && M) || (E && C)` = `E && (M || C)` (E is `exists`, which never errors).
- **`membersMapAdminAnyBilling`** is gone: `orgAdminEither` (its only caller) does the members-map test itself, sharing `let home` with `homeIsActiveAdminOf` and checking `request.auth != null` once.
- **`callerOrgRoleAnyBilling`**: the second `adminLikeUser(home)` (in the manager test) is removed; it is only reached when the first one was false.
- **`adminLikeUser`**: `'k' in d && truthyBool(d.k)` is `truthyBool(d.get('k', false))` and `'role' in d && d.role == 'admin'` is `d.get('role', '') == 'admin'` (same value for a missing key, same error for a non-map).
- **Allows with the same condition** are one allow: clients, tasks, subcontractors and siteAudits `allow read, create, update: if canAccessOrganization(organizationId);`.
- **Write allows that all start with `canAccessOrganization(organizationId) &&`** are one allow with a `request.method` ternary, as the booking allows in 1.31.3: holidayBookings (create / update / delete), settings (create, update / delete), notifications (create / update), overtimeRequests (create / update). Reads are never merged with a method test (list queries are checked against the query).

Checked: suites 223/223 (as 1.32.1); `RULES_STRICT_BUDGET=1` the same 43 limit refusals as 1.32.1, none new; emulator type check 0 issues; in-process compile (emulator 1.22.0, min of 7) 1.66 s against 1.79 s for 1.32.1.

### 1.32.3 — third cut (6 Nov)

The 1.33 rules changes (overtime Return flow, line managers approving under every id, booking deletes via overtime, line-manager booking reads; about +5,000 together) did not fit under the 395,000 gate on top of 1.32.2. 1.32.3 cuts the static cost from 383,790 to **367,346** (−16,444, −4.3%) and `firestore.rules` from 142,995 to 142,906 bytes, with no allow/deny change.

**Correction to 1.32.2: `let` bindings and function arguments are evaluated eagerly for the 1,000-expression budget.** Checked on the emulator (1.22.0): a function with two unused `let`s of about 450 expressions each is refused by the limit, and so is a call that passes the same two expressions as unused arguments, while one used `let` of the same size is allowed. An error inside a `let` or an argument is kept as a value and only matters where it is used (an unused `let x = get(<missing doc>).data.a` does not deny), so moving an expression into a `let` never changes a result, but it is not free: the `let` is evaluated whenever the function runs. A trial for 1.32.3 that moved helpers' `let`s into their callers failed three suites with new limit refusals (the Super Admin's admin-to-manager change) and was dropped. Only these are budget-neutral: writing out a helper that has **no** `let` where each parameter is an identifier, a literal, or used once (what `scripts/rules-cost/inline.py` does), and merging allows.

What changed:

- **Invitations**: `allow list, delete`, `allow create` and `allow update` are one `allow list, create, update, delete` with `request.method` tests, so `canAdministerInvitation` and `invitationCallerKnown` appear once. Per method it is the same condition: for `update` the invitee's accept test comes first as before (`request.method == 'update' && …`, which short-circuits for the other methods); then `invitationCallerKnown() && (request.method != 'update' || invitationUpdateKeepsIdentity())` as the ternary's test (for `list`, `create` and `delete` this is `invitationCallerKnown()`), and `canAdministerInvitation() && (create ? privilegeCreateTyped(…) : (update ? privilegeWriteTyped(…) : true))`. `A ? B : false` and `A && B` deny the same requests (an error in `A` denies either way). `allow get: if true` is untouched (reads are not merged with a method test).
- Nine helpers without a `let` are written out where they were called (`inline.py`'s rules: free variables checked, parameters only substituted when they are an identifier or literal or used once). Their names no longer exist in `firestore.rules`; the headings below keep them.

| Helper (1.32.2) | Now written out inside |
|---|---|
| `canAdministerInvitation` | allow list, create, update, delete in `/invitations/{invitationId}` |
| `invitationCallerKnown` | the same allow |
| `legacyMemberRead` | `jobGetAllowed`, `jobListAllowed`, `jobDocReadable` |
| `isOrganizationAdminAnyBilling` | `isOrganizationAdmin`, `hbIsAdmin`, allow update in `/organizations/{organizationId}` |
| `hbRequesterUid` | `hbRequesterExists`, `hbRequester`, `hbIsOwner` |
| `isTimesheetSettingsDoc` | allow read and allow create, update, delete in `/settings/{settingId}` |
| `canChangePayOf` | allow create and allow update in `/payProfiles/{subjectId}`; allow create, update and allow delete in `/operativeProfiles/{userId}` |
| `hbCallerSelfBooks` | `hbOwnerShapeAllowed`, `hbOwnerEditAllowed`, allow create, update, delete in `/holidayBookings/{bookingId}` |
| `rosterRowAdmin` | allow create, update in `/operatives/{operativeId}` and in `/managers/{managerId}` |

Checked: suites 223/223 (each run on a fresh emulator; `tests/firestore.rules.test.ts` does not clear data between runs, so a reused emulator gives false failures); `RULES_STRICT_BUDGET=1` the same 43 limit refusals as 1.32.2 (same test names), none new; emulator type check 0 issues.

### 1.32.4 claims (6 Nov)

The caller's own role and company facts come from the Auth custom claim `pp` (design: `docs/rules-claims-design.md`; rule: `lib/canonical/authClaims.ts` `authClaimsForPerson`; set by `functions/authClaims.js`). Static cost 367,346 → **234,347** (−36%); `firestore.rules` 142,906 → 137,867 bytes; inlined document lookups (`metric.py` `inlined_gets`) 2,862 → 1,364; lookup call sites in the source 179 → 148; in-process compile (emulator 1.22.0, `Compile.java`, min of 7) 1.29 s → 1.07 s. CI budgets lowered to 245,000 and 140,288 bytes (`scripts/rules-budget.json`).

New helpers (no `let`, no lookup): `callerOrg(org)` = `request.auth.token.get('pp', {}).get('o', {}).get(org.lower(), ['', ''])` (role, listed role, flags), `callerHomeFlags()` = `pp.u`, `callerHomeOrgRaw()` = `pp.r`, else `pp.h` (the value `orgIdsMatch` used to read from the users document). Missing claims give the defaults, so every role-decided test is false (refused), never an error that a later `||` could pass.

Helpers whose bodies now read the claims (names kept for the 1.33 call sites): `canAccessOrganization` (`c` + billing + platform owner), `callerOrgRoleAnyBilling` (`[0]`), `callerOrgRole` (unchanged: billing, then the claim), `callerListedRole` (`[1]`), `orgAdminEither` (`E` + billing), `isOrganizationAdmin` (`H` + billing), `userOrgIdMatchesPath` (`h`), `callerHomeIsOperative` / `hbCallerIsOperative` (`o` and not `a`), `callerIsSuperAdminOf` (`S`), `callerJobToggle` (`P` / `W`), `hbIsAdmin` (`E`), `anchoredInCallerCompany` (`pp.h`, `i`; the organisation's `members` / creator lookup stays), `overtimeCallerIsStaffHere`, `orgRootOperativesManagerRemovesMember` / `operativesManagerRemovesOrphanBooking` (`q` + `h`), `adminDeletesUser`, `userUpdateCallerAdmin`, the users create / update / delete gates (`a`, `x`, `k`), the invitations gate (`x`, `i`, `a`), the organisation update (`H`, `s`), `isStaffMaterialStatusWrite` and `materialSendRecords` (`p`, `c`, `x`), `managerMayRecordOperativeRow`, and the annual-leave self-book tests (`B`). Removed: `callerMembershipDeactivated`, `callerHomeInactiveIn`, `homeIsActiveAdminOf`.

Lookups kept on purpose:
- **Claims cannot exist yet:** `selfCreateJoinsCompany` (the `members` entry is read from the organisation it already gets), users create paths 1 and 3, `orgRootCallerTied`, `orgRootInviteJoin`, `membershipFromInvitation`, the membership self-write `role` check (now the `members` entry read inline), `isOrgCreatorViaParentGet` there, `inviteeCopiesOwnInvitedPay`, `callerAcceptedPlaceholder`, and the organisation `get` (`userDocOrganizationMatches(callerHomeData(), …)`: an invitee reads the organisation right after the accept batch, before the function has run).
- **Identity, not role:** `callerOwnsBookingId`, `timesheetIdIsCallerAlias`, `claimReviewSubjectIsCaller`, `timesheetReviewerOfOthers` (former ids), material `addedBy` names.
- **Other documents:** `orgBillingOpen` (billing, deletion), job managers (`jobListsCaller`), line managers, subjects, placeholders, `orgCreatorIs` for other people and `orgSelfManageFlag` for a timesheet subject.
- **Emulator crash workaround: `isManagerWithOperativesAccess` and `managerMayManageOperative` keep their 1.32.3 bodies** (they read the caller's users document). With claim-only bodies the Firestore emulator (1.22.0) crashed inside the rules engine on some operatives-manager writes (`IllegalStateException: ternary operator predicate is always boolean` in `StackMachine.evaluateTernary`, from `AsyncTwoPhaseRulesAuthorizer`; the write never answers and the document stays locked, so every later write to it times out with "Transaction lock timeout"). Reduced: a ternary (or `&&` chain) whose test reads no document, whose branch calls a function with `let`s over a document fetched with `get()` (`manageableOperative(get(…).data)`), e.g. the `userEmails` delete and `users/{uid}/private/taxIds` delete by an operatives manager. It depends on what was evaluated earlier in the same emulator, so a single test can pass alone and crash in its suite. Keeping a document read in those tests (as 1.32.3 did) avoids it; every suite runs without it now (0 occurrences in the emulator log). Whether Google's production engine shares the bug is unknown: check after publishing that operatives-manager writes (operative profile edit, pay, delete) still answer.
- An attempt to merge `callerManagesJob` and `callerManagesJobIn` (−8,300 cost) was dropped: it triggered the same crash on booking deletes.

Not done, and why the cost is above the 180,000 the brief aimed for: `orgBillingOpen` (≈32,000 with its 207 inlined copies) and the job-manager lookups (`jobListsCaller` and its callers, ≈33,000) are other documents' data, which the brief says to leave. Moving billing and deletion state into the claims would remove most of the first (with up to an hour's delay when a subscription lapses or is paid); that is an owner decision.

Tests: every signed-in context in the three suites is built with the claims of the data the test seeded (`tests/authClaimsContext.ts`, read over the emulator's REST API with rules off); where a test changes the caller's own role or company mid-test it takes a fresh context, as the app does after the marker (1.28.0 self-book, 1.11.0 invite accept, 1.12.0 H4 founder). New: claims missing, another company's claims, deactivated, the stale-token window, the marker's access, a malformed `pp`. Suites 183 + 26 + 16 = 225/225 (each on a fresh emulator); `RULES_STRICT_BUDGET=1`: 20 tests with a limit refusal, all among 1.32.3's 43, none new; emulator type check 0 issues.
### 1.33.0 — the 1.33 rules (6 Nov)

Merged onto 1.32.4 (custom claims). Static compile cost **232,589** (1.32.4: 234,347; −1,758; before the claims, on 1.32.3, the same 1.33 changes measured 365,019 against 367,346), 141,866 bytes (1.32.4: 137,867; `firestoreRulesMaxBytes` raised from 140,288 to 144,384 with that reason; the compile-cost budget stays 245,000). Additions and what each costs on top of 1.32.4 (ablation with `metric.total2`, removing only that piece from the 1.33.0 file):

| Change | Cost |
|---|---:|
| Staff read every job and booking (`jobGetAllowed`, `jobListAllowed`, `bookingReadAllowed`; `jobDocReadable` removed) | about −7,000 (saving) |
| Claim items and reviews readable by the line manager of `personUserId` (3 reads) | +950 |
| Line manager's row path (`callerLineManagesUserOrRow`, `callerLineManagesRowPerson`, `rowPersonLineManaged`) on the booking update and the Return tombstone | +1,580 |
| Line manager locked on users (Operatives-manager branch) | +650 |
| Claim review `personUserId` alias test, invitation lock, `worksListPicks`, Return keys, review decisions, catalogue admins only | small (under +500 together) |
| Delete on Return (booking delete trusts the same-batch tombstone; the tombstone holds the request test) | +100 |

Design notes (each was measured on the emulator, 1.22.0):

- **Document lookups are counted per call.** A `get` and an `exists` of the same document count as two of the 10 lookups a single-document write may make (probe: 6 documents with `exists` + `get` each are refused; 10 plain `get`s pass, 11 are refused). A job manager's write on a booking filed under an `operatives` row whose email names an account used 11 lookups when the line manager's row path ran first, and the line manager's own write used 11 when `canWriteBooking` ran first. Two changes fit both under 10: (1) the line manager's overtime write is its **own `allow update`** in `bookings` (the expression budget is per allow statement; the lookup budget is per write), and the row path is taken only when `users/{personId}` does not exist; (2) `callerManagesJobIn` reads the job under its stored id with one `get` (no `exists` first); the other spellings keep `exists`. A get-only lookup in every spelling (tried) added 1,000-expression refusals to denied booking writes, so only the first spelling changed.
- **`rowPersonLineManaged`** reads the person's users document once (`let u = get(...)`) and tests the caller against `assignedManagerUserIds` (else the legacy single id) before `homeOrgIs`, under a ternary, so a manager who is not the line manager stops after the list test. It does not repeat `callerHomeIsOperative`: the overtime write also requires `overtimeCallerIsStaffHere`.
- **Delete on Return**: the booking delete does not repeat the request test. It allows a delete whose tombstone is new in this batch (`!exists` before, `existsAfter` after), names a request, and was written by the caller; the tombstone's create rule (which cannot be bypassed) holds the request test (`overtimeReturnDeletes`: `getAfter` the request is `approved`, `decidedBy` the caller, lists the booking in `deletedBookingIds`) and the person test (line manager under any id, or an admin). Only `bookings` (never manager site bookings).
- **Claim reads** share one `canAccessOrganization` (`overtimeViewerOf` is `overtimeViewer` without it).
- **New document lookups** (all of other documents, none of the caller's role or company): `operatives/{personId}`, `userEmails/{email}` and `users/{uid}` in the row path; `getAfter(overtimeRequests/{id})` and `existsAfter` / `getAfter(deletedBookings/{bookingId})` for delete on Return; `users/{personUserId}` in the claim review alias test. Every role test calls a 1.32.4 claims helper (`callerOrgRole`, `isOrgAdminOrOwner`, `overtimeCallerIsStaffHere`, `canAccessOrganization`, `callerHomeIsOperative` inside `callerLineManagesUser`); the 1.33 rules add no `callerHomeData()` read (the remaining ones are 1.32.4's, kept on purpose).
- **Kept for phase 2** (after `minimumIosBuild` is raised): the decider may still write `pending` (1.32 partial approval) and the line manager may still write `status` → `Cancelled`.

Checked (merged with 1.32.4): suites 238/238 (187 + 32 + 19, each on a fresh emulator on a private port; every 1.33 test context carries claims through `tests/authClaimsContext.ts`); `RULES_STRICT_BUDGET=1`: 9 tests with a limit refusal against 20 on 1.32.4, none new (11 gone with the read changes); emulator type check 0 issues; no `IllegalStateException` in any emulator log. All three rules suites take the emulator port from `RULES_PORT` (default 8080), as 1.32.4's firestore suite already did.

### 1.34.0 — ghost operatives (7 Nov)

Two edits, both on existing paths (rulebook §11, §16):
- **R1** (users update by an Operatives manager): the 1.33.0 exemption that lets them change the line manager of an unaccepted placeholder (`passwordSet` not true) now also needs `ghost` not true — a ghost's line manager is changed by admins only.
- **R2** (`callerLineManagesUserOrRow`): the users-id branch also needs the users document's `ghost` not true (the same cached `get`), so a ghost's line manager gets no overtime booking write on it.

Static cost 232,589 → 232,779; 141,866 → 142,017 bytes; emulator type check 0 issues. Suites on a private port: firestore 190/190 (3 new), overtime 32/32, payeClaims 19/19, ghosts 3/3 (new `tests/ghosts.rules.test.ts`). `RULES_STRICT_BUDGET=1`: the same 9 limit refusals in the firestore suite as 1.33.0; the new ghost leave test's "another manager cannot book approved leave" is refused by the limit too — the same holiday-rule denial path as the existing test 57, not a new rule.

**Emulator crash (1.22.0), seen while writing these tests:** an Operatives manager's `users` create that carries `isSuperAdmin: false`, or has no `email` key at all, crashes the emulator (`IllegalStateException: ternary operator predicate is always boolean`; the write never answers and the document stays locked). The same documents with `email: ''` and no `isSuperAdmin` key pass. Ghosts are written that way (`ghostCreateWrites`). Web Add user's invite placeholder writes `isSuperAdmin: false` (`invitePlaceholderUserWriteFields`); whether Google's production engine shares the crash is unknown — check after publishing that an Operatives manager can still add an operative with a login (follow-up).

## Service-level functions

### `orgIdsMatch`

UUID / org strings may differ by case or accidental whitespace (website imports, copy/paste).

### `truthyBool`

Firestore may store legacy "boolean" flags as 1/0 from imports or other clients.

### `callerHomeIsOperative`

Rulebook 1.31.0 §8 (owner decision: no rights carry over on a level change, lib/canonical lineManagerIds): an operative is nobody's line manager, even when an old id is still stored on the report. The caller's own users document says operative (and not admin).

### inside an expression (`…`)

Job quote and order history (`canViewMaterialOrderHistory`): every admin and manager of the organisation, never operative mode — `isOrgManagerOrAdmin` (1.10.0: this organisation's role, not another company's flags).

### `userDocOrganizationMatches`

True if users/{auth.uid}.organizationId matches this org (string case-insensitive, DocumentReference exact path, or DocumentReference whose *document id* matches case-insensitive — avoids strict path equality when UUID casing differs). Also accepts string relative paths like "organizations/<uuid>" (Swift client strips the prefix; rules must too).

### inside an expression (`(userData.organizationId is path &&…`)

Some clients/refs use a different path segment index; full string match covers those cases.

### `isOrgMemberViaParentGet`

Member check by reading the parent org document. Do NOT use this when evaluating read on that same org doc (circular get can deny access). For organizations/{organizationId} document reads, use resource.data.members instead.

### `isOrgBootstrapAdminProfileCreate`

Web org setup: user just created organizations/{id} and is writing their own users/{authUid} profile.

### `selfCreateHasAgeConfirmation`

Self-create only (request.auth.uid == userId). Admin/manager invite placeholders omit these.

### `inviteClaimIsPendingPlaceholder`

Invite accept: organizations/{org}/userEmails/{email} still points at the UUID placeholder Add User wrote (not an Auth uid). The placeholder must be pending (passwordSet not true), in this org, and hold this same email — so a live member or the Deleted-user tombstone (email '', passwordSet true) never qualifies. Lets the invitee create users/{authUid} before the claim moves to authUid.

### `permissionValue`

Fields that decide what an account may do. A self-created profile may not choose its own.

### `staffFlag`

Rulebook 1.31.0 (audit finding 5, lib/canonical userPermissionFlag): the top-level value when one is stored, else `permissions.{key}`. Before 1.31.0 a flag counted when it was on in EITHER place, while every screen read the top-level value first.

### `noMorePrivilegeThan`

`next` has no privilege `source` lacks. Missing and false are the same; an operative stays one.

### inside an expression (`(!staffFlag(next, 'annualLeaveSelfBook') || staffF…`)

1.28.0: the self-manage toggles only as the admin set them on the placeholder.

### `selfCreateSelfManageOff`

Rulebook 1.28.0: a profile a person creates for themself (re-creating a deleted one, or the bootstrap path) never switches on their own self-manage toggles (Annual Leave Management, Timesheet self-sign; top level or `permissions`) — except the organisation's creator, the Super Admin, who reads both on anyway. An admin sets them.

### `selfCreateJoinsCompany`

Self-create (users/{authUid}) into an existing company. Either the invitee copies the pending placeholder an admin wrote (no privilege it lacks), or a returning member whose email claim already names this account and who is in the company's members map. Admin flags need an 'admin' entry in that map. A company that never invited or listed this account is refused.

### inside an expression (`selfCreateAliasesWithin(request.resource.data, {},…`)

1.12.0 (B3): a returning member re-creating their own profile brings no alias ids (deleting and re-creating it must not be a way round the self-update lock).

### `selfCreateCopiesPlaceholder`

The invitee's new profile has no privilege the placeholder lacks and (1.12.0, B3) alias ids only from the placeholder, plus its own id.

### `isAdminOfCompany`

Admin of this company: users/{uid}.organizationId plus admin flags, or 'admin' in its members map.

### inside an expression (`return organizationId is string &&…`)

Members map first: one get. isOrganizationAdmin runs the long organizationId match.

### `isOwnEmailClaimWrite`

The claim for the signed-in email, pointed at the signed-in account. Allowed when the claim is new, already names this account, names this invite's pending placeholder, or names a users document that no longer exists. A live claim for another account is not taken over.

### `enforcedReadsOn`

Rulebook 1.12.0 (H2, lib/canonical organizationMemberActive): deactivated in this organisation. Two sources, read where the role is read so the check costs no extra document in most rules:
- this organisation's own users document (`organizationId` names it): `isActive` false;
- for a member whose users document names another company: their membership here,
users/{uid}/orgMemberships/{orgId}.accountActive (else isActive) false. Only an explicit false deactivates; a missing document or flag is active (older data, founder bootstrap). A deactivated person still reads their own users document and memberships (the apps show the deactivated screen). Rulebook 1.12.1 §17/§18: the job and booking read scoping of 1.10.0 / 1.11.0 applies only once the platform owner has set `platformConfig/app.enforcedReads` to true (after both backfills and an app release with ENFORCED_READS_ACTIVE true). Until then every member of the organisation reads its jobs and bookings as before 1.10.0. One document read, shared by every rule that asks. Writes are never switched by it. 1.26.0: also on for one organisation when its id is in `enforcedReadsOrganizationIds` (lib/canonical securitySwitchOn), so the owner can switch their own company on first. The apps read the same document and plan their queries from it, so they work with the switch on or off.

### `privatePayOn`

Rulebook 1.13.0 §16 / §19 (Q1): pay moves to organizations/{orgId}/payProfiles/{subjectId}. The pay reads of `operativeDayRateHistory`, `operativeProfiles` and `settings/timesheet_*` are limited to the people who may see that person's pay (`canViewPayOf`, lib/canonical canViewPersonPay) once the platform owner sets `platformConfig/app.privatePay` true — after an app release that reads pay per person (Deploy notes 1.13.0). From then on no write puts a pay value back on `users`, `operatives` or `managers`. One document read, shared with `enforcedReadsOn`. `payProfiles` itself is private from the deploy. 1.26.0: also on for one organisation when its id is in `privatePayOrganizationIds` (securitySwitchOn).

### `payValueWritten`

A write that puts a pay value (not null) on a users / operatives / managers document, or changes one.

### `orgBillingOpen`

Rulebook 1.13.0 §19 (Q3, lib/canonical hasAccess / billingAccessFields): a lapsed subscription closes the organisation's data. The Stripe webhook writes `billing.accessOpen` (`hasAccess` at the time) and, while a payment has failed, `billing.accessClosesAt` (the end of the 7-day grace), so the grace ends on time without another Stripe event. Closed when `accessOpen` is false or `accessClosesAt` has passed. Missing billing or missing fields are open (trials, organisations whose billing has not synced since 1.13.0), so the rules never block where the apps would not. Not gated: the organisation document itself, the caller's own users document and memberships, and billing (written by the server only). Kept to one document read and a few expressions: it runs inside the role helpers. 1.15.0 (§20, `organizationDeletionState`): also closed while the organisation is scheduled for erasure (`deletion.status == 'scheduled'`) — same exceptions as a lapsed subscription (the organisation document, the caller's own users document and memberships, the platform owner).

### `belongsToOrganization`

For subcollections under organizations/{organizationId}/… only (parent get is not the resource being read). 1.12.0 (H2): never for a person this organisation has deactivated. 1.13.0 (Q3): never while the organisation's subscription has lapsed (`orgBillingOpen`).

### `deletionUnchanged`

1.15.0 (§20): `deletion` is written by the server (admin SDK) only, never by an app — except the restore below.

### `resourceMaterialHasNonEmptyOwnerUid`

Treat missing or blank addedByUserId like legacy rows (see canDeleteOwnMaterial / canClaimLegacyOwnMaterial).

### `isOrganizationAdmin`

Helper function to check if user is admin of organization Includes adminAccess so users with admin permissions can update org (e.g. members map on user delete). 1.13.0 (Q3): an admin of a lapsed organisation is not an admin of its data (`orgBillingOpen`); the organisation document itself uses `isOrganizationAdminAnyBilling`.

### `callerListedRole`

Rulebook 1.10.0 (H2): a person's role in an organisation comes from that organisation. Their users/{uid} flags count only when that document is this company's (users/{uid}.organizationId); otherwise the role is this company's members map entry. A manager in company A who is an operative (or member) in company B is never a manager in B.

### `homeOrgIs`

users/{uid}.organizationId names this organisation (string, "organizations/<id>" path string, or reference).

### `callerOrgRole`

The caller's role in THIS organisation: 'admin' | 'manager' | 'operative' | 'member' | the listed role | ''. 1.11.0: an admin is an admin (no operative mode, permissionLevelOf); otherwise operative mode wins (lib/canonical staffAccess: operative mode is never staff). 1.12.0 (H2): '' for a person this organisation has deactivated (callerHomeInactiveIn / callerMembershipDeactivated), so every rule built on the role refuses them. 1.13.0 (Q3): '' while the organisation's subscription has lapsed (`orgBillingOpen`).

### `callerOrgRoleAnyBilling`

Without the billing test: for rules that already passed `canAccessOrganization` (annual leave, near the 1000-expression limit).

### `invitationRole`

Rulebook 1.11.0 (lib/canonical/inviteAccept.ts invitationRole): the role an invitation gives — its `role`, else the kind its permissions give, else 'member'.

### `invitationIsOperativeOnly`

Rulebook 1.12.0 (B2, lib/canonical invitationIsOperativeOnly): an invitation that gives an operative and nothing more — role operative (`invitationRole`), operative mode on, and no admin, super admin, manager or operatives toggle at the top level or in `permissions`. The same test as managerCanCreateOperativeUser on users/{uid}: the only invitation a manager with operatives access may create, change or hold.

### `inviteBeingAccepted`

A genuine, unused invitation (`invitations/{invId}`) to the signed-in email for this organisation, marked used in the same batch (inviteMembershipWrites). The one source of an accepting person's access in that organisation.

### `isOrgManagerOrAdmin`

Admin or manager of THIS organisation, never operative mode (lib/canonical/staffAccess.ts isStaffAccount).

### `isOrgNonOperativeMember`

Staff who may open Send in THIS organisation: not an operative here.

### `canWriteMaterialSendRecord`

Staff who can open Send (not operatives). Membership is enough — do not require users/{uid}.organizationId to be this company (multi-org / stale primary org used to fail the send-history write after the email went out).

### `isStaffMaterialStatusWrite`

Rulebook 1.9.0: a Send status update may carry write metadata (`updatedBy` = the signed-in user, `updatedFrom` a known platform). Checked inline: the materials update rule is close to the expression limit.

### `isOrgAdminViaMembersMap`

Admin of org by members map (works before users/{uid} profile exists — web org bootstrap).

### `isOrgAdminViaMembersMapAnyBilling`

1.13.0: without the billing test, for rules that already passed `canAccessOrganization` (which has it) and sit near the 1000-expression limit (annual leave), and for the organisation document itself.

### `isManagerWithOperativesAccess`

Helper function to check if current user is super admin or has admin access Firestore rules only support boolean expressions, not if/let statements
WHO CAN CREATE USERS:
✅ Super Admin (isSuperAdmin == true)
✅ Admins (adminAccess == true OR role == 'admin')
✅ Managers with operatives permission — operative accounts only (operativeMode == true)
❌ Managers without operatives permission — cannot create users
❌ Operatives (operativeMode == true) — CANNOT create users
Managers and operatives can create their own accounts during website signup (self-creation path).

### `isPlatformOwner`

App owner only (Project Planner), never an organisation admin. Rulebook 1.12.0 (B1, isPlatformOwnerEmail): only the signed-in Auth token's email, and only once Firebase Auth has verified it. The users document's `email` is never read here — anyone could write their own.

### `canAdminVariations` — 1.31.1: renamed `isOrgAdminOrOwner` (same test; also replaces `overtimeAdmin` and `canAdminNotifications`)

Variations: every admin and manager of the org (isOrgManagerOrAdmin). Never an operative. Do not look up the job's assigned-manager list here — that extra get() made every variation read/write slow and denied managers who can already see the job.

### `canAccessVariationsStaff`

1.10.0: the manager test is this organisation's role (isOrgManagerOrAdmin), never another company's flags.

### `managerMayManageOperative`

A manager with operative-management access (manager + operatives, not operative mode) in the same company as `targetData`, which is another person's operative users document. The one test for who besides an admin may change an operative's pay, on users/{uid} (canManagerUpdateOperativeProfile), operativeProfiles and operativeDayRateHistory.

### `canManagerUpdateOperativeProfile`

Managers with operative-management access may edit limited operative profile fields on users docs. Rulebook 1.31.0 (owner decision 7): a manager with the Operatives permission edits an operative's profile — names, contact, trade, active flag, the operative toggles (Materials, Site audit), line manager, leave and pay — and the person stays an operative with no more privilege (never a manager, admin or the self-manage toggles) and never "No line manager" (admins only, §8).

### `userSelfUpdateKeepsPrivileges`

Self-update may repair missing top-level admin flags on an existing admin. It must not let an operative set adminAccess, isSuperAdmin, role, or organizationId.

### `selfUpdateKeepsIdentityLinks`

Rulebook 1.12.0 (B1, B3): on their own document a person never changes the fields other rules trust as who they are. `email` changes only to the signed-in Auth email (the sync after Firebase Auth has changed the sign-in email, `verifyBeforeUpdateEmail`); `formerUserIds` and `sameEmailUserIds` (the ids the rules and pay treat as theirs, `personIdSet`) never change on a self-update — admins, invite acceptance and the admin backfill write them. Admins editing a person go through the admin branch, not this one.

### `idSetOf`

A list field as a set (missing or not a list: empty).

### `selfCreateAliasesWithin`

1.12.0 (B3): a self-created profile carries no alias ids except what the invite placeholder it copies already had, plus that placeholder's own id (`inviteMigrationFormerIdWriteFields`). `placeholderId` '' means no placeholder.

### `defaultOnFlag` — 1.31.1: removed (unused)

Effective flag for a key that defaults to true when missing (dailyOverview, wholesalersOrderHistory): off only when the top level or `permissions` says false.

### `lockedPermissionFalseMap`

Permission toggles a person may not switch on for themselves (Manage Users sets them). Kept as all-false maps so one diff() finds every toggle that is on: a key present with a value other than false. materials and siteAudit are locked only for an operative, because iOS saveUser forces them on for every non-operative.

### `lockedPermissionsOn`

Locked toggles that are on at the top level or in `permissions`.

### `defaultOnPermissionsOff`

Toggles that default to on (dailyOverview, wholesalersOrderHistory): explicitly false somewhere.

### `selfPermissionsNotRaised`

`next` turns on no permission toggle that `prev` had off, and an operative stays one.

### inside an expression (`defaultOnPermissionsOff(next).hasAll(defaultOnPerm…`)

A default-on toggle that was off stays off.

### `lineManagerIdList`

`assignedManagerUserIds`, or the legacy single id when that list is empty (lib/canonical/userTimesheetAccess.ts).

### `sameInstantValue`

Timestamps written by a client round-trip through ms (web Date) or a Swift Double (iOS Date), so a resent unchanged instant can differ by under a millisecond. Within one second is the same.

### `writeMetadataValidWhenPresent`

Write metadata (lib/canonical/writeMetadata.ts writeMetadataFields). Optional while iOS does not send it yet; when present, updatedBy is the signed-in account, updatedFrom a known platform, and updatedAt a timestamp. Only keys this write sets are checked, so a merge that keeps an earlier editor's stamp still passes.

### `sameLooseValue`

A plain value, with missing, null and '' the same.

### `selfUpdateKeepsManagedFields`

Pay, line manager, active state, employment type and permission toggles are set by an admin or a manager with operatives access (Manage Users), never by the person on their own document. Both apps resend the whole profile (iOS saveUser setData merge, web updateDoc), so only a real change is refused: missing and the app default are the same value. An admin repairing their own document keeps the existing exemption.

### inside an expression (`return (alreadyPrivilegedAdmin(prev) && selfManage…`)

1.28.0: the admin exemption never covers their own self-manage toggles (selfManageTogglesUnchanged).

### inside an expression (`(!('employmentStartDate' in changed) ||…`)

1.13.0 (Q4): the start date sets the pro-rata leave allowance; the person does not change their own.

### `selfManageTogglesUnchanged`

Rulebook 1.28.0 (§11, §16): nobody changes their own self-manage toggles (Annual Leave Management `annualLeaveSelfBook`, Timesheet self-sign `timesheetSelfSign`) — not even an admin, whose other self-repairs `selfUpdateKeepsManagedFields` still allows. They decide self-approval (hbCallerSelfBooks, timesheetSubjectSelfSigns). The Super Admin reads both on whatever is stored, so their own document is exempt. Resending an unchanged value (missing and false are the same) passes. Used on the admin paths only (a non-admin can never raise them: lockedPermissionFalseMap).

### `docOrganizationId`

An organisation id stored on a document: an id, an "organizations/<id>" string or a reference.

### `selfCreateSuperAdminAllowed`

1.12.0 (B4): a self-created profile is super admin only for the organisation's creator (deleting and re-creating one's own profile is not a way to become super admin).

### `callerIsSuperAdminOf`

Rulebook 1.12.0 (B4, §16): the current Super Admin of this organisation — its creator, or a users document of this organisation that is already super admin. Never a flag the caller set on themselves (see below).

### `membershipFlag`

Rulebook 1.30.2 (§8, §9, §16; lib/canonical organizationSelfManageFlags): a person's self-manage toggles (`annualLeaveSelfBook`, `timesheetSelfSign`) are read for THIS organisation — their users document when its `organizationId` names this organisation, else their membership here (users/{uid}/orgMemberships/{orgId}, as organizationLevelFor reads it), else off. Never another company's users document: before 1.30.2 an admin whose toggles were on only in their membership here was refused, and a manager with the flag on at home was allowed. A membership flag is `permissions.{key}` when stored there, else the flat key (parseOrgMembershipDocument).

### `membershipSelfManageFlag`

The membership's level here (organizationLevelFor): the role, else its flags. `adminOnly`: the flag counts for an admin only (Timesheet self-sign); otherwise for anyone outside operative mode (Annual Leave Management).

### `orgSelfManageFlag`

The toggle `key` of person `uid` in this organisation. On the users document of this organisation the Super Admin flag counts as both toggles on; a membership never makes anyone the Super Admin. The creator is the callers' test.

### `adminUpdateKeepsTopAccount`

1.12.0 (B4): an admin who is not the Super Admin never changes `isSuperAdmin` on anyone (their own document included) and never changes the role, permissions, active flag or company of the Super Admin or the creator. Ownership moves only as §16 says (the current Super Admin, or the platform owner).

### inside an expression (`staffFlag(next, 'isSuperAdmin') == staffFlag(prev,…`)

1.28.0: an admin never changes their own self-manage toggles.

### `callerHomeOrgId` — 1.31.1: now `docOrganizationId(callerHomeData())` in `anchoredInCallerCompany`

Rulebook 1.11.0 (rosterMembersForOrganization): the reader's own company, from their users document (`organizationId` as an id, an "organizations/<id>" string or a reference).

### `anchoredInCallerCompany`

The person is anchored on the reader's company: a key of its `members` map or its creator. Lets co-members read a member whose own users document names another company (a super admin who last opened another one).

### inside an expression (`return org != '' && !org.matches('.*[.].*') && cal…`)

1.12.0 (H2): never for a person their company has deactivated. 1.13.0 (Q3): never while that company's subscription has lapsed (`orgBillingOpen`).

### `organizationExists`

Helper function to validate organizationId exists

## `/databases/{database}/documents`

### match `/invitations/{invitationId}`

Invitees open /setup-password?token=<id> before they have an account, so get-by-id stays public. List/create/delete are the inviting org's admin or manager, or the platform owner — not any signed-in user. Update also allows the invitee to mark isUsed after they set a password (same field lock as accountConfirmations).

## `/databases/{database}/documents/invitations/{invitationId}`

### `canAdministerInvitation`

1.12.0 (B2): a manager with operatives access lists and deletes their company's invitations, and creates or changes only an operative-only invitation (`invitationIsOperativeOnly`), before and after the write — never an admin's or manager's invitation.

## `/databases/{database}/documents`

### match `/accountConfirmations/{token}`

Founder confirm-account email tokens. Get-by-id is public so the emailed link can mark the token used. 1.12.0 (H5): never listed (each holds a founder's email, uid and organisation); created by the founder for themselves; marked used only by the signed-in person whose email it names.

### match `/users/{userId}`

Users collection - with better validation
Role / permission coherence when promoting or demoting accounts (operative ↔ manager ↔ admin) is enforced in the iOS client via `UserRoleTransitionPolicy` + `UserStore.updateUserPermissions`. That flow keeps `role`, boolean permission flags, and annual-leave behaviour aligned with the Add user presets; pending holiday *requests* are deleted client-side when switching onto the self-book path. Approved bookings are never deleted by that transition.

## `/databases/{database}/documents/users/{userId}`

### `allow create`

Allow create if: 1. User is creating themselves (by email match - for signup flow), OR 2. Current user is super admin or has admin access (for admin user creation) 3. Web org bootstrap: org creator writes users/{authUid} right after creating organizations/{id}
IMPORTANT: We check self-creation FIRST because:
- During signup, users create their own account via the website
- This doesn't require admin permissions
- This is fast and reliable (no document reads)
For admin creation, we use inline checks instead of the function because functions can be unreliable during CREATE operations. This directly checks the user document in the rule itself.

### inside an expression (`(request.auth.uid == userId &&…`)

Path 1: Self-creation into a company that invited or lists this account. A new company's founder uses Path 3. An email with no claim does not open any company.

### inside an expression (`(request.auth.uid != userId &&…`)

Path 2: Admin of the target company creating another user there (e.g. invite placeholder). Not their own profile: that is Path 1 or Path 3, which require age confirmation.

### inside an expression (`(isOrgBootstrapAdminProfileCreate(userId) && selfC…`)

Path 3: Web org setup bootstrap (org exists, caller is admin in members map, writing own profile). 1.12.0 (B3): a founder's new profile carries no alias ids.

### inside an expression (`managerCanCreateOperativeUser() ||…`)

Path 4: Manager with operatives permission inviting a new operative

### inside an expression (`(isPlatformOwner() && request.auth.uid == userId)…`)

Path 5: Platform owner creating their own non-tenant profile

### `allow update`

Allow update if: 1. User updating themselves without escalating admin / role / organizationId, OR 2. Admin/Super Admin updating other users (for user management)

### inside an expression (`canManagerUpdateOperativeProfile(userId) ||…`)

Before the admin branch (1.28.0): a manager's operative edit stops here, under the expression limit.

### inside an expression (`(request.auth.uid != userId || selfManageTogglesUn…`)

1.28.0: an admin never changes their own self-manage toggles (the Super Admin reads both on).

### inside an expression (`(request.resource.data.get('hasNoLineManager', fal…`)

1.31.0 (audit finding 9, §8): "No line manager" is set only on an admin.

### inside an expression (`!('organizationId' in request.resource.data) ||…`)

No shortcut for the account's own document: an admin moving their own profile into another company must be an admin of that company too.

### `allow delete`

Allow delete if: 1) User deleting themselves by uid, OR 2) User deleting their own duplicate docs by email, OR 3) Super Admin deleting any non-creator user in their organization, OR 4) Admin (non-super) deleting non-admin/non-super users in their organization.

### inside an expression (`managerMayManageOperative(userId, resource.data) |…`)

1.31.0 (owner decision 7, lib/canonical userDeleteRefusal): a manager with the Operatives permission deletes an operative of their company (never a manager, an admin or themselves).

### match `/private/{privateDocId}`

Tax identifiers (UTR, VAT number): lib/canonical/sensitiveProfile.ts. Only the person, an admin of their company and the platform owner read or write. The invitee may read and remove the placeholder's copy while finishing an invite (same email check the placeholder user document uses).

## `/databases/{database}/documents/users/{userId}/private/{privateDocId}`

### inside an expression (`(subjectExists() && managerMayManageOperative(user…`)

1.31.0: deleting an operative (userDeleteWrites) as a manager with the Operatives permission.

## `/databases/{database}/documents/users/{userId}`

### match `/orgMemberships/{membershipOrgId}`

Multi-org memberships (web Change organisation + cross-org invites) Rulebook 1.10.0 (lib/canonical/orgMembership.ts): only an admin of that organisation writes role, permissions, super admin or the active flag. The person may accept (status active, acceptedAt), keep their profile copy fields, and set `role` only to what that organisation's members map lists for them.

## `/databases/{database}/documents/users/{userId}/orgMemberships/{membershipOrgId}`

### `membershipFromInvitation`

1.11.0 (inviteMembershipWrites): accepting a genuine, unused invitation creates the membership with exactly the invitation's role and permissions — nothing more.

### `allow get`

1.12.2: an admin of that organisation reads the membership too (iOS `writeOrgMembership` reads it before the change user type write; before 1.12.2 the read was refused and the change stopped after users/{uid}).

### `membershipSuperAdminUnchanged` — 1.31.1: inlined into the memberships `allow create, update`

1.12.0 (B4): `isSuperAdmin` on a membership changes only by that organisation's Super Admin.

### inside an expression (`(exists(/databases/(default)/documents/users/$(use…`)

1.31.0: deleting an operative as a manager with the Operatives permission (read before the batch).

## `/databases/{database}/documents`

### match `/organizations/{organizationId}`

Organizations - with strict access control

## `/databases/{database}/documents/organizations/{organizationId}`

### match `/userEmails/{emailKey}`

One user per email per org (must stay above the catch-all so writes are not widened by {collection}/**)

## `/databases/{database}/documents/organizations/{organizationId}/userEmails/{emailKey}`

### `allow read`

Invitee may read the claim for their own email after they create Auth. That id is the pending placeholder, not request.auth.uid. List of this collection stays closed: emailKey == token email is only true for one doc.

### `allow delete`

1.13.0 (§14, `signInEmailSyncWrites`): after Firebase Auth changed a person's sign-in email (verified), they move their claim — create the new key (isOwnEmailClaimWrite) and delete their own old one, which no longer matches their token email.

### inside an expression (`(isManagerWithOperativesAccess() && userOrgIdMatch…`)

1.31.0: deleting an operative as a manager with the Operatives permission — the claim names an operative users document of this company (read before the batch).

## `/databases/{database}/documents/organizations/{organizationId}`

### `allow get`

Org root document: must not call get(organizations/{organizationId}) inside the rule (same doc → circular deny). Use resource.data.members for membership; userOrgIdMatchesPath for users/{uid}.organizationId. creatorUserId covers legacy orgs that predate a reliable members map.

### `allow list`

Lists only the companies this account belongs to or created: the two queries both apps run (`members.{uid} != ''` and `creatorUserId == uid`). Listing every company is refused.

### `allow create`

Signed-in bootstrap (first setup or leftover Auth with no users/{uid}): any authenticated user may create an organisation if they list themselves as admin. Do not require an existing profile. Path 3 on users/{uid} then writes that profile.

### `orgRootCallerIsAdmin` — 1.31.1: inlined into the organisation `allow update`

Admins of this company edit settings. Being the creator alone is not enough: a creator who was demoted is no longer an admin (members map or users document) and cannot edit. creatorUserId moves only in an ownership transfer: the platform owner, or the current Super Admin (creator, or users/{uid}.isSuperAdmin in this company) who is still an admin, handing it to someone who is an admin here (iOS transferOrganizationOwnership, web userStore transfer). Billing stays server-only.

### `orgRootInviteJoin`

1.11.0 (inviteMembershipWrites): the person accepting an invitation adds only `members.{their uid}`, with the invitation's role, in the batch that creates their membership from it and marks it used.

### `orgRootSuperAdminRestore`

1.15.0 (§20, `canRestoreOrganization`): the super admin restores a scheduled organisation by removing `deletion` (and only that, with write metadata) when the deletion was theirs to undo (`restoreBy` is not `platform_owner`). Nothing else on the document changes while it is scheduled.

### `orgRootOperativesManagerRemovesMember`

1.31.0 (owner decision 7, userDeleteWrites): a manager with the Operatives permission deleting an operative removes that one `members` entry (an operative or member entry), in the batch that deletes the users document. Cheapest tests first (the caller's own users document): for everyone else this branch stops at once, so the organisation update's expression budget is unchanged for admins.

### `orgRootRemovesOneOperativeMember`

The members map loses exactly one entry, `operative`, whose users document is gone after the write, and nothing else on the document changes.

### `callerJobToggle`

Rulebook 1.10.0 round 2 (lib/canonical/staffAccess.ts seesEveryJob / canCreateJob / canEditJob / canChangeJobManagers): the caller's Projects / Small works add-edit-manage permission in THIS organisation — users/{uid} flags when that is this organisation's profile, else this organisation's membership document (nested permissions.{kind}, else the legacy flat key). Only a manager here counts (admins see everything). `role` is callerOrgRole(organizationId), computed once per rule: these rules sit near the 1000-expression limit, so the helpers take it as an argument instead of recomputing it.

### `callerSeesEveryJob`

Sees, adds and edits every job of this kind, and changes its manager list (`seesEveryJob(role, kind)`).

### `legacyMemberRead`

A single job document: every-job viewers; a manager listed on it (`isJobManager`); operatives and other non-staff members of this organisation by id only (the jobs of their own bookings — the rules cannot see which jobs those are, so `list` is refused to them). 1.12.0: before `enforcedReads` (enforcedReadsOn), every member of this organisation reads every job, as before 1.10.0 (`legacyMemberRead`).

### `jobListAllowed`

A job query: every-job viewers any query; other managers only `managerUserIds array-contains <uid>`.

### `jobCreateAllowed`

1.31.0 (owner decision, lib/canonical jobManagerRequiredError): a new job names at least one manager.

### `jobUpdateAllowed`

Editing a job: every-job viewers; a manager of the job edits its details but never its manager list.

### `jobDocReadable`

A job's health & safety subcollection is read by the people who may read the job.

### match `/clients/{clientId}`

Path already scopes to this org; body organizationId can drift or be typed oddly on some clients.

### `rosterRowPayKeysChanged`

Pay on roster rows (operatives/{id}, managers/{id}): payRate.ts falls back to these when users/{uid} has no rate, so they are pay too. Only keys whose value changes count.

### `operativeRowIsCaller`

The operatives row is the caller's own when its email is the signed-in email.

### `rosterRowEmailChanged`

Rulebook 1.12.0 (H3): a roster row's `email` is who it is — `jobListsCaller` (managers rows) and `callerOwnsBookingId` (operatives rows) trust it. Changing the email of an existing row is admins (and, for an operatives row that is not their own, managers with operatives access); a new row is staff only.

## `/databases/{database}/documents/organizations/{organizationId}/operatives/{operativeId}`

### `allow delete`

1.31.0 (owner decision 7): managers with the Operatives permission delete an operative row (not their own).

## `/databases/{database}/documents/organizations/{organizationId}`

### `bookingTombstoned`

Deleted-booking tombstones (lib/canonical/bookingTombstones.ts). A delete of bookings/{id}, subcontractorBookings/{id} or managerSiteBookings/{id} writes deletedBookings/{id} in the same batch; while it exists the booking cannot be created or updated again, so a queued offline save cannot bring it back.

### `jobListsCaller`

Rulebook 1.10.0 (lib/canonical/staffAccess.ts canWriteBooking / canDeleteBooking): admins write every booking; managers only bookings on a project or small works they manage; operatives never. A job's managers: `managerUserIds` / `managerIds` / `managerId` naming the signed-in account (with or without `user:`, without case), or `managerId` naming a managers-list row whose email is the signed-in email. The job is projects/{id} or smallWorks/{id}, the booking's id as stored, then upper case.

### `callerManagesJobInAt`

1.11.0: the job in one collection (`jobCollection` on the booking), any spelling of its id.

### `bookingJobCollectionValid`

1.11.0 (bookingJobCollection): `jobCollection` is 'projects' or 'smallWorks', only on a booking with a job.

### `managerMayWriteBookingData`

The job part of canWriteBooking for a manager: the booking's job is one they manage (in the collection its `jobCollection` names, when it carries one); a manager site booking with no job is their own.

### `bookingWriteAllowed`

`op`: 'create' (request.resource), 'update' (stored and written), 'delete' (stored).

### `bookingTombstoneAllowed`

The tombstone of a stored booking: the people who may delete it (read as it was before the batch).

### `operativesManagerRemovesOrphanBooking`

1.31.0 (owner decision 7, userDeleteWrites step 2): a manager with the Operatives permission deleting an operative removes that person's labour bookings (with their tombstones) once the users document is gone — a booking whose `operativeId` names no users document (a deleted or catalogue operative). Cheapest first (the caller's own users document, read once per request) so admins and other managers stop before the extra lookup (a request may look up 10 documents; a batch 20). 1.31.0 owner decision (lib/canonical operativesManagerMayDeleteBooking): only a booking dated AFTER today — its `date` (organisation-zone midnight) is after the request time, so today's midnight never passes — and whose person has no users document. Today's and past bookings they may only cancel.

### `callerOwnsBookingId`

A role in this organisation (callerOrgRole not '') is membership here, so these rules do not repeat canAccessOrganization (it would cost most of the expression budget). Rulebook 1.10.0 round 2 §17 (bookingQueryPlan): reads are enforced. Every-booking readers read everything; other managers read the bookings on a job they manage (`projectId` / `locationId`, any spelling of the job id) and their own; operatives only their own. Firestore rules are not filters: each app query names the job (`projectId in [<one job's id spellings>]`) or the person, so the rules can prove every document. Each `in` value costs a job lookup and a query may look up 10 documents, hence one job per query.

### inside an expression (`return personId is string && personId.size() > 0 &…`)

1.12.0 (B3): the caller's alias ids count only on their own company's users document (another company's admin could write their own aliases there).

### `bookingReadAllowed`

Cheap tests first: when the rules cannot prove a query from its filters, they are evaluated document by document against the 1000-expression budget, so a toggle or own-booking match must not pay for a job lookup. 1.11.0 (owner decisions round 3): reads are limited by job kind. A manager with the Projects / Small works toggle reads the bookings whose `jobCollection` is that kind (apps query `jobCollection == <kind>`); a booking without `jobCollection` (written before 1.11.0, until the backfill) is read only by admins, the job's managers and the people it books.

### inside an expression (`return role == 'admin' ||…`)

1.12.0: before `enforcedReads`, every member of this organisation reads every booking (as before 1.10.0).

## `/databases/{database}/documents/organizations/{organizationId}/deletedBookings/{bookingId}`

### inside an expression (`bookingTombstoneAllowed(request.resource.data.coll…`)

1.10.0: the same people who may delete that booking (canDeleteBooking), read as it was before the batch. With the booking already gone, only an admin writes its tombstone.

## `/databases/{database}/documents/organizations/{organizationId}`

### `bookingPersonId`

Rulebook 1.29.0 (§16, §25; lib/canonical/payeOvertime.ts): PAYE overtime. A person's line manager (listed on their users document of this organisation) may apply an approved overtime request to that person's booking, changing only workStartTime, workEndTime, timeSlot, otMultiplierOverride (1–3 in 0.25 steps, or removed) and status to Cancelled — never anything else, never their own booking. Admins already write every booking (canWriteBooking); operatives never write a booking.

### inside an expression (`get(path).data.get('hasNoLineManager', false) != t…`)

1.30.0 review: "No line manager" stored on the person means none (canonical lineManagerIds).

### inside an expression (`!callerHomeIsOperative();…`)

1.31.0: an operative is never a line manager.

### `overtimeCallerIsStaffHere`

Cheap tests first (the 1000-expression budget is shared with bookingWriteAllowed). The caller is an active member of this organisation at manager or admin level (their users document of this organisation, not an operative), with the subscription open.

### `overtimeTextFieldValid`

A clock or slot the line manager writes is short text (an `HH:mm` time, a known slot).

### `overtimeLineManagerBookingUpdate`

1.29.0 review fix: only a booking whose person id is a users id listing the caller as line manager — never one filed under an `operatives` row (its link fields are writable by members, so they cannot grant access).

### `overtimeAdmin` — 1.31.1: merged into `isOrgAdminOrOwner(organizationId)` (same test)

Overtime documents: the person, their line managers and admins of this organisation read them.

### inside an expression (`return canAccessOrganization(organizationId) &&…`)

The admin test first: it needs no document, so an admin's whole-collection list is provable.

### `overtimeOwnBookingEditable`

A non-operative person changing their own booking's overtime directly writes its review only where they may edit that booking (canWriteBooking): admins every booking, managers the bookings on jobs they manage.

## `/databases/{database}/documents/organizations/{organizationId}/overtimeRequests/{requestId}`

### `allow create`

The person sends their own, pending, online only (overtimeRequestWriteFields).

### `allow update`

The person withdraws their own pending request; their line manager or an admin (never the person) approves it.

## `/databases/{database}/documents/organizations/{organizationId}`

### match `/overtimeReviews/{reviewId}`

Approved overtime lines, one per person and booking: `{userId}_{bookingId}`.

## `/databases/{database}/documents/organizations/{organizationId}/overtimeReviews/{reviewId}`

### inside an expression (`request.resource.data.userId == request.auth.uid…`)

Their own line: only where they may edit the booking (admins every booking). Someone else's: their line manager or an admin.

## `/databases/{database}/documents/organizations/{organizationId}`

### match `/overtimeReports/{reportId}`

Saved overtime reports: created once by the person, never changed or deleted by an app.

### `payeClaimDayKey`

Rulebook 1.30.0 (§16, §26; lib/canonical/payeClaims.ts, personalSiteAudits.ts): PAYE price work and expenses. The person reads and writes their own; their line managers (listed on the person's users document of this organisation, never an operatives row) and admins of this organisation read them; nobody else. No approval.

### `payeClaimEvidenceAt`

One evidence entry (index i): a map whose path is a file in the person's own claim folder of this organisation (`pattern`), never an SVG. Rules cannot loop and share a 1000-expression budget with the approver and membership tests, so the first 5 entries are checked here and the list is capped at 20; the rulebook readers (parsePayeClaimEvidence with the item's userId) drop any later entry that is not the person's own, so no viewer is ever offered it.

### `priceWorkApproverValid`

The named approver is an active admin or manager of this organisation (their users document here, not an operative), never the person (priceWorkApproverCandidates). Free text is never an id that passes.

### `priceWorkApproverData`

1.30.0 review: an admin, or the manager flag / role and not an operative — a flagless member is not offered (canonical priceWorkApproverCandidates) — active, with a users document naming this organisation.

### `priceWorkItemValid`

1.30.1: a job number (free text) is required on a new item, 1–60 characters (priceWorkJobNumberError); an item stored before 1.30.1 without one stays valid on update, and one that has it keeps 1–60.

### inside an expression (`data.evidence.size() >= 1;…`)

Evidence is required for an expense (EXPENSE_EVIDENCE_REQUIRED_MESSAGE).

### `payeClaimOwnerWriter`

The person themself, active in this organisation (an inactive or lapsed member writes nothing). callerOrgRole is '' for anyone not a member here, deactivated here or in a lapsed / deleted organisation, so it stands in for canAccessOrganization (kept off this path: the expression budget).

### match `/payeClaimReports/{reportId}`

Saved price work / expenses report copies: created once by the person, never changed or deleted by an app.

### match `/personalSiteAudits/{auditId}`

Personal site audits: the owner only — no admin, manager or line manager reads them (§26). A copy attached to a claim is a separate file in the claim folder (storage.rules).

## `/databases/{database}/documents/organizations/{organizationId}/bookings/{bookingId}`

### `allow update`

Only admins and the job's managers write (1.10.0), so a cancelled booking is reinstated only by them. 1.29.0: plus the booked person's line manager applying an approved overtime request (overtime fields only).

## `/databases/{database}/documents/organizations/{organizationId}`

### match `/qualifications/{qualificationId}`

1.12.0 (M3, part): the qualification and skills catalogues are staff only (admins and managers of this organisation, never an operative). A person's own qualification assignments and expiry dates live on their operatives row, which iOS My Qualifications still lets them edit (not changed here).

### match `/settings/{settingId}`

Job types and other org settings (only jobTypes doc is used today). Org members need to sync job types when creating work. Variation log / item docs live here as the iOS fallback. Operatives must not read them.

## `/databases/{database}/documents/organizations/{organizationId}/settings/{settingId}`

### `isOwnTimesheetSettings`

Doc id is timesheet_{userId}_{unix} (userId may itself contain underscores). Prefer stored userId; fall back to id prefix timesheet_{auth.uid}_. matches() is whole-string — the .* is required.

### `timesheetSubjectUid`

Whose timesheet: stored userId, else the incoming one on create.

### `timesheetIdIsCallers`

Rulebook 1.30.2 (lib/canonical timesheetWriterIsReviewer, personIdSet): every id the caller goes by — their uid, and the `formerUserIds` / `sameEmailUserIds` on their own users document (never self-edited, selfUpdateKeepsIdentityLinks).

### `timesheetSubjectIsCaller`

The sheet's `userId` (stored, else incoming) is one of the caller's ids.

### `timesheetCallerIsSubject`

The caller is the sheet's subject for the reviewer test: their id is the `userId`, or the doc id prefix names them (isOwnTimesheetSettings) — either one makes them never the reviewer.

### `timesheetOwnerKeepsSubject`

The owner never re-attributes a sheet: an incoming `userId` is one of their own ids, and an update keeps the stored one (a legacy sheet without one may gain the caller's).

### `timesheetSelfSignedOwnerWrite`

The self-signed owner's write: the sheet is theirs by its `userId` (timesheetOwnerKeepsSubject, checked first, leaves only the caller's own ids there), the doc id names that same subject, and the subject is self-signed. The prefix alone never grants it.

### `isTimesheetReviewer`

Admins, or the subject's line manager (their own id, or a former invite id on users/{auth.uid}.formerUserIds — lib/canonical/userTimesheetAccess.ts). 1.30.2: never the subject themself, admins and the Super Admin included (before it an admin was the reviewer of their own sheet and could counter-sign it); their own write is the owner's (canWriteTimesheetSettings).

### `timesheetReviewerOfOthers`

Admins or the subject's line manager, for a sheet that is not the caller's (callers test that first).

### inside an expression (`!callerHomeIsOperative() &&…`)

1.31.0: an operative is never a line manager (no rights carry over on a level change).

### inside an expression (`lineManagerIdList(get(/databases/(default)/documen…`)

1.12.0 (B3): former ids only from the caller's own company's users document.

### `timesheetManagerFieldsUnchanged`

Manager counter-sign and export (timesheetSignOffWriteFields role 'manager', timesheetExportWriteFields). The owner resends them unchanged on every save.

### `timesheetEmptyish`

Reviewer-only parts (lib/canonical/timesheetEntryReviews.ts). Rules cannot walk arrays, so manager decisions on price work and expenses live in the `extraEntryReviews` map, not in the owner-editable entry rows. `managerNote` is the owner's "Note to manager" and stays theirs.

### `timesheetOwnerLeaves`

Unchanged (missing and an empty map are the same), so a full resend passes.

### `timesheetSubjectSelfSigns` — 1.31.1: removed (unused)

lib/canonical timesheetSelfSigned (rulebook 1.28.0): the owner writes the approved snapshot only when the sheet is self-signed — the organisation's Super Admin (its creator, or a super admin users document of this organisation), or an active admin of this organisation with Timesheet self-sign on, line manager or not. Having no line manager no longer self-signs anyone. 1.30.2: the toggle is read for this organisation (orgSelfManageFlag: the users document of this organisation, else the membership here).

### `timesheetOwnerReviewFieldsUnchanged`

The owner never writes line reviews or entry decisions; never writes the approved snapshot (a self-signed owner passes canWriteTimesheetSettings before this); and cannot change their price work or expenses once the line manager has signed.

### `canWriteTimesheetSettings`

1.30.2: the subject writes their own sheet only here. A self-signed subject (timesheetSubjectSelfSigns) may write the whole sheet: their signature completes it, the snapshot is theirs, and an iOS build from before 1.30.2 saves a self-signed admin's own sheet as the reviewer's (sign-off fields, `extraEntryReviews`). Anyone else — an admin with Timesheet self-sign off included — leaves the sign-off and export fields, the review maps and the snapshot alone.

### inside an expression (`return isPlatformOwner() || (timesheetCallerIsSubj…`)

The subject test runs once (the 1000-expression limit), and an ordinary owner save never reads the self-sign toggle.

### inside an expression (`return isPlatformOwner() || (timesheetCallerIsSubj…`)

The owner deletes only an unsigned sheet filed under them (no self-signed exception: no app deletes one).

### `isMemberWritableSettingsDoc`

Per-job deadlines and the legacy health & safety copy: operatives update their own deadlines and sign toolbox talks, so any member writes these.

### `canReadTimesheetSettings`

1.13.0 (Q1): with `privatePay` on, a timesheet is read by the person, their reviewers (line manager, admins) and a manager with operatives access for an operative's sheet (`canViewPayOf`).

### `allow create, update`

Everything else (jobTypes, tradeTypeInventory, variationTrades, variation logs, and any new company-wide setting) is admins and managers only. Operatives never write it.

## `/databases/{database}/documents/organizations/{organizationId}/managers/{managerId}`

### `allow create, update`

A manager's pay is changed by admins only (never by the manager or another manager). 1.12.0 (H3): a new row is staff only (a job form adds the row for a manager it names); an existing row's email changes by admins only.

## `/databases/{database}/documents/organizations/{organizationId}/notifications/{notificationId}`

### `actorUserIdValid`

Rulebook §13: `actorUserId` (who caused the row) is optional; when present it is the signed-in user, so nobody can silence another person's push by naming them the actor.

### `notificationRecipientIsMember`

Rulebook 1.12.0 (H4, organizationMemberActive): a row is addressed to a member of this organisation — a key of its members map, its creator, a users document of this organisation, or a person with a membership here. Never a uid from anywhere on the platform, and never a row without `userId` (§13: not an inbox row).

### `allow read`

Inbox queries userId == signed-in user. Fan-out create stays org-member.

## `/databases/{database}/documents/organizations/{organizationId}/materials/{materialId}`

### `allow update`

The status branch goes first: it fails fast on any other field, and the rule stays under the 1000-expression limit when a Send status write carries write metadata (1.9.0).

## `/databases/{database}/documents/organizations/{organizationId}`

### match `/holidayBookings/{bookingId}`

Annual leave. A requester asks (status 'pending') or asks to cancel (cancellationRequestedAt / cancellationRequestedByUserId); only an admin or the requester's line manager decides (status 'approved' / 'rejected', approvedByUserId, approvedAt, decisionNote). When the requester has no line manager, or the row has no users document (legacy operativeId-only row), an admin decides (never any manager). People who book their own leave (lib/canonical canSelfBookAnnualLeave: annualLeaveSelfBook outside operative mode, or the organisation's Super Admin — rulebook 1.28.0) save it approved. Both apps resend every field with setData merge, so decision fields count only when the value really changes (null, missing and a sub-second timestamp round-trip are the same).

## `/databases/{database}/documents/organizations/{organizationId}/holidayBookings/{bookingId}`

### `hbIsAdmin`

Members-map admin first (one get), then the users-document admin of this company. 1.13.0: every rule here passes canAccessOrganization first (billing included), so these skip it.

### `hbIsStaffManager`

Staff (lib/canonical/staffAccess.ts isStaffAccount): admin of this company, or a manager not in operative mode. Membership is already checked by canAccessOrganization on every rule below.

### `hbCallerIsOperative`

The caller's own users document says operative mode (no document: not operative). 1.11.0: an admin has no operative mode (permissionLevelOf), so a stray flag on an admin does not count.

### `hbCanDecide`

lib/canonical/leaveRequests.ts canDecideLeave: never the requester's own request (admins included). The requester's line manager; otherwise an admin not in operative mode. With no line manager (legacy data) the request waits for an admin — never any manager (rulebook 1.3.0). 1.31.0: an operative is never a line manager (hbCallerIsOperative), even with an old id stored on the request.

### `hbCanDecideBeforeAndAfter`

hbCanDecide(resource.data) && hbCanDecide(request.resource.data), with the admin test evaluated once (1.13.0: keeps the update under the 1000-expression limit once the billing test is in canAccessOrganization).

### `hbCallerSelfBooks`

lib/canonical canSelfBookAnnualLeave (rulebook 1.28.0): the self-book flag (Annual Leave Management) outside operative mode, or the organisation's Super Admin (callerIsSuperAdminOf: its creator, or a super admin users document of this organisation). Having no line manager never self-books anyone, admins included (their request waits for the other admins). 1.30.2: the flag is read for this organisation (orgSelfManageFlag: the users document of this organisation, else the membership here), never the caller's users document of another company.

### `hbOwnerShapeAllowed`

A request (pending, no decision) or, for a self-booker, their own approved booking.

### `hbKeySame`

Only a key that really changed is compared (null, missing and a sub-second round-trip are the same).

### inside an expression (`(hbDecisionUnchanged(changed) && hbDatesUnchanged(…`)

Ask to cancel (or withdraw that ask), or any edit that leaves decision and dates alone.

### inside an expression (`((resource.data.get('status', null) == 'pending' |…`)

Edit a pending request, or a self-booker edits their own booking.

### inside an expression (`(hbIsRequestShape(request.resource.data) && hbIsSt…`)

A manager on the Team screen books a request for someone with a line manager: it waits there.

### `allow delete`

Approving a cancellation (or a Team-screen removal, or an admin cleanup) deletes the row: only someone who may decide this person's leave (hbCanDecide: never their own, admins included). The requester may withdraw a pending or declined request; a self-booker may remove their own.

## `/databases/{database}/documents/organizations/{organizationId}`

### `managerMayChangePayOf`

Pay change on another path than users/{uid}: the person never changes their own pay (lib/canonical/payAccess.ts canChangePersonPay; payRate.ts reads rate history first, then the live profile). Admins, the platform owner, or a manager with operatives access for an operative in this company (managerMayManageOperative, the same test as canManagerUpdateOperativeProfile). Cheapest tests first: the 1,000-expression limit.

### `canChangePayOf`

A manager-with-operatives write implies membership: the caller's users/{uid}.organizationId is the subject's, which is this company. Admin of this company is checked members map first.

### `payUserPath`

Rulebook 1.13.0 §8 / §16 (Q1, lib/canonical canViewPersonPay): who may see a person's pay — rates, pay basis, employment type, rate history, timesheets and invoices. `subjectId` is a users id, or an operatives row id for a catalogue operative with no account. Admins of this organisation; the person (their uid, or a users document on their signed-in email); their line manager (listed on their users document; the caller is a current member); a manager with operatives access, for an operative of this company; for a catalogue row, admins, operatives managers and the person on its email. The platform owner too.

### `payRowLinkText`

Rulebook 1.27.0 §8 / §16 (owner decision 7, lib/canonical catalogueOperativePaySubjects): a catalogue operative is an operatives row with no app account — no users document of its id (the callers check), no stored `linkedUserId` / `userId` / `uid`, and no email claim of this organisation (`userEmails/{email}`) on its email. Managers with operatives access read a catalogue operative's pay profile and rate history; an operatives row that belongs to an account is read through that account (canViewPayOfUser), never through the row.

### `canViewPayOfAsMember`

The non-admin half of canViewPayOf, for rules that already checked membership and admins (it keeps them under the 1000-expression limit).

### `canChangePayOfSubject`

Writes: `canChangePayOf` for a users subject; for a catalogue row, admins and operatives managers (not their own row).

## `/databases/{database}/documents/organizations/{organizationId}/payProfiles/{subjectId}`

### `allow list`

A whole-collection query is for admins (and the platform owner); everyone else reads one document by id.

### `invitedPayCopyFields`

Rulebook 1.27.0 §8 / §11 (owner decision 6, lib/canonical invitePayProfileCopyWrite): while `privatePay` is on, the person accepting an invitation creates their OWN pay profile once, as an exact copy of the pay profile of their invitation's placeholder. The rule checks: the document is the caller's (`subjectId` is their uid) and does not exist yet (create only, never update); `privatePay` is on for this organisation; the email claim `userEmails/{token email}` still names a pending placeholder of this organisation on the same email (`inviteClaimIsPendingPlaceholder`, the test the invitee's own users create uses), which is not the caller; `payProfiles/{placeholderId}` exists; and every pay field written equals that profile's (a missing field stays missing or null). So nobody can set or raise their own pay: they can only take what an admin or operatives manager wrote for their invitation, before the claim moves to their account.

## `/databases/{database}/documents/organizations/{organizationId}`

### match `/operativeProfiles/{userId}`

Mirror of users/{userId} pay and line manager (iOS saveOperativeProfileMetadataFallback, web saveUser). iOS reads it over users/{uid} on roster load. Anyone in the company may touch only the id and write stamps; pay, line manager and employment fields are canChangePayOf. Only keys whose value changes count, so a resend of the same values passes.

## `/databases/{database}/documents/organizations/{organizationId}/operativeProfiles/{userId}`

### `allow read`

1.13.0 (Q1): with `privatePay` on, only the people who may see this person's pay.

## `/databases/{database}/documents/organizations/{organizationId}`

### match `/operativeDayRateHistory/{entryId}`

Effective-dated pay rows { userId?, operativeId?, dayRate, payBasis?, effectiveAt, createdAt }. userId names a users document; an operativeId-only row is an operatives/{id} record. Never a row about the writer themselves (unless an admin, who may already set their own pay on users/{uid}). Rows are not re-pointed at another person.

## `/databases/{database}/documents/organizations/{organizationId}/operativeDayRateHistory/{entryId}`

### `rateRowOperativeIsCaller`

The operatives row is the caller's own when its email is the signed-in email.

### `managerMayRecordOperativeRow`

Manager with operatives access in this company, for an operatives row that is not theirs.

### `canViewRateRow`

1.13.0 (Q1): with `privatePay` on, a row is read only by those who may see its person's pay. A query by anyone but an admin must name the person (`userId ==` or `operativeId ==`).

## `/databases/{database}/documents/organizations/{organizationId}`

### match `/acceptedBookingClashes/{clashId}`

Accepting a clash is a staff warning decision (lib/canonical/staffAccess.ts canViewStaffWarnings, scheduleSources.ts acceptedClashWriteFields): admins and managers only, never operative mode.

## `/databases/{database}/documents/organizations/{organizationId}/acceptedBookingClashes/{clashId}`

### `allow delete`

Un-approving a clash: the same staff who may accept it.

## `/databases/{database}/documents/organizations/{organizationId}`

### match `/warningResolutions/{resolutionKey}`

Approved or dismissed warnings (lib/canonical/scheduleSources.ts warningResolutionWriteFields). Document id is the warning's resolution key. Undoing an approval deletes it.

## `/databases/{database}/documents/organizations/{organizationId}/warningResolutions/{resolutionKey}`

### `allow create, update`

Approving or dismissing a warning is staff only (canViewStaffWarnings): admins and managers.

### `allow delete`

Un-approving: the same staff who may approve, whoever approved it (rulebook 1.2.0 decision 5).

## `/databases/{database}/documents/organizations/{organizationId}`

### match `/dismissedWarnings/{dismissKey}`

Dismissed warnings (expired qualifications). Document id is the canonical dismiss key.

## `/databases/{database}/documents/organizations/{organizationId}/dismissedWarnings/{dismissKey}`

### `allow create, update`

Rulebook §16 / 1.9.0: only admins and managers dismiss a warning (the same staff who accept clashes).

## `/databases/{database}/documents/organizations/{organizationId}`

### match `/fileReports/{reportId}`

Report a problem with this file (lib/canonical/fileReports.ts). Anyone in the organisation files a report as themselves; only admins and the platform owner read and close them. Reports are never deleted.

### match `/variations/{variationId}`

Variations are not covered by the read-only catch-all below. Admins and managers read and write every job. Operatives never do. Hard delete is denied; rows are soft-deleted.

### match `/{collection}/{document=**}`

Unknown subcollections: allow org-scoped read fallback only. Keep writes explicit per known subcollection rules above.

## `/databases/{database}/documents/organizations/{organizationId}/{collection}/{document=**}`

### inside an expression (`!(collection in ['projects', 'smallWorks', 'bookin…`)

1.10.0 round 2: job and booking reads are enforced above (§17); never re-opened here.

### inside an expression (`!(collection in ['payProfiles', 'operativeDayRateH…`)

1.13.0 (Q1): pay and timesheets have their own read rules (canViewPayOf); never re-opened here. `settings` also stops re-opening variation settings to non-staff (its own rule already refuses them).

### inside an expression (`!(collection in ['overtimeRequests', 'overtimeRevi…`)

1.29.0: overtime requests, reviews and reports are the person's, their line managers' and admins' only.

### inside an expression (`!(collection in ['priceWorkItems', 'expenseItems',…`)

1.30.0: price work, expenses and their reports have their own read rules; personal site audits are the owner's only.

## `/databases/{database}/documents`

### match `/productFeedback/{suggestionId}`

Shared product ideas board — every signed-in organisation can read and submit. The owner console (info@projectplanner.us) can hide, merge, and write private notes.

### match `/platformConfig/{id}`

Rulebook 1.12.0 (§18, appUpdateRequired): `platformConfig/app` { minimumIosBuild, minimumWebVersion? } is read before sign-in (the forced-update gate), so anyone reads it; the rest (toolbox library) stays signed-in. Only the platform owner (verified token email) writes.

### match `/interestRegistrations/{id}`

Interest registrations are created only by the website Admin API. Clients cannot write this collection.

### match `/emailSuppressions/{email}`

Marketing suppression list. Admin API only — no client reads or writes. There is no root catch-all; this match is explicit so the collection is never world-readable.
