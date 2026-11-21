# Owner console spec (owner's prompt, 15 Nov 2026, verbatim)

> Saved word for word from the owner's message. `PLAN.md` says how it is built and where it needs a decision first. If this file and `PLAN.md` differ, this file is what the owner asked for; `PLAN.md` lists the decisions that change it.

---

# Claude Code prompt: rebuild the Owner console into a complete platform admin console

**Repo:** `project-planner-web`. The console lives at `/developer` (`app/developer/*`, `components/developer/*`, `app/api/owner/*`, `lib/owner/*`, `lib/analytics/*`).

**Goal:** turn the Owner console into a first-class platform admin console. One person, the platform owner, should be able to:
- see **every organisation, person and pound** on the platform, live;
- find anyone in seconds;
- safely do every support job a serious SaaS admin console offers: password resets, invites, email changes, sign-in blocks, deleting users, deleting and restoring organisations, and more;
- see timesheet money by **day, week, month, year and all time**;
- see growth, usage, revenue and platform health.

This replaces any earlier "admin console" prompt. Where they differ, this one wins.

---

## 0. Before anything

Follow `CLAUDE.md` and everything it loads. For this job that especially means:
- `docs/HANDOVER.md`
- `docs/OWNER_DECISIONS.md`
- `docs/agent-rules/owner-working-style.md`
- `docs/agent-rules/platform-guardrails.md`
- `docs/RULEBOOK.md`, in particular §11 Manage Users (`accountDeletionPath`), §14, §16, §18 (`platformConfig`), §19, §20 Company deletion and §27 Data check

Rules that matter most here:
- I'm not a developer. Use plain English, numbered steps, and end every message with the status line.
- Each change gets its own branch and PR, with an independent review before merge.
- **I deploy Firestore rules and Cloud Functions myself, by hand.** Give me the exact commands, one per step.
- **Never touch production data or billing yourself.** Build the tools. I press the buttons.
- **No second calculator.** All money, hours, timesheet, person and date logic comes from `lib/canonical`. `scripts/check-second-calculators.mjs` must stay green.
- Money is never added across currencies (`resolveOrganizationCurrency`). Each currency is shown separately.

---

## 1. Non-negotiables

1. **Access stays exactly as the rulebook has it.**
   - Only the platform owner gets in: `isPlatformOwner()` in `firestore.rules` (verified owner email), `isPlatformOwnerEmail` in the app, the MFA gate in `app/developer/layout.tsx`, and `requireOwner` on every `/api/owner/*` route.
   - Do **not** add a second admin role or claim.
   - Add emulator tests proving that an org Super Admin, an Admin, a Manager and an Operative are refused on every new route and read.
2. **Every action goes through the server.**
   - Use an `/api/owner/*` route with `requireOwner`, `enforceRateLimit` and `writeAuditLog` (the `adminAuditLog` collection).
   - Record who, what, target org and user, the before/after fields that changed, the reason I typed, IP and time.
   - Never write customer data straight from the browser.
3. **Destructive actions are hard to do by accident.** That covers delete, disable, change email, schedule org deletion and revoke sessions. Each needs:
   - a confirmation dialog naming the org and person;
   - a required reason;
   - type-to-confirm for deletes, using the rulebook's existing confirmation (company name + `DELETE`, `organizationDeleteConfirmationError`);
   - a fresh MFA check (re-verify if the last one is older than 10 minutes).
4. **No impersonation.** No "log in as user". A read-only "view as" screen is fine if it cannot write anything.
5. **No invented numbers.**
   - Every figure has a written **metric contract**: what's counted, from where, the time window, how it refreshes, and whether test data is included.
   - If the data doesn't exist, the card shows **"Not connected"** and says what's missing.
   - Test and internal orgs (`isInternal` / `isTest`) are excluded unless "Include test data" is on. That toggle already exists in `consolePrefs`, and every figure must respect it.
6. **Never hide old data** (guardrail 3). Old document shapes, older field names, inactive and deleted people, and orgs scheduled for deletion all still appear, clearly labelled.
7. **Sensitive fields are masked by default.** This covers tax IDs (`users/{uid}/private/taxIds`), pay rates, phone numbers and emails (`MaskedEmail` exists). "Reveal" is one click and writes an audit entry.

