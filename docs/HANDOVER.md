# Handover — 5 Nov 2026 (updated end of second chat)

This file hands the work over from one long Claude Code chat to new chats. A new chat starts with no memory: **read this file first**, then `docs/OWNER_DECISIONS.md`, then the repo rule files (`CLAUDE.md`, `AGENTS.md`, `docs/RULEBOOK.md`, `docs/agent-rules/*`). Update this file at the end of every chat so the next one can carry on.

Launch target: **end of November 2026**. Agreed 5 Nov: **no new features after 1.34** (feature freeze), then only fixes, testing, account tasks and the App Store (when the owner says go).

Live launch checklist (the owner ticks items there; Claude updates rows as work merges): https://claude.ai/artifact/7Q7erHuNW9RBFFK4VuiAcR — its database collection is `items` (sections 1–6; close-out rows `i1-33`…`i1-36`).

---

## 0a. 6 Nov update (third chat) — read before §0

| Item | State |
|---|---|
| Rules 1.32.1 | **Live** [Certain]: verified through Google's API on 6 Nov. The `cloud.firestore` release points at ruleset `ce5ba57d…` (made live 12:12:05 UTC), and it is byte-identical to `main`. The console said "Error saving rules – An unknown error occurred", but the publish had worked. The earlier CLI 409 / 503 messages may also have hidden successful publishes. |
| How to publish from now on | Publish once, then always check what is live (`docs/firestore-rules-notes.md` → "After publishing: check what is really live"). Never press Publish again just because of the error. If a newer uploaded ruleset matches `main` but is not live, point the release at it with `releases.patch` (it does not compile again). |
| Rules 1.32.2 (PR #285, `main-wom3p1`) | Compile cost 383,790, below the new 395,000 CI budget. No allow/deny change: suites 223/223; strict list identical (43/43); type check 0 issues; independent review found no change. CI adds a compile-cost budget and a `rules-typecheck` job. CI is green. Waiting for the owner to approve the merge, then the owner publishes it and checks the live release. |
| Booking self-book fix (PR #284) | Merged. `deleteField()` sentinels are stripped from creates (`createWritePayload`). The owner has not yet confirmed that admin self-booking from Daily Overview works. |
| Web 1.33 prompt | The owner has a prompt file "Web agent prompt: 1.33 additions" (overtime Submit → Return flow, claims and overtime PDFs, Payrun Snapshot proposal). Its item 0, the rules publish, is done by 1.32.1 being live and by #285. Paste the rest into a new chat. |
| Open | Dependabot PRs #279–#283 need review before launch. iPhone 1.31 + 1.32 (iOS #193, #195) are merged but not released. Raise `minimumIosBuild` after the iPhone release. Delete `docs/rules-cost/1.30.2-plus-critical.rules` (1.32.1 is confirmed live). |

## 0. Current state and next steps (end of second chat, 5 Nov) — overrides §1–§2 where they differ

**Done in the second chat**
| Item | State |
|---|---|
| Rules 1.31.3 | Merged (#278) and **published by the owner**. Compile cost 431,665 vs 1.30.2's 525,898; suites 220/220; strict 47 vs 49 (none new); independent review clean. |
| Web + rules 1.32.1 | Merged (#274; 1.32.0 + the 1.31.3 restructure + `orgAdminEither`). Suites 223/223; strict 43 vs 45; independent review clean. Owner published the 1.32.1 rules ("I think" — **confirm**: the console Rules tab contains `orgAdminEither`). Web deploys from `main` automatically. |
| Web Home #276 | Merged after updating to 1.32.1 and the owner's look at the preview ("looks ok for now"). Screenshots were not re-taken (no Firebase config in the cloud container). |
| Handover + working style | This note, and `docs/agent-rules/owner-working-style.md` (imported by `CLAUDE.md`, so every chat loads the owner's standing instructions). |
| Launch checklist | Close-out A done; B in progress. |

**Next, in order (a new chat with BOTH repos attached — owner decision 5 Nov: web + iOS in one chat, as before)**
1. **iOS 1.31 + 1.32** in `project-planner-ios`: run `scripts/sync-rulebook-from-web.sh` (rulebook 1.32.1); Gap Report first and stop for the owner's approval; then build. Scope: the 1.31.0 iOS follow-ups (changelog 1.31.0 "iOS follow-up" line and `docs/ios-handoff/v1.31.*.md`), the 1.32 work in `docs/ios-handoff/v1.32.0.md` (overtime one Approve / partial approval, claims review `payeClaimReviews`, multiplier at create, `canBookOtherLocationsFor`, Weekly report admin-only, PAYE payday banner + main Save, "Rules x.y.z" footer, `legalPackAcceptanceWriteFields`, `invitationListConstraints`, pay visibility `canViewPersonPay` / `reportPayForViewer`), and the 1.30.2 / 1.30.3 iOS items still open. An owner rule to fix in iOS too: never delete leave when Annual Leave Management changes (`HolidayStore.deleteSelfBookedApprovedHolidaysFor` / `deletePendingHolidayRequestsFor`). Independent review; push only to `main-vr2rt0-uoqzwv`.
2. Owner raises `minimumIosBuild` once the iOS 1.32 build is on TestFlight (send steps; see #274 "minimumIosBuild needed").
3. Owner questions still open (§6); 1.32 judgement calls 2–6 in `OWNER_DECISIONS.md`.
4. Then §4: 1.33 → 1.34 → My Profile → bug fixes → feature freeze, one chat each.
5. Follow-ups from this chat: put the compile-cost / type-check / strict-budget checks into CI; `docs/rules-cost/1.30.2-plus-critical.rules` (the fallback) can be deleted once 1.32.1 is confirmed live; the 2,872-case grid harness was lost (rebuild only if needed).

**Environment notes for cloud chats**: `npm ci` fails (the `xlsx` tarball on cdn.sheetjs.com is blocked) — install with `xlsx` temporarily removed from `package.json` and restore both files afterwards; `weeklyReportExport.test.ts` then fails locally only. Firestore emulator for the rules suites must use port 8080 (`firebase emulators:exec --only firestore --project demo-project-planner-rules "tsx --test tests/firestore.rules.test.ts tests/overtime.rules.test.ts tests/payeClaims.rules.test.ts"`).

## 1. Where things stand (5 Nov, end of the long chat)

| Item | State |
|---|---|
| Live Firestore rules | **1.30.2** (old). 1.31.1 / 1.31.2 are merged on `main` but the owner **cannot publish them**: Firebase console says "unknown error"; CLI `firebase deploy --only firestore:rules` gets `503` from `firebaserules.googleapis.com/...:test` after ~6 s (firebase-tools 15.34.2). Diagnosis below (§3). |
| Web `main` | `c18915a1` — rulebook **1.31.2** (#275). |
| iOS `main` | `019ea0a` — rulebook **1.31.1** mirror (#191). iOS UI upgrade (#186, #190), legal gate fix (#189), sweep (#188) merged. |
| Web PR **#274** `web-1.32` | Rulebook **1.32.0** (overtime and claims review, multiplier at create, PAYE payday, pay visibility, Weekly report admin-only, includes 1.31.2). Fully reviewed, CI green at `2bac1b2a`. **Held until the rules publish works** (its rules must also pass the Google compile — see §3). |
| Web PR **#276** `web-home-dashboard` | New web Home / sidebar / top bar (UI only + 3 tested shared set-up moves). Independent review: no blockers; its should-fix (Tasks card header) fixed in `7dc0ee6d`; owner confirmed all 7 judgement calls (`7d7fb01b`). CI green. Draft. **Merge after #274**, rebased onto `main`; then re-take screenshots. Its base on GitHub is `main`, so until rebased its diff also shows the 1.32 commits. |
| Rules compile-cost work | Branch **`web-rules-1313`** at `b4b5db08` (not a PR yet, **do not merge as is**): a candidate `firestore.rules` (booking create/update/delete merged per collection, 79 helpers inlined) — emulator type check 0 issues, static compile cost **465k** vs 526k live 1.30.2 and 607k 1.31.2 — but the rules test suites, the expression grid and the expression budget are **not yet verified**. Tools in `scripts/rules-cost/`, evidence and next steps in `docs/rules-cost/README.md`, fallback file `docs/rules-cost/1.30.2-plus-critical.rules` (type check clean; its suites not run yet). See §3. |
| Functions | Owner deployed `functions:inbox-push` successfully (5 Nov). |
| Open PRs on iOS | none. |
| Owner decisions not on `main` yet | The 5 Nov rows are in `docs/OWNER_DECISIONS.md` on the PR branches, not on `main`: on `web-1.32` (#274) — Weekly report admin-only, 1.32 judgement calls, removal of `mergePlaceholderUser.ts`; on `web-home-dashboard` (#276) — the 13 Home decisions, the 7 Home judgement calls A–G (owner: "all 7 are fine, keep them"), and **manager Daily Overview team-only (1.33)**. Read them there until those PRs merge. |
| Stale processes | This chat's local git worktrees and scratch files go when the container goes; everything needed is pushed to the branches named here. |

## 2. Close-out plan (agreed 5 Nov) — do these in order

**A. Rules live (top priority — 1.31 and 1.32 are blocked on it)**
1. Finish the lighter rules **1.31.3** on `web-rules-1313` (§3): no decision changes, compile cost clearly below live 1.30.2, `firebase.suites.json` / rules tests all pass, emulator type check (PUT `securityRules`) clean, rules budget (`scripts/rules-budget.json`) respected.
2. Independent review (safeguard C), PR, merge. Rulebook patch bump + changelog + `npm run build:canonical` + `npm run rulebook:handoff` as `CLAUDE.md` rule 6 requires (rules change).
3. Send the owner **console publish steps** (beginner, step by step): `cd ~/Developer/project-planner-web` → `git pull` → `pbcopy < firestore.rules` → console.firebase.google.com → project `project-planner-f986c` → Firestore → Rules → select all, paste → **Publish**. Then a 2-minute app check (sign in, open Home, open a booking, Manage Users).
4. If Google still refuses: owner publishes the **fallback** (`docs/rules-cost/1.30.2-plus-critical.rules` = live 1.30.2 + B1/B2/F1/F2 security fixes; F1/F2 closes a **live** hole: an operatives manager can ADD privilege keys to a users doc because 1.30.2 only checked changed keys). Run its suites first.

**B. 1.32 live**
5. Rebase #274 on the new `main` (its `firestore.rules` must get the same compile-cost treatment and pass the console type check), re-run CI, merge.
6. Owner publishes the 1.32 rules (same console steps).
7. Build **iOS 1.32** from the hand-off (`docs/ios-handoff/LATEST.md` on `web-1.32`): overtime UI (one Approve, per-line outcomes, `overtimePersonIds`, `overtimeEditableUntil`), claims review (`payeClaimReviews`), multiplier at create (`overtimeMultiplierCreateFields`), `canBookOtherLocationsFor`, `reportPayForViewer` / `canViewPersonPay` context, `overtimeMultiplierMoveFields`, managers' site booking rate, **Weekly report hidden for non-admins** (quick actions, menu, deep links, Manage Users / Add User toggle rows), PAYE payday banner + main Save, "Rules x.y.z" Settings footer, `legalPackAcceptanceWriteFields`, `invitationListConstraints`. Run `scripts/sync-rulebook-from-web.sh`; Gap Report first; independent review; push iOS only to `main-vr2rt0-uoqzwv` (force-with-lease, restarted from `main` after the previous PR merged).
8. Owner raises `minimumIosBuild` (Claude sends steps) **after** the iOS 1.32 build exists.
9. Rebase #276 onto `main`, re-take screenshots (1440 / 900 / 390, light and dark, admin / manager / operative), merge.

**C. Close the chat** — update this file and the checklist, give the owner the start prompt for the next chat.

**D. One new chat per release** — 1.33, then 1.34, then My Profile, then bug fixes → **feature freeze**.

## 3. The rules publish problem (read before touching `firestore.rules`)

- Google's rules compiler gives up (503 / "unknown error") when compile work is too high. [medium-high confidence] ~70% of compile time is the semantic type check (`TypeCheck → UserDefinedFunctionResolver`), which re-resolves each function body at every call site. **Cost tracks the fully-inlined expansion of all allow and function roots, not file size.** Measured (in-process compile, emulator's compiler, min of 5, ±10%): live 1.30.2 ≈ 2.2–2.6 s (metric ≈ 526k); 1.31.0 ≈ 2.6 s (549k); 1.31.2 ≈ 2.75–3.1 s (607k); fallback ≈ 2.7 s (about the same as 1.30.2 — marginal; 1.30.2 itself needed retries). Candidate on the branch: 465k (merged booking allows, inlined helpers); aim ≈ 420k or less (25–30% under 1.30.2) for a safe margin, then verify suites, grid and budget.
- Separate, already fixed in 1.31.2: Google's **static type checker** rejects passing a literal `null` into a function that uses the parameter as a map or number. The emulator's `PUT /emulator/v1/projects/<p>:securityRules` reproduces it offline. **Every rules release must pass that check and the compile-cost check before the owner is asked to publish** (add both to the release process — follow-up).
- Changing structure also changes runtime expression counts (1,000-expression limit; logical deny vs LIMIT): re-run the grid and probes.
- **Candidate status at hand-over (b4b5db08), what the next chat must do first:**
  1. The two WIP commits were made with `--no-verify` (the hook refuses a `firestore.rules` change without the rulebook bump and hand-off). Before a PR: rulebook patch bump 1.31.3, changelog, `npm run build:canonical`, `npm run rulebook:handoff`, normal commit.
  2. Rules test suites have **no result yet**: the run failed on ports (tests hard-code emulator port 8080; the agent's emulator was on 8313), so all 221 failed with ECONNREFUSED. Re-run on 8080 (`npm run test:rules`, also `RULES_STRICT_BUDGET=1`).
  3. **Expression counts rose** although no allow/deny result changed: e.g. "admin edits users doc" 774 → 1287, "operatives manager edits operative user" 754 → 1296 (summed coverage; likely the inlining). Risk: new 1,000-expression LIMIT refusals at runtime. Do not ship until the strict suite and the grid show no new limit denials; if they do, back out the inlining of the users-path helpers and keep only the booking-allow merge, then re-measure.
  4. Probe families a, c, d, e match `c18915a1` (only the d7 race of two simultaneous accepts differs; "both allowed" still 0/8). Family f and the 2,872-case grid were unfinished (1,100 done) — re-run with `scripts/rules-cost/`.
  5. Cost: candidate 465,434 (~2.0 s) vs 1.30.2 525,898 (2.2–2.6 s), 1.31.2 606,643 (2.75–3.1 s), fallback 529,018 (~2.7 s).
  6. Not done: port the result to `web-1.32` (#274), update `docs/firestore-rules-notes.md` (79 inlined helper names no longer exist). Not proven: that Google's server runs the same compiler under a fixed deadline.
  7. **The fallback leaves open** (the full 1.31.x fixes close them): S1 re-creating your own profile can set own pay / line manager / level; S3 operatives-manager creates (alias ids, `hasNoLineManager`, someone else's email) and their email-claim writes; S4 roster row account links; F5 invitation proof on accept; B-1 operatives managers see, delete and create other people's invitations; an accept can copy a placeholder above the invitation's level; self-delete; F4, F11/F12, F2 (own employment type), F9; typed privilege values (a string `'true'`). Its suites have not been run. Use it only if the candidate cannot be made to publish.
- Full details, tools and the exact next steps: `docs/rules-cost/` and `scripts/rules-cost/README.md` on branch `web-rules-1313`.

## 4. After 1.32: the remaining releases (each in its own chat)

**1.33** (rule release, web → iOS → rules; owner rows in `docs/OWNER_DECISIONS.md`)
- A manager's Daily Overview shows only their own team (people they line-manage, and themselves): booked, leave, unbooked, hours — matching Warnings and Book labour. Admins and the Super Admin see every user and every subcontractor booking. (row 5 Nov, owner yes)
- **Cancel removed** as a user action (Book / Edit / Delete only; old Cancelled bookings stay hidden; no data change).
- **PAYE overtime ✕ on an all-overtime day** → request to line manager + admins; on approval the booking is **deleted**; approving line manager may delete that one booking.
- **iOS offline delete** (queues with tombstone, "Pending sync", undo; refused replay if changed elsewhere).
- Candidates to bundle (rule release items already decided): materials catalogue admins only (`canManageMaterialCatalogue` on iOS has its own role check); nobody switches off their own Annual Leave Management toggle (after iOS changed-fields-only saves); web `setUserActive` bare membership + cross-org `isActive` write; `preferFinishedAccount` lets inactive users through (warningRows.ts:410); web clash check compares `operativeId` with letter case (`lib/scheduling/bookingClashUtils.ts:151`).
- If the owner says "fix before launch" for pay records (open question §6): pay-visibility rules narrowing.

**1.34** — **ghost operatives** (owner design "ghost: all recommended", row 4 Nov): operative with no app login, created by admins and Operatives-toggle managers, admins notified; first/last name, trade, day or hourly rate required; phone optional; no email/invite; line manager required. Ghost upgrade uses the invite route (operatives managers cannot add an email to an operative — 1.31.1).

**My Profile UI upgrade (iOS + web)** — owner-confirmed metrics: hours this pay run, annual leave left and pending, next booking, timesheet status, qualifications expiring, own rate (self-employed only). Rulebook functions only; same rules on both apps; iOS opened from the Home screen.

**Bug fixes (allowed after the freeze)**
- Operative "Tasks due today / N pending" (`homeOverviewMetrics`) counts a task the Tasks page "To do" list does not show (`isTaskAssignedToUser` vs the metrics rule) → one shared "tasks assigned to this person" rule. Visible on the new Home as "1 pending in total" under "Nothing to do".
- Up next shows raw slot ids ("07:30 · FULL_DAY") — `lib/home/upNext.ts`.
- Help "Home tiles" (`components/help/HelpSupportScreen.tsx`) describes the unused `/dashboard/edit` editor.
- Web projects / small works list spacing (row 4 Nov, web only).
- Web week grids use the browser week in 11 files → shared organisation-week rule (sweep FU-4; iOS Scheduling same).
- Web rate/fallback code picks one operatives row (`EditUserProfile.tsx`, `weeklyReportPayroll.ts`, `timesheetExport.ts`, `scheduleNavigation.ts`; FU-5).
- iOS "No operative profile is linked" for an operative with a login but no Operatives row (row 4 Nov, #262 judgement call — owner to confirm).
- Possibly: operative's Up next showed "No upcoming bookings" while booked today (unverified; may be by design).

**Follow-up security PR (before launch)** — admin-path privilege typing, `membersValuesTyped`, canonical `permissionLevels` strict, the remaining tests refused by the 1,000-expression LIMIT instead of logic (row 4 Nov), c5 limit refusals.

**Other follow-ups** — operatives-manager resend vs admin-sent invite link (owner question later); iOS changed-fields-only self-save headroom; functions region/outdated warnings in deploy output; provisional placeholder and `parsedWithoutRulebook` gate gaps; add the console type check + compile-cost check to the rules release process; iOS `HomeView.swift` may adopt the new web Home look later (visual only); stale rows to tidy in `OWNER_DECISIONS.md` (#186 rows still say "open" though #186/#190 merged).

## 5. Switch-ons and owner tasks (owner does these by hand)

- Publish rules (A), publish 1.32 rules (B), raise `minimumIosBuild` (after iOS 1.32 ships).
- Turn on **enforcedReads** and **Private pay** (`platformConfig/app`) — before launch, Claude sends steps; Private pay needs `minimumIosBuild` ≥ the iOS build with changed-fields-only saves.
- Run the blank-manager clean-up script (checklist 1.27) and the old-records clean-up (#242).
- Delete the old email function after `minimumIosBuild` is raised.
- Account security (checklist section 4): 2FA on GitHub, Google, Resend, Netlify, Stripe; change the info@ password; check who has access; Resend domains + DMARC; ask the wholesaler to allow-list projectplanner.us; Data health "Fix all"; invite email in Gmail dark mode; full test of both apps.
- Test list (checklist section 6, 20 items) and the combined 1.31/1.32 checkpoint test list (Claude writes it).
- On-device checks from 5 Nov: privacy screen no longer flashes at launch; Book people / Book a Sub same height; "Cancel" word not "C"; Home icon grid aligned.
- App Store work is **parked** until the owner says "lets get ready to launch to app store".

## 6. Questions still waiting for the owner

1. Pay records: "accept for now" or "fix before launch"? (If fix: pay-visibility rules narrowing in 1.33.)
2. 1.32 judgement calls (`OWNER_DECISIONS.md` "1.32.0 judgement calls"): separate `payeClaimReviews` documents; own overtime as a request applies to admins with a line manager too; PAYE payday banner placement and Payment runs not refusing Save; removal of `mergePlaceholderUser.ts`.
3. #262: operative with login but no Operatives row is booked under their users id (iOS shows "No operative profile is linked").
4. Silence so far = keep: the 5-second legal-gate grace on iOS; the Home icon glyph box.

## 7. How the owner works (standing instructions — follow every time)

Now also in `docs/agent-rules/owner-working-style.md`, loaded automatically by `CLAUDE.md`; that file wins if they differ.


- **Every change considers web, iOS and the shared rule**: a 3-factor table (rows Web / iOS / Shared rule) in every brief and PR.
- **End every message with a status line**: ⏳ Waiting on / Next / Your move.
- **Beginner step-by-step Terminal instructions.** Folders: `~/Developer/project-planner-web` and `~/Developer/project-planner-ios`. Firebase project: `project-planner-f986c`.
- Numbered lists with context; never terse info without context. Plain English (the owner is not a developer).
- Advisor rules (`docs/agent-rules/advisor.md`): don't open by agreeing; tag claims [Certain] / [Likely] / [Guessing]; never "Great question", "You're absolutely right", "That makes a lot of sense", "Absolutely", "Definitely"; show evidence.
- Decisions that change pay or who sees what go to the owner; record every answer in `docs/OWNER_DECISIONS.md`.
- Safeguards A–F (screen map, PR checklist CI, **C: independent review before every merge**, shared test scenarios, weekly drift check, checkpoint test lists). Merge bar: every review finding fixed and no regression versus the live/previous version; new pre-existing holes go to the follow-up security PR.

## 8. Hard constraints

- Never hand-edit `canonical-business.js`, its `.sha256`, `canonical-manifest.json` or the iOS `docs/RULEBOOK.md` mirror; iOS syncs with `scripts/sync-rulebook-from-web.sh`.
- Firebase rules and functions are deployed **only by the owner, by hand**, when Claude says so. No automated deploys.
- Never touch production data, billing, signing, TestFlight or the App Store.
- No model identifier in commits, PRs or code. Commit trailers: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` plus the chat's `Claude-Session:` URL. PR bodies end with "🤖 Generated with [Claude Code](https://claude.com/claude-code)" and the session URL; GitHub comments end with the Claude Code footer.
- Never use a bare `git stash`. Keep secrets out of chat and code. **Never revoke push key BSA6D294ZA.**
- iOS pushes go only to `main-vr2rt0-uoqzwv` (force-with-lease, restarted from `main` after the previous PR merged). PRs only when needed for the plan above; never merge without the independent review.

## 9. Useful references

- Design pack for the web Home: `docs/design/dashboard-ui/` (spec, reference HTML, original prompt).
- Screen map: `docs/SCREEN_MAP.md`; tokens: `docs/DESIGN_TOKENS.md`; guardrails: `docs/agent-rules/platform-guardrails.md`; UI-only touch-ups: `docs/agent-rules/ui-touch-up.md`.
- Other artifacts: Launch To-Dos https://claude.ai/artifact/Fge9XQGWiwankCX6CqZpse, Launch Readiness https://claude.ai/artifact/L2d1DHcP63JAbQx3RVkYGu, PAYE Overtime Plan https://claude.ai/artifact/5i9UkSqfSCRV83TKCytedE (the Launch checklist above is the one kept current).
- Previous chat transcript (only on the old machine, may be gone): session `9a37d571-f255-53d0-a46f-9e1f91f626a0`.
