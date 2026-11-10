# Handover — 10 Nov 2026

This file hands the work from one Claude Code chat to the next. A new chat starts with no memory: **read this file first**, then `docs/OWNER_DECISIONS.md`, then the repo rule files (`CLAUDE.md`, `AGENTS.md`, `docs/RULEBOOK.md`, `docs/agent-rules/*`, especially `owner-working-style.md`). Update this file at the end of every chat.

**Key dates** (owner, 7 Nov)

| Date | What |
|---|---|
| 8 Nov | Owner's flow test of 1.33 (website and iPhone side by side). Partly done; the website parts (B, D, F) are redone now the website is current (10 Nov, §0), and iOS **1.33.1** (iOS #210) is under test now |
| 13–16 Nov | Security switches on: `privatePay` and `enforcedReads` (`platformConfig/app`); Claude sends the steps |
| 14 Nov | **Feature freeze**: only fixes, testing, account tasks and App Store work after this |
| 17 Nov | Full test of both apps |
| 25 Nov | Launch |

Live launch checklist (the owner ticks items there; Claude updates rows as work merges): https://claude.ai/artifact/7Q7erHuNW9RBFFK4VuiAcR — database collection `items`.

---

## 0. Where things stand (10 Nov, open PRs checked on GitHub)

### The website was stuck until 10 Nov

The live website kept serving a version from before 6 Nov until 10 Nov, although `main` had moved on. Netlify has now caught up: on 10 Nov the owner confirmed that My Projects and the Projects / Small works spacing are live. **The cause is unknown** [Certain that it happened; cause not found]. So web 1.33 is now really live. **Owner step:** redo the website parts of the flow test (sections **B, D and F**), because the earlier website results came from the old version. If the website stops updating again, check the latest deploy in the Netlify dashboard (Deploys) before testing.

### Owner reports, 10 Nov

| Report | State |
|---|---|
| Small works show in the **My Projects ⚙** picker, on **both** apps | [Likely] a data problem: small works saved into the `projects` list (both apps decide the kind by the list a job is saved in, rulebook §21 `jobKind`). The read-only report web **#295** confirms it; then a one-off move script follows (dry run first, with a backup). |
| iOS booking Save hangs; editing a booking's times in place | Fixed in iOS **#210** (1.33.1). |
| My list ⚙ Save hangs; Projects slow to open on My Projects | Fixed in iOS #210 and web #296. |

### Live