---

## 2. What "live" means (put this definition in the console's help text)

| Kind | How | Freshness |
|---|---|---|
| Queues and lists you act on: Needs you, new sign-ups, feedback, register interest, audit log | Firestore `onSnapshot` listeners on small, indexed queries | Seconds |
| Headline counts: orgs, users, active today | Firestore `count()` / `sum()` aggregation queries, or a server route using the Admin SDK | When the page opens, then every 60 s, plus a Refresh button |
| History and money: £ per month and year, trends, cohorts | **Daily rollups** written by a scheduled Cloud Function, plus a "Recalculate now" owner action | Nightly, or on demand |
| Auth facts: last sign-in, verified, MFA, disabled | Server route with the Admin SDK (Identity Toolkit, `lib/owner/identityToolkitAdmin.ts`) | When opened |

**Fix the current loading problem.** `lib/analytics/analyticsStore.ts` downloads **every** `users` and `organizations` document into the browser on every visit (`fetchAllDocs`). Replace this with:
- paged, searchable server routes (for example `/api/owner/directory/orgs` and `/api/owner/directory/users`, with cursor, search, sort and filters);
- aggregation counts for totals;
- rollups for history.

Show the before/after read counts in the PR.

---

## 3. Prerequisite I'll need to do (give me step-by-step instructions)

Several actions need the server Admin SDK: full user deletion, Auth facts, organisation deletion and rollups. For example, `app/api/owner/delete-organisation` currently returns 501 until `FIREBASE_SERVICE_ACCOUNT_JSON` is set.

In Phase 2, give me numbered steps to:
- create a least-privilege service account;
- add it to Netlify environment variables;
- confirm `firebaseAdminConfigured()` returns true.

Never ask me to paste the key into chat.

---

## 4. The console: modules

Use `docs/design/admin-console/admin-console-reference.html` (attached) for the **layout direction**:
- a sidebar grouped by job;
- one period selector per page;
- five headline numbers, each with a definition;
- a "Waiting on you" list first;
- every state designed.

The **groups below replace the ones in the reference.** The reference's numbers are placeholders. Keep the existing routes and add new ones.

**Sidebar**
- **TODAY:** Command centre · Needs you
- **CUSTOMERS:** Organisations · People · Register interest
- **MONEY:** Timesheet value · Revenue
- **PRODUCT:** Growth & engagement · Feature usage · Feedback · Roadmap
- **PLATFORM:** Health & data · Errors · Emails & notifications · Releases & switches
- **RECORD:** Audit log
- **Bottom:** Account

The period selector, "Include test data" and global search (⌘K: orgs, people, emails, org IDs, user IDs) are on every page.

### 4.1 Command centre (`/developer`)
- **Headline numbers**, each with a vs-previous-period comparison:
  - active organisations;
  - active people;
  - **signed timesheet value**;
  - MRR;
  - items waiting on me.
- **"Waiting on you":** the top 5 from Needs you.
- **Charts:** active people per day (with web vs iOS split), and timesheet value per month (last 12 months).
- **Organisations needing attention:** quiet for 14+ days, setup unfinished, trial ending, payment failed, scheduled for deletion.
- **Live feed:** sign-ups, new orgs, signed timesheets and owner actions, as they happen.
- The current platform scoreboard moves to Growth.

### 4.2 Needs you
One queue, each row showing its age, a link to the org or person, and a status (new, in progress, done) with my notes:
- password and login-email requests;
- invites pending more than N days;
- unfinished setups;
- failed payments, trials ending and cancellations (from `organizations/{id}.billing`);
- orgs scheduled for deletion, with days left before erasure;
- Data check and data quality issues;
- untriaged feedback;
- new register-interest entries.

### 4.3 Organisations (list + a full 360 view)
**List**
- **Columns:** name, plan and billing status, people (active / total), last activity, bookings this week, timesheets signed this period, **£ signed this month**, open warnings, platform mix (web / iOS), created date, flags (test, scheduled for deletion, lapsed).
- **Controls:** sort, filter, saved views, CSV export.

