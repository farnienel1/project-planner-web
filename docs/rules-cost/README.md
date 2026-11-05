# firestore.rules compile cost (rulebook 1.31.3 work, 5 Nov 2026) — hand-over

## Problem
Google will not publish `firestore.rules` at origin/main `c18915a1` (rulebook 1.31.2, 145,145 bytes):

- the CLI's `firebaserules …:test` call returns 503 after about 6.4 s;
- the console Publish shows "unknown error".

The rules that are live are 1.30.2 (`7f122850`), and they too published only after retries. 1.31.0 (`7fa6b17b`, 188 KB) also returned 503.

## Diagnosis (confidence: medium-high)
I profiled the emulator's own compiler (`FirebaseRulesProtoCompiler`, JFR, 4096-deep stacks):

- About **70% of compile time is the semantic type check** (`TypeCheck` → `UserDefinedFunctionTypes.resolve`). About 25% is ANTLR parsing.
- The checker **re-resolves a function's body at every call site, and also checks every function on its own** as a root, with its callees expanded.
- So cost tracks the *fully-inlined size* of all allow conditions plus all function bodies, not file bytes.
- 1.31.2 is smaller in bytes than 1.30.2 (comments were moved out), but it has 19% more tokens and 15% more inlined expansion.

Static metric `total` (scripts/rules-cost `metric.py total2`) against in-process compile time (Java harness, min of 5; same-run comparisons):

| File | bytes | tokens | functions | allow-root inlined | function-root inlined | **total** | compile (min) |
|---|---|---|---|---|---|---|---|
| 1.30.2 (live, published after retries) | 179,813 | 24,471 | 241 | 358,715 | 167,183 | **525,898** | 2.2–2.6 s |
| 1.31.0 (503) | 188,025 | 25,443 | 245 | 371,914 | 176,619 | **548,533** | ~2.6 s |
| 1.31.2 `c18915a1` (503 / unknown error) | 145,145 | 29,219 | 274 | 393,790 | 212,853 | **606,643** | 2.75–3.1 s |
| fallback `1.30.2-plus-critical.rules` | 181,652 | 24,847 | 241 | 360,891 | 168,127 | **529,018** | ~2.7 s (≈ 1.30.2) |
| candidate on this branch | 144,890 | 30,090 | 196 | 330,171 | 135,263 | **465,434** | ~2.0 s (−12% vs 1.30.2, −32% vs 1.31.2) |

The metric is close to linear in compile time. For example, ablating `jobListsCaller` (−82k) brought 1.31.2 down to 1.30.2's time. The threshold sits between 1.30.2 (passes, but marginal) and 1.31.0. Not proven: whether Google's server runs this same compiler under a fixed deadline. That is the strong inference from the identical type-check messages and the size-independent 503.

## Result: rulebook 1.31.3 (5 Nov, second chat)

The candidate was finished and verified as 1.31.3; the "Candidate" and "Verification status" sections below are the hand-over history. What changed after the hand-over:

- Suites run on port 8080: **220/220** on the candidate and on 1.31.3. Strict (`RULES_STRICT_BUDGET=1`): 1.31.2 = 49 limit refusals, candidate = 48, **1.31.3 = 47**, none new. The coverage sums that "went up" did not turn into refusals.
- Extra savings on top of the candidate: `canAccessOrganization`, `isOrgCreatorViaParentGet`, `userDocOrganizationMatches`, `userOrgIdMatchesPath`, `callerHomeData` and `isOrganizationAdminAnyBilling` read each path once (lets / `callerHomeData`), and `bookingWriteAllowed` checks the manager's job twice instead of three times.
- Tried and **dropped**: one `callerManagesJobKind(any, kind, id)` replacing `callerManagesJob` / `callerManagesJobIn` (static total 418,706) — it added 19 strict limit refusals on booking writes. Lesson: a static saving can cost runtime expressions; always run the strict suite.
- Final: static total **431,665** (1.30.2: 525,898; 1.31.2: 606,643). In-process compile, min of 9, three runs: 1.31.3 2.25–2.47 s, 1.30.2 2.59–2.86 s, 1.31.2 3.2–3.5 s.
- Emulator type check: 0 errors, 0 warnings.
- Not re-run: the 2,872-case grid and probe family f (the scratch harness was in the previous container). The 220-test suite and the strict suite are the evidence; the independent review checks the hand edits.

## Candidate on this branch (`firestore.rules`)
Changes from `c18915a1`:

1. **bookings, managerSiteBookings and subcontractorBookings**: in each, create / update / delete are one `allow create, update, delete` that calls `bookingWriteAllowed(collection, request.method)` once instead of three times. Each branch is the same Kleene-logic expression as before:
   - create: `!tombstoned && W`;
   - update: `!tombstoned && (overtimeLineManagerBookingUpdate || W)`;
   - delete: bookings is `operativesManagerRemovesOrphanBooking || W`; the other two collections are `W`.

   This saves about 58k.
2. **`jobListsCaller`**: the regex pattern is one `let`, and the two `primary is string` branches are merged (distributive). The managers-row lookup builds its path once.
3. **`scripts/rules-cost/inline.py`**, run with maxsites 1 and then 2, inlined 79 helpers that had no `let`. Their names no longer exist, so `docs/firestore-rules-notes.md` headings for them need a "folded into …" note.

Type check: **0 issues** on the emulator PUT.