| Item | State |
|---|---|
| Rules + functions **1.32.4** (login-stamp custom claims) | Live [Certain]. The owner deployed the three `authClaims*` functions, ran the backfill (27 accounts stamped) and published the rules. |
| Web **1.33.0** (#288) | Live [Certain]. Merged; its rules are published; the one-off price work / expenses `personUserId` backfill has been run. The website itself only showed it from 10 Nov (see above). |
| Web Projects / Small works spacing (#290) | Live [Certain] (owner saw it on 10 Nov). |

### Merged, not yet on phones

| Item | State |
|---|---|
| iOS **1.33.0** (#202) | Merged to iOS `main` at `0d3dcdf` [Certain]. The owner built it on his Mac on 7 Nov and found the booking and My list bugs that iOS #210 fixes. |
| iOS **1.33.1** (#210, `ios-1.33.1-booking`) | **Under test now** on the owner's iPhone (the "7 Nov flow test", sections A–F). #210 merges once the owner says the test is OK; then TestFlight (Product → Archive → Distribute) and `minimumIosBuild`. |

### Open pull requests (all drafts, all CI green, all independently reviewed — do not merge before the owner says go)

| PR | Branch → base | What | Owner answers |
|---|---|---|---|
| iOS **#210** | `ios-1.33.1-booking` → `main` | 1.33.1 patch: booking Save finishes, inline time wheels in Edit booking, ⚙ All / Active / Upcoming / Completed filter, My list Save never hangs and loads fast, projects / small works decided by the collection a job is read from. No rule change. | merges after the owner's test |
| web **#295** | `web-job-collection-report` → `main` | Read-only report: jobs stored in the other job collection (`scripts/report-job-collection-mismatch.mjs`, owner steps `docs/scripts/report-job-collection-mismatch.md`). Writes nothing. | run it after merge, paste the output |
| web **#296** | `web-myworks-filter` → `main` | My Projects / My Small works ⚙: status filter chips, Save never hangs (Cancel never locked), ids of deleted or hidden jobs kept on Save. Hosting only. | — |
| web **#291** | `w134-ghosts` → `main` | Rulebook 1.34.0: ghost operatives (no app login) + rules R1 / R2 | 1b (Ghost toggle hidden behind `platformConfig/app.ghostAccounts`), Q2 ok, Q3 = (a), Q4 ok |
| iOS **#203** | `ios-1.34` → `main` | Ghost operatives on iPhone | same |
| web **#292** | `w135-my-profile` → `w134-ghosts` (stacked) | Rulebook 1.35.0: My Profile figures (`myProfileSummary`) | 1a, 2 yes, 3 yes, 4 after, 5 all; 5-second offline wait ok |
| iOS **#208** | `ios-1.35` → `ios-1.34` (stacked) | My Profile figures and one profile screen | same |
| 1.36 clean-up | `w136-fixes` (web #294) / `ios-1.36` (iOS #209) | Built, independently reviewed, review fixes in, all green (fixes only, no rules change). A person with two or more `operatives` rows has rate history read across all of them (rulebook §8). **Owner decided (a) on 10 Nov:** keep that, plus a duplicate clean-up; read-only report `scripts/report-duplicate-operative-rate-history.mjs` (#294). **Being added to 1.36 (owner, 10 Nov):** a warning when a new person has the same name as someone already on the roster (duplicate-name warning). Applies to both apps. | "do all"; (a) on 10 Nov; duplicate-name warning |
| iOS **#192**, **#194** | `claude/nifty-lovelace-76ztr2`, `main-vr2rt0-uoqzwv` | Stale drafts from 5 Nov (1.31.3 mirror; an old handover note), still open on 10 Nov [Certain]. Superseded by later releases. | owner may close them |
| Dependabot | web #279–#283, iOS #204–#207 | Library bumps. Review before launch; not urgent. | — |

[Certain] CI green was checked on the head commits on 7 Nov: web `8daee7e` (#291), `f2d8391` (#292); iOS `d96955d` (#203), `8227551` (#208). #210, #295 and #296 got review fixes on 10 Nov; check their CI on GitHub before merging.

**Stacked PRs.** #292 is based on `w134-ghosts` and #208 on `ios-1.34`. After #291 / #203 merge, retarget #292 / #208 to `main` (GitHub does it by itself only if the base branch is deleted on merge) and check the diff shows only the 1.35 commits. The 1.36 branches stack on 1.35 the same way.

## 1. Release order (after the owner's 1.33.1 test and "go")

0. **Now:** merge iOS **#210** once the owner's test of 1.33.1 is OK; owner uploads it to TestFlight. Merge web **#296** with it (same ⚙ behaviour on both apps). Merge web **#295**, the owner runs the report (§2 d), and Claude writes the one-off move script from its output.
1. **Merge web #291** (1.34.0). Web deploys from `main` by itself; the Ghost account toggle stays hidden.
2. **Owner publishes the 1.34 rules** (console: Firestore → Rules → paste `firestore.rules` → Publish), then checks what is live (`docs/firestore-rules-notes.md` "After publishing"). Never press Publish twice just because the console shows an error. Static compile cost 237,676.
3. **Merge iOS #203**; owner builds and uploads to **TestFlight**.
4. **Owner raises `minimumIosBuild`** in `platformConfig/app` to the iOS 1.34 build number (Claude sends the steps).
5. **Owner turns on `ghostAccounts`** (`platformConfig/app` → add boolean field `ghostAccounts` = true; or one company first in `ghostAccountsOrganizationIds`).
6. **Convert existing no-login operatives** to ghosts: dry run → owner fills the check list → apply → dry run again (commands in §2).
7. **1.35 My Profile**: retarget and merge web #292, then iOS #208. Hosting only — no rules, index, Storage or Functions change; `minimumIosBuild` unchanged.
8. **1.36 clean-up**: web then iOS, hosting only.
9. Then the security switches (13–16 Nov) and the full test (17 Nov).

## 2. Owner's next steps, with commands

Folders: `~/Developer/project-planner-web` and `~/Developer/project-planner-ios`. Firebase project: `project-planner-f986c`.

**a. If `git pull` in the iOS folder is blocked** by four changed files (the web build writes the rulebook mirror into `../project-planner-ios`):
1. `cd ~/Developer/project-planner-ios`
2. `git status` — you should see only these four changed: `Project Planner/Canonical/canonical-business.js`, `canonical-business.js.sha256`, `canonical-manifest.json`, `docs/RULEBOOK.md`.
3. `git restore "Project Planner/Canonical/canonical-business.js" "Project Planner/Canonical/canonical-business.js.sha256" "Project Planner/Canonical/canonical-manifest.json" docs/RULEBOOK.md` — this throws away those local copies (they come back correctly from GitHub).
4. `git pull` — it should now work.

**b. Flow test (now).** iOS: build the 1.33.1 branch (`git fetch && git checkout ios-1.33.1-booking && git pull`, then Xcode → choose the iPhone → Run ▶); More → Settings should end with "Rules 1.33.0". Website: redo sections **B, D and F** (the website was stuck on an old version until 10 Nov). Work through the 7 Nov flow test list and send the number and a screenshot of anything wrong (and who you were signed in as, for any "Missing or insufficient permissions").

**c. Ghost conversion (release step 6), one command per step:**
1. `cd ~/Developer/project-planner-web && git pull`
2. `node scripts/convert-no-login-operatives-to-ghosts.mjs --project project-planner-f986c --all` — dry run, writes nothing to Firestore; it creates `ghost-conversion/ghost-conversion-check-list.csv` and `.md`.
3. Open the CSV; fill `lineManagerIds` (and any name or rate the `issues` column asks for). Send it to Claude to check first if unsure.
4. `node scripts/convert-no-login-operatives-to-ghosts.mjs --project project-planner-f986c --all --apply --line-managers=ghost-conversion/ghost-conversion-check-list.csv`
5. Run step 2 again — it should report 0 candidates for the rows converted. Then check Settings → Data health → Ghosts to check.

**d. Job collection report (after web #295 merges).** Follow `docs/scripts/report-job-collection-mismatch.md` step by step. It only reads, never writes. The run command is `node scripts/report-job-collection-mismatch.mjs --project project-planner-f986c --all-orgs`; paste the whole output to Claude.

**e. Other owner tasks still open:** blank-manager clean-up script (#260, dry run first) and the old-records clean-up (#242); delete the old email function after `minimumIosBuild` is raised; account security (2FA on GitHub, Google, Resend, Netlify, Stripe; info@ password; Resend domains + DMARC; wholesaler allow-list for projectplanner.us); Data health "Fix all". App Store work stays parked until the owner says "lets get ready to launch to app store".

## 3. Owner questions

None outstanding. The owner only needs to **confirm the judgement calls** marked "owner to confirm" in `docs/OWNER_DECISIONS.md`:
- **1.33.0 judgement calls** (on `main`): overtime tap-again clears, locked waiting lines, Generate grey while an up-to-date report exists, possible over-notification on reopen; Payrun Snapshot details.
- **1.34.0 judgement calls** (on `w134-ghosts`, PR #291): J1 invited ghost keeps `ghost: true` until accepted; J2 ghosts not offered for toolbox talks / deadlines (web task pickers still list the catalogue row — follow-up); J3 timesheets start from the payrun the ghost accepts in; leave allowance kept on the ghost form; `email: ''` and no rate-history row at create; conversion script links duplicate rows via `formerUserIds` (**confirm before `--apply`**); R2 (line manager gets no overtime booking writes on a ghost).
- **1.35.0 judgement calls** (on `w135-my-profile`, PR #292): "Due this week" uses the Home 7-day window; hours use `bookedWorkedHours`; every manager-schedule place counts as hours booked.
- From the 1.35 review (recorded, not changed): Edit User leave no longer pulls leave from an `operatives` row linked only by `linkedUserId` with a different email — **guardrail 3, owner to confirm**; iOS Home avatar no longer falls back to the `operatives` row for the rate.

Until #291 / #292 merge, their decision rows are on those branches, not on `main`: read them with `git show origin/w134-ghosts:docs/OWNER_DECISIONS.md` and `git show origin/w135-my-profile:docs/OWNER_DECISIONS.md`.

## 4. Known follow-ups (not in any open PR unless 1.36 picks them up)

- **Rules follow-up PR (before launch):** admin-path privilege typing, `membersValuesTyped`, canonical `permissionLevels` strict; tests still refused by the 1,000-expression limit instead of logic (`RULES_STRICT_BUDGET=1 npm run test:rules` lists them); nobody switches off their own Annual Leave Management (after iOS changed-fields-only saves). 1.36 makes no rules change by design, so these stay here.
- **Pay privacy:** switch `privatePay` on (13–16 Nov) after `minimumIosBuild`, then run the pay-profile `--strip` step. Until then pay is hidden on screen only.
- **`enforcedReads`** switch on (13–16 Nov), owner steps from `docs/SECURITY_SWITCHES.md`.
- Web week grids use the browser's week (11 files, sweep FU-4; iOS Scheduling the same) → one organisation-week rule.
- Web code that picks one operatives row for rates / own-booking checks (`EditUserProfile.tsx`, `weeklyReportPayroll.ts`, `timesheetExport.ts`, `scheduleNavigation.ts`; FU-5).
- Web clash check letter case: already fixed in 1.33 (#266); confirmed in 1.36.
- Web task pickers offer a converted ghost's `operatives` row (1.34 J2).
- Recorded from the 1.35 review, not changed: a weekend stored AM / PM on a set-window day counts half the "counts as" hours (pre-1.13 data only); under a pre-1.20 policy merged blocks can take the half-day snap (rare).
- Home / help bugs from 5 Nov: operative "N pending" task count vs the Tasks "To do" list; Up next shows raw slot ids; Help "Home tiles" describes an unused editor.
- Stale rows to tidy in `OWNER_DECISIONS.md` (iOS #186 rows still "open"; "Guardrails" and "safeguards A–F" status).
- iOS `HomeView.swift` may adopt the new web Home look later (visual only).
- Dependabot PRs (§0).

## 5. Start message for a new chat

Paste this into a new Claude Code chat with **both** repos attached (`farnienel1/project-planner-web` and `farnienel1/project-planner-ios`):

> Read `docs/HANDOVER.md` in project-planner-web first, then `docs/OWNER_DECISIONS.md` (including the newer rows on `origin/w134-ghosts`, `origin/w135-my-profile` and `origin/w136-fixes`) and the rule files. Check the state of web PRs #291, #292, #294, #295, #296 and iOS PRs #203, #208, #209, #210 on GitHub. Then tell me, in plain English, what the next step is. My iOS 1.33.1 test and website re-test (B, D, F) result is: [paste results, or "all OK — go"]. Job collection report output: [paste it, or "not run yet"].

## 6. Environment notes for cloud chats

- `npm ci` fails (the `xlsx` tarball on cdn.sheetjs.com is blocked): remove `xlsx` from `package.json` and `package-lock.json` for the install only, and restore both before committing. `weeklyReportExport.test.ts` then fails locally only.
- A web worktree that runs `npm run build:canonical` must have **no** `project-planner-ios` sibling folder, or the build writes into it.
- Rules suites use the Firestore emulator on port **8080**: `firebase emulators:exec --only firestore --project demo-project-planner-rules "tsx --test tests/firestore.rules.test.ts tests/overtime.rules.test.ts tests/payeClaims.rules.test.ts"` (1.34 adds `tests/ghosts.rules.test.ts`; `npm run test:rules` on that branch lists the suites).
- A rules release is handed to the owner only when: static compile cost (`scripts/rules-cost/metric.py`) is below the live rules and the CI budget (395,000), the emulator type check shows 0 errors, the suites pass, and `RULES_STRICT_BUDGET=1` shows no new limit refusals.
- `gh` cannot use GraphQL here; use `gh api repos/...` (REST) or the GitHub MCP tools.

## 7. How the owner works

Standing instructions are in `docs/agent-rules/owner-working-style.md` (loaded by `CLAUDE.md`; it wins if this file differs). In short: end every message with ⏳ Waiting on / Next / Your move; plain English and numbered lists; advisor rules ([Certain] / [Likely] / [Guessing], no "Great question" etc.); a 3-factor table (Web / iOS / Shared rule) in every brief and PR; decisions on pay or who sees what go to the owner and into `OWNER_DECISIONS.md`; independent review before every merge.

## 8. Hard constraints

- Never hand-edit `canonical-business.js`, its `.sha256`, `canonical-manifest.json` or the iOS `docs/RULEBOOK.md` mirror; iOS syncs with `scripts/sync-rulebook-from-web.sh`.
- Firebase rules and functions are deployed **only by the owner, by hand** (console publish preferred), when Claude says so.
- Never touch production data, billing, signing, TestFlight or the App Store.
- No model identifier in commits, PRs or code. Commit trailers: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` plus the chat's `Claude-Session:` URL. PR bodies end with "🤖 Generated with [Claude Code](https://claude.com/claude-code)" and the session URL.
- Never use a bare `git stash`. Keep secrets out of chat and code. **Never revoke push key BSA6D294ZA.**
- Open draft PRs only; never merge without the independent review and the owner's go.

## 9. Useful references

- Rules publishing and compile cost: `docs/firestore-rules-notes.md` ("After publishing: check what is really live", "Compile cost"), `scripts/rules-cost/`, `docs/rules-cost/README.md`. The old "Google refuses to publish" problem (1.31.x) is solved; the live rules are far under budget (1.34: 237,676).
- Security switches: `docs/SECURITY_SWITCHES.md`. Auth claims backfill: `docs/scripts/backfill-auth-claims.md`.
- Screen map `docs/SCREEN_MAP.md`; tokens `docs/DESIGN_TOKENS.md`; guardrails `docs/agent-rules/platform-guardrails.md`; UI-only touch-ups `docs/agent-rules/ui-touch-up.md`; web Home design pack `docs/design/dashboard-ui/`.
- iOS hand-offs: `docs/ios-handoff/v1.33.0.md`, and on the PR branches `v1.34.0.md`, `v1.35.0.md`.
- Other artifacts: Launch To-Dos https://claude.ai/artifact/Fge9XQGWiwankCX6CqZpse, Launch Readiness https://claude.ai/artifact/L2d1DHcP63JAbQx3RVkYGu (the launch checklist above is the one kept current).