**Org 360 tabs, all read-only except Actions**
- **Summary:** key facts, settings summary (time zone, currency, invoicing period / payment runs, warnings settings), health.
- **People:** with roles, status, last seen, app and version.
- **Jobs / projects.**
- **Bookings:** counts by week.
- **Timesheets & £:** day, week, month and year; PAYE vs self-employed; hours; overtime; price work; expenses; drill down to individual sheets.
- **Leave.**
- **Billing:** read from billing data, with a link to the Stripe dashboard.
- **Data check.**
- **Activity timeline.**
- **Audit:** owner actions on this org.
- **Notes:** my private notes.
- **Actions:** see §5.

### 4.4 People (directory + a person 360 view)
- **Search across all orgs:** name, email, role, org(s), verified, MFA, disabled, last sign-in, last seen, platform and app version, invite state, line manager.
- **Person 360:**
  - the Auth record;
  - every users document, membership and alias of the person (use the rulebook person-id functions: `personIdSet`, `userIdAliases`; never match a single id);
  - devices and push tokens;
  - recent activity;
  - timesheets and £;
  - owner audit history;
  - Actions.

### 4.5 Timesheet value (the money page)
**What's counted:** signed timesheet value, using the rulebook's own definitions:
- `isTimesheetFullyApproved`
- `timesheetTotals`
- the signed snapshot
- `lib/owner/signedTimesheetValue.ts`

**Breakdowns**
- **Periods:** day, week, month, quarter and year, plus custom range and all time. Month-by-month and year-by-year tables with charts.
- **By organisation:** a ranked table and its share.
- **By employment type:** PAYE vs self-employed.
- **By category:** labour, overtime, price work and expenses.
- **Hours and averages:** hours signed, average £/hour, average per org.

**Rules**
- Each currency is shown separately.
- Sheets that couldn't be priced are counted and listed (`labourNotCountedCount`), never silently skipped.
- **Open issue:** fix it through the rulebook, not on this screen. It is in `OWNER_DECISIONS.md` (15 Nov): "Timesheet value" still values a reopened sheet's stored snapshot.
- History comes from a rollup `orgStats/{orgId}/monthly/{yyyy-mm}`, computed in Cloud Functions with the canonical bundle (as `functions/` already loads it), with a backfill script I run on approval.
- **Reconcile:** for three orgs and two months, the page must equal a manual calculation. Show both in the PR.

### 4.6 Revenue
- MRR, ARR, paying orgs, trials, trial-to-paid conversion, churned orgs and MRR, failed payments, plan mix, revenue per org.
- Read from `organizations/{id}.billing` (written by the Stripe webhook) and, if useful, read-only Stripe API calls. **No billing changes from the console**: billing is a hard constraint. Link to Stripe for those.

### 4.7 Growth & engagement
- Sign-ups and new orgs per day, week and month.
- **Activation funnel:** org created → first person invited → first booking → first timesheet signed.
- DAU, WAU and MAU, and stickiness.
- Retention cohorts by sign-up month.
- Web vs iOS usage.
- Time to first value.
- The current scoreboard (moved here).
- Sources: `productEvents` and `productSessions`, plus rollups.

### 4.8 Feature usage, Feedback, Roadmap, Register interest
- Keep what works.
- Fix what Phase 1 finds broken.
- Bring the pages into the new layout.

### 4.9 Health & data
- Data check (§27) and the data quality pages, with counts per org.
- App versions in use vs `minimumIosBuild`.
- Sync drift checks.
- Rulebook version web vs iOS.
- Scheduled function last-run status: `eraseDeletedOrganizations`, the auth-claims triggers and the new rollups.

### 4.10 Errors
"Pages & errors" is a placeholder today. Make a recommendation for an error source (for example a small sampled `clientErrors` collection written by web and iOS, or a hosted tool) with cost and privacy notes. Until I decide, show **"Not connected"**. This is a **Decision needed**.