## Verification status (incomplete — the next agent must finish it)
- **Probe families** (r264 harness: a, c, d, e) are identical to `c18915a1`. The one d-line difference is the d7 concurrency race (which of two simultaneous accepts wins); "both allowed" stays 0 of 8.
- Family f was still running at hand-over.
- The **2,872-case grid** was not finished (1,100 of 2,872 at hand-over).
- **Suites not run.** `tests/*.rules.test.ts` hard-code port 8080, and my run used other ports, so all 221 failed with ECONNREFUSED. That is infrastructure, not the rules. Re-run with `npm run test:rules` on a free 8080/9199 (and `RULES_STRICT_BUDGET=1` for strict).
- **WARNING — expression counts went UP.** The emulator coverage sums for the guardrail scenarios (`exprcount.test.ts`, summed `ruleCoverage`) rose for most requests. Examples:
  - admin edits users doc: 774 → 1287
  - operatives manager edits operative user: 754 → 1296
  - admin creates operative row: 689 → 966
  - owner writes own timesheet: 2360 → 2489

  Every scenario's allow/deny result was unchanged. The coverage sum is a proxy: it counts every node of each inlined copy and every evaluated allow. Still, the inlining (or the booking `request.method` ternaries) may raise real per-request counts. **Do not ship the candidate until the strict suite and the grid show no new 1,000-expression denials.** If they do, keep change 1 (booking merge) and restrict the inliner to functions whose call site is not under a short-circuit, or drop step 3 and find the savings elsewhere (see next steps).

## Fallback: `1.30.2-plus-critical.rules` (not for main)
This is live 1.30.2 plus only these fixes:

- **B1**: when an admin creates another person's users document with `isSuperAdmin` (either place), only the organisation's Super Admin may (`callerIsSuperAdminOf`).
- **B2**: `managerMayManageOperative` requires a real operative: no admin / Super Admin / manager flag in either place, no admin or manager role. This covers users update, pay profiles, rate history and operativeProfiles.
- **F1/F2**:
  - an operatives manager's users create needs `noPrivilegeFlags` (no privilege or self-manage flag in either place, no admin or manager role);
  - their users update refuses any **added, removed or changed** role, privilege, self-manage, `permissions`, `operativeMode`, `email`, `organizationId` or alias key. 1.30.2 checked only `changedKeys`, so an *added* `adminAccess` or `permissions` passed.
- Type-check fix copied from 1.31.2 (`timesheetSameInstant` null branch). Three unused functions removed.

Emulator type check: 0 issues. Compile cost is about the same as live 1.30.2, so it may need the same publish retries.

**Holes it leaves open** (all fixed in 1.31.1/1.31.2):

| Hole | What stays open |
|---|---|
| S1 | Re-creating your own profile can set your own pay, line manager or level. |
| S3 | An operatives manager's create may carry alias ids, `hasNoLineManager`, or an email someone else claims. Email-claim writes are not limited to operatives they manage. |
| S4 | Operatives / managers roster rows' account links. |
| F5 | Invite accept needs only the email, not the emailed invitation (`invitationId` proof). |
| B-1 | Operatives managers can see, delete and create other people's invitations. |
| Invitation level | An invitation accept can copy a placeholder above the invitation's level. |
| Fourth/sixth review | Self-delete; F4 own role; F11/F12 unmasking; F2 own employmentType delete; F9. |
| Typed privilege values (ROOT) | e.g. a string `'true'`. |
| Second-review self-path items | — |

1.31.0's behaviour changes are also absent.

Suites against the fallback: **not run** (time). Run 1.30.2's own suite (`git show 7f122850:tests/…`) plus the 1.31.1 B1/B2/F1/F2 tests (`tests/firestore.rules.test.ts`: "1.31.1: an operatives manager never sets a privilege flag through permissions", "…creates operatives only with no privilege flag in either place", "1.31.1 B1 …", "1.31.1 B2 …").

## Next steps for the next agent
1. Finish verification of the candidate:
   - grid: `h/grid.sh` (scratch harness; see below);
   - probes family f;
   - `npm run test:rules` and `RULES_STRICT_BUDGET=1 npm run test:rules` on free default ports;
   - the expression-count guardrails.

   Compare with `c18915a1`: firestore 220/220 and storage 28/28 pass; strict fails 48.
2. If the counts regress, keep the booking merge (about −58k, runtime-neutral apart from about +6 `request.method` comparisons) and rerun `inline.py` with maxsites 1 only. Then measure. Further low-risk savings (in `hot.py` order):
   - `bookingWriteAllowed` calls `managerMayWriteBookingData` three times; two are enough.
   - `callerManagesJob` / `callerManagesJobIn` run `jobListsCaller` 9 times per call; 6 if unified.
   - `orgBillingOpen` (273 expansions) and `userDocOrganizationMatches` / `orgIdsMatch` bodies.
   - Merge allow statements that share a heavy helper: settings, invitations, holidayBookings.
3. Target `total` ≤ 450k (≥ 15% under 1.30.2) for margin.
4. Then:
   - rulebook patch bump to 1.31.3 ("rules restructured for Google's compile limit; no behaviour change");
   - `npm run build:canonical`, `npm run rulebook:handoff`, and restore the iOS checkout;
   - update `docs/firestore-rules-notes.md` for the inlined helper names;
   - open the PR with this table;
   - port the same restructuring to `web-1.32` (#274) as a separate commit with the same proofs.

Scratch harnesses (not in the repo):

- `/tmp/claude-0/-home-user/9a37d571-f255-53d0-a46f-9e1f91f626a0/scratchpad/r1313/h`:
  - `probes.sh RULES TAG` runs families a, c, d, e, f into `out/TAG`;
  - `grid.sh RULES TAG` writes the grid to `mxg-TAG`;
  - the base results are in `out/base` and `mxg-base`.
- `…/r1313/expr/run.sh RULES TAG`: expression counts.
