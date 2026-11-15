# Handover — 15 Nov 2026 (overnight)

This file hands the work from one Claude Code chat to the next. A new chat starts with no memory: **read this file first**, then `docs/OWNER_DECISIONS.md`, then the repo rule files (`CLAUDE.md`, `AGENTS.md`, `docs/RULEBOOK.md`, `docs/agent-rules/*`, especially `owner-working-style.md`). Update this file at the end of every chat.

**Key dates** (owner, 7 Nov)

| Date | What |
|---|---|
| 14 Nov | Feature freeze (fixes, testing, account tasks and App Store work after this) |
| 17 Nov | Full test of both apps — checklist https://claude.ai/artifact/5ThVXaTWjMsuQMUHaVycP3 (answers saved in its `results` collection; read them with ArtifactData `list`) |
| 25 Nov | Launch |

Live launch checklist (the owner ticks items there; Claude updates rows as work merges): https://claude.ai/artifact/7Q7erHuNW9RBFFK4VuiAcR — database collection `items`. Progress infographic: https://claude.ai/artifact/3E1EoGzBW3KmjPwWn3Fvmt.

---

## 0. Where things stand (15 Nov night, checked on GitHub)

**Web `main` = `c9a1383`, rulebook 1.53.0** (packed sha `886912f4…`). Merged in order: #325 (1.47 signed timesheet reopens), #326 (1.48 materials), #327 (1.49 weekend day rate), #328 (1.50 upload hardening), #329 (1.51 weekly report), #330 (1.52 variations), #331 (1.53 calculation sweep). Web deploys from `main` by itself.

**iOS `main` = `b967bf1`**: #234 (1.47–1.49, owner built **build 5**) and #235 (1.50–1.53, **build 6 not archived yet**).

**Open PRs:** only Dependabot (web #280–#283, #310, #323; iOS #204–#206, #229) and two stale iOS drafts (#192, #194 — the owner may close them). Nothing of ours is waiting.

### Owner steps outstanding (in this order — do not skip)

1. `cd ~/Developer/project-planner-ios && git pull` (if blocked by the four mirror files, see §2 a).
2. Xcode → Product → Archive → Distribute → **build 6** to TestFlight.
3. Wait until build 6 shows in TestFlight.
4. Firestore → `platformConfig/app` → `minimumIosBuild` = **6**.
5. `cd ~/Developer/project-planner-web && git pull`
6. `firebase deploy --only storage --project project-planner-f986c` (Storage rules 1.50 + 1.52).
7. `firebase deploy --only firestore:rules --project project-planner-f986c` (Firestore rules 1.52), then check what is live (`docs/firestore-rules-notes.md` "After publishing").
8. Quick check: add a photo to a variation on web; see it on the iPhone.

Until step 4, variations should be edited on the website only.

### Claude's next step after step 6

Flip `STORAGE_RULES_1_50_PUBLISHED` (web, `lib/security/uploadGuard.ts`) and `storageRules150Published` (iOS) to `true` in a small follow-up release so qualification certificates accept every photo type (rulebook §24 "Until the 1.50.0 Storage rules are published"). Hosting only; independent review as always.

### Not known (ask the owner)

- **Security switches** (`privatePay`, `enforcedReads` in `platformConfig/app`, planned 13–16 Nov): status not confirmed in this chat. Steps: `docs/SECURITY_SWITCHES.md`.
- Were the live Firestore rules 1.43 before step 7 (question D)?
- Cost alert (£25 budget) set up (question E)?

## 1. Owner questions open

| Ref | Question | Recommended |
|---|---|---|
| C | Pay bookings at switched-off schedule locations (Office / WFH / Site survey / custom) on **timesheets and the weekly report**, like Daily Overview (A10)? Changes pay; on hold. | yes, own release with `minimumIosBuild` raised |
| D | Were the live Firestore rules 1.43? | — |
| E | Cost alert set up? | — |
| F | 1.52 judgement calls: always pinned (no renumber-all), Excel via fflate, upload after save, removed numbers retired, settings-copy numbers not checked by rules | confirm |
| G | 1.53 judgement calls: clash key order, "Up next" slot placement, weekly report waits for bank holidays | confirm |

Every other "owner to confirm" row is in `docs/OWNER_DECISIONS.md`.

## 2. Owner commands reference

Folders: `~/Developer/project-planner-web` and `~/Developer/project-planner-ios`. Firebase project: `project-planner-f986c`.

**a. If `git pull` in the iOS folder is blocked** by four changed files (the web build writes the rulebook mirror into `../project-planner-ios`):
1. `cd ~/Developer/project-planner-ios`
2. `git status` — only these four changed: `Project Planner/Canonical/canonical-business.js`, `canonical-business.js.sha256`, `canonical-manifest.json`, `docs/RULEBOOK.md`.
3. `git restore "Project Planner/Canonical/canonical-business.js" "Project Planner/Canonical/canonical-business.js.sha256" "Project Planner/Canonical/canonical-manifest.json" docs/RULEBOOK.md`
4. `git pull`

**b. Other owner tasks still open:** blank-manager clean-up script (#260, dry run first), old-records clean-up (#242), ghost conversion script (dry run first), delete the old email function after `minimumIosBuild` is raised; account security (2FA on GitHub, Google, Resend, Netlify, Stripe; info@ password; Resend domains + DMARC; wholesaler allow-list); Data health "Fix all". App Store work stays parked until the owner says "lets get ready to launch to app store".

## 3. Known follow-ups

- Storage switch flip (above, after step 6).
- Question C (switched-off locations on timesheets / weekly report).
- iOS: re-record the `testVariationTracker` snapshot images on a Mac.
- Rules follow-up before launch: admin-path privilege typing, `membersValuesTyped`, strict `permissionLevels`, tests still refused by the 1,000-expression limit (`RULES_STRICT_BUDGET=1 npm run test:rules`).
- Pay privacy: `privatePay` on, then the pay-profile `--strip` step.
- Web follow-up from 1.41: ordinary booking delete on web does not show the signed-timesheet warning (iOS does).
- 1.48: blank brand still stored as "Custom" (tidy later).
- 1.52: settings-copy numbers not checked by the rules (known limit).
- Overtime cut-off constant duplicated (`TIMESHEET_OVERTIME_LINE_MIN_HOURS`) — tidy into the rulebook.
- Server-side virus scan / App Check for uploads (after launch).
- Dependabot PRs: review before launch; not urgent.

## 4. Start message for a new chat

Paste this into a new Claude Code chat with **both** repos attached (`farnienel1/project-planner-web` and `farnienel1/project-planner-ios`):

> Read `docs/HANDOVER.md` in project-planner-web first, then `docs/OWNER_DECISIONS.md` and the rule files. Then tell me, in plain English, what the next step is. Build 6 / `minimumIosBuild` / rules publish: [done / not yet, with any error text]. Answers to C–G: [paste]. Security switches: [on / off].

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