### 4.11 Emails & notifications
- Transactional emails sent, by type and status (`functions/email`, `sendEmail`).
- Bounces and failures, if the provider gives them.
- Push notifications sent and failed.

### 4.12 Releases & switches
- Read-only view of `platformConfig/app`: minimum builds, per-org feature switches, `organizationErasureEnabled`.
- Editing from the console is a **Decision needed**. If approved, every change needs confirmation and an audit entry.

### 4.13 Audit log
- Every `adminAuditLog` entry, live.
- Filter by action, org, person and date.
- Shows before/after for each entry.
- Exportable.
- Read-only. Nothing can edit or delete it, including me (add a rule for this, plus a test).

### 4.14 Website stats
"Not connected" until a source is chosen (**Decision needed**).

---

## 5. Owner actions catalogue

All actions follow §1.2 and §1.3. Reuse existing routes and canonical paths first.

| Action | Where | Build on |
|---|---|---|
| Send password reset email | Person | `app/api/owner/send-password-reset` (exists; keep its 2-minute repeat guard) |
| Resend invite / verification email | Person | the existing invite and email functions |
| Change login email | Person | `app/api/owner/change-email` (exists) |
| Disable / re-enable sign-in | Person | Admin SDK `disabled`, plus revoke tokens |
| Sign out everywhere | Person | `adminRevokeRefreshTokens` |
| Reset MFA (lost phone) | Person | Admin SDK; must carry the strongest confirmation |
| Deactivate / reactivate in an org | Person, Org | the rulebook Manage Users path (§11); same result as an org admin doing it |
| Transfer Super Admin | Org | `lib/staff/superAdminTransfer.ts` |
| **Delete user** | Person | the rulebook `accountDeletionPath` and `lib/account/accountDeleteAdmin.ts` (anonymise, memberships, Auth). A Super Admin who is alone in their org leads to company deletion (below), exactly as the rulebook says |
| Delete unfinished sign-up | Person | `app/api/owner/delete-unfinished-user` (exists) |
| **Delete organisation** | Org | the §20 flow: schedule deletion with `restoreBy: 'platform_owner'` and the 30-day restore window (`DELETION_RESTORE_DAYS`). The nightly `eraseDeletedOrganizations` erases it after that. Replaces the current 501 |
| Restore organisation | Org | §20 restore (the platform owner may restore any) |
| Erase now (skip the 30 days) | Org | **Decision needed**. My default answer is no |
| Mark / unmark as test or internal | Org, Person | `app/api/owner/mark-internal` (exists) |
| Export an org's data (GDPR) | Org | new: a server job producing a download; **Decision needed** on format |
| Owner notes and tags | Org, Person | new `ownerNotes` collection, owner-only rule |
| Recalculate rollups | Money | a new callable function |

---

## 6. Testing: nothing breaks, everything works

The console is not working today. This update is only finished when every page and button is **proven** to work by automated tests. Being built isn't enough, and neither is "looks right". These rules apply to every PR.

### 6.1 Baseline before the first change
1. On `main`, before any edit, run and record:
   - `npm run lint`
   - `npm test`
   - `npm run test:rules`
   - `npm run test:rules:storage`
   - `npm run build`
   - `npm run check:calculators`
   - `npm run check:rules-budget`
2. Put the results in the Phase 1 report. Anything already failing is listed as **pre-existing** and is not hidden or skipped.
3. From then on, every PR must leave all of these as green as the baseline, or greener. **No test may be deleted, skipped or weakened** to make a PR pass. If one is wrong, say so and get my approval.

### 6.2 Realistic test data (emulator only)
Add `scripts/owner-console-seed/`: a seed script for the **Firebase emulator**, never production. It must include:
- at least 6 orgs:
  - one large (100+ people);
  - one small;
  - one test/internal;
  - one with setup unfinished;
  - one lapsed or failed payment;
  - one scheduled for deletion;
  - one in a non-GBP currency;
- people of every role, plus:
  - inactive and deleted people;
  - pending invites;
  - a person in two orgs;
  - duplicate users documents for one person;
  - **old document shapes** (from the cross-platform contract samples);
- timesheets that are signed, unsigned, reopened, or have no signed snapshot, with PAYE and self-employed, overtime, price work and expenses, across at least 14 months;
- product events and sessions from web and iOS, feedback, register interest and audit entries.

Every expected figure for this seed (for example "October signed value for Org A = £X") is written in a fixtures file **calculated by hand or with the canonical functions in a test**, so the tests know the right answer.

### 6.3 Test layers (all run in CI, so a PR can't merge red)
1. **Unit tests** (`tsx --test`, added to `npm test`) for:
   - every metric and rollup function: values against the seed fixtures, test data on and off, currency separation, empty data, huge numbers, old shapes;
   - every directory, search and filter helper.
2. **Security rules tests** (added to `test:rules`). For every new or changed rule:
   - owner allowed;
   - Super Admin, Admin, Manager, Operative, signed-out and unverified-email all refused;
   - the audit log can't be edited or deleted by anyone.
3. **Route tests**, for every `/api/owner/*` route:
   - signed out → 401;
   - non-owner → 403;
   - owner without fresh MFA → refused for destructive actions;
   - bad input → a clear error;
   - rate limit works;
   - success writes exactly the expected fields **and** one audit entry;
   - running it twice is safe (idempotent);
   - a failure part-way leaves no half-done state (or is resumable, with the status shown).
4. **Cloud Function tests** on the emulator: rollups, recalculate, the deletion schedule and restore, and the `eraseDeletedOrganizations` interaction (existing tests stay green).
5. **End-to-end browser tests.** Add Playwright as a dev dependency and an `npm run test:owner-e2e` script that starts the emulators, seeds the data, runs the app and:
   - signs in as the owner, then visits **every console page**. Each must load with **zero console errors**, no "undefined"/"NaN"/"[object Object]" on screen, and no placeholder text;
   - **clicks every button, link, tab, filter, sort, search and pager** and checks it does what its label says;
   - for **every action** in §5, runs the happy path, the **Cancel** path (nothing changes) and the wrong-confirmation path (refused). Then it checks the data and the audit log;
   - checks headline figures on screen equal the seed fixtures;
   - checks every state: loading, first use (empty emulator), no results, error (emulator stopped), "Not connected";
   - signs in as an org Super Admin and checks `/developer` and every `/api/owner/*` route are refused;
   - takes screenshots at 1440, 1280, 768 and 375 px in light and dark mode, checks nothing overflows, and runs a keyboard-only pass.
6. **No-regression check for the customer app** (guardrail 7). With the same seed, run before and after each PR:
   - Daily Overview, Weekly Report and Timesheets show identical figures;
   - an org admin can still sign in, manage users and sign a timesheet.

   Add these to the e2e suite.

### 6.4 Bugs
Every bug found in Phase 1 (or later) gets a **failing test first**, then the fix, then the test passing. The PR lists each bug with its test name.

### 6.5 Destructive actions are previewed, then proven
- Before confirming a delete, disable or email change, the dialog shows a **dry-run preview** from the server: exactly what will change (for example "1 company, 14 people, 312 bookings, 40 timesheets, files under organizations/{id}/; restorable until 15 Dec").
- Tests check the preview matches what the action then does.
- Destructive actions are only ever exercised on the emulator. **Never run against production.**

### 6.6 Nothing goes missing mid-way
- Old console pages stay working until their replacement passes its tests.
- No route is removed in a PR unless its replacement is merged in the same PR.

### 6.7 After each deploy: my smoke test and a way back
Each PR ends with:
- **"Smoke test for you":** 5–10 plain-English checks I do on the live site in under 5 minutes, each with what I should see. **None of them deletes or changes real data.**
- **"If something's wrong":** the exact undo steps, one per step. That means Netlify "publish previous deploy", re-publishing the previous rules version in the Firebase console, and the functions to roll back.

### 6.8 The final acceptance run
After the last module, run the full suite (§6.1 + `test:owner-e2e`) from a clean checkout. Give me a table of every page and every action with ✅/❌ and the test that proves it. Anything ❌ is not done.

---

## 7. How to work

### Phase 1: Audit what exists, then stop. No edits.
1. For every console page, widget and action, record:
   - whether it works, is broken, is a placeholder, is fake, or is slow;
   - the evidence: file and line, the console error, or a test.
2. The data each page reads, with Firestore read counts on a real-sized load.
3. Each owner route: what it does, and whether it is fully guarded, rate-limited and audited.
4. Anything insecure, flagged as **High**.
5. Which of my wants (§4–5) are already possible, and which need new data, functions or rules.
6. The test baseline (§6.1), and a numbered **broken list**. Each item on it becomes a failing test in Phase 3 (§6.4).

**Stop and wait for my approval.**

### Phase 2: Plan, then stop. No edits.
1. **Metric contracts:** a table for every number in §4 (name, definition, canonical function, source, window, refresh, test-data rule).
2. **Data plan:**
   - server routes;
   - aggregation queries;
   - rollup documents and the functions that write them;
   - indexes;
   - rule changes, with the size/cost budget per guardrail 5;
   - the backfill.
3. **Actions plan:** for each row in §5, the route, the canonical path, the confirmation text and the audit fields.
4. **Decisions needed:** a numbered list with your recommendation for each, ready for me to answer and for you to record in `OWNER_DECISIONS.md`. Include the definition of "active", plus Errors, Website stats, Erase now, Releases & switches editing and GDPR export.
5. The service-account steps from §3.
6. **The test plan:** the seed contents (§6.2), the fixtures file, the e2e test list per page and action, and the CI changes.
7. **Build order and PR list,** with what I must deploy after each PR. Expected order:
   1. foundations: seed script, fixtures, Playwright e2e harness and CI job, directory routes, stop the full scans
   2. Command centre
   3. Needs you
   4. Organisations 360
   5. People 360 and actions
   6. Timesheet value and rollups
   7. Revenue
   8. Growth
   9. Health
   10. Audit log
   11. the rest

**Stop and wait for my approval.**

### Phase 3: Build, one PR per module
For each module (every step follows §6):
0. **Write the tests first:** the module's unit, route and e2e tests, plus failing tests for its broken-list items.
1. **Rules and route guards,** with emulator tests that refuse non-owners.
2. **Functions and rollups,** tested on seeded emulator data (old document shapes included).
3. **UI** with the project components and tokens:
   - **Every state:** loading skeletons, first use, no results (showing the filter that caused it), error with retry, "Not connected", long names, huge and zero values, and many rows with pagination.
   - **Widths:** 1440, 1280, 768 and 375 px, with no overflow.
   - **Themes:** light **and** dark.
   - **Keyboard only:** sidebar, search, filters, tables, dialogs.
   - **Charts:** each has a table alternative.
4. **Actions:** a test for each, proving the confirmation, the audit entry, and refusal for non-owners.
5. **PR report:**
   - the full test run vs the baseline: the commands and pass/fail counts;
   - the e2e results;
   - the customer-app no-regression result;
   - "Smoke test for you" and "If something's wrong" (§6.7);
   - screenshots;
   - each new metric reconciled against a manual query, with the numbers;
   - test results;
   - the 3-factor table (Web / iOS / Shared rule);
   - what I must deploy, step by step;
   - any **Decision needed**.

Independent review, then merge. Don't start the next module until I say so.

---

## 8. Done means

- The §6.8 acceptance table is all ✅: every page and every action proven by an automated test that runs in CI.
- No test was skipped or weakened, and the customer app's figures are identical before and after.
- I can answer these in under 10 seconds:
  - "How much timesheet value was signed in October, and by whom?"
  - "Who hasn't logged in for two weeks?"
  - "Which orgs are about to churn?"
- Every number has a definition I can read on hover, and matches a manual check.
- Every action is confirmed, audited and reversible where the rulebook allows.
- The console opens fast with real data. No full-collection scans in the browser.
- No tenant-app behaviour changed. iOS is untouched unless a rulebook change says otherwise, and in that case you give me the iOS follow-on prompt.

Begin with Phase 1.
