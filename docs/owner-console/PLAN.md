# Owner console rebuild — the build plan

What the owner asked for is `SPEC.md`. What exists today, with evidence, is `AUDIT.md`. This file is **how** to build it: architecture, every number's definition, data, rules, actions, decisions, tests and the PR list.

**Status:** draft for the owner's approval (spec §7 Phase 2). Nothing in it is built yet. Items marked **D#** wait for an owner answer (§5). Until the owner answers, build the recommended default **only where the PR says so**; otherwise stop at that step.

Tags: [Certain] seen in code or a test; [Likely] strong inference; [Guessing] a gap.

---

## 0. Ground rules for whoever builds this

1. **Read first**, in this order: `CLAUDE.md` (and everything it loads), `docs/HANDOVER.md`, `docs/OWNER_DECISIONS.md`, `docs/owner-console/SPEC.md`, `AUDIT.md`, then this file.
2. **One PR per row of §8**, its own branch from the latest `main`, a draft PR from `.github/pull_request_template.md`, and an independent review before merge. Don't start the next PR until the owner says go.
3. **Tests first** (spec §6.4). Every item on the AUDIT broken list gets a failing test before its fix. No test is deleted, skipped or weakened.
4. **No second calculator.** Money, hours, timesheet status, person matching and dates come from `lib/canonical`. Where the console needs a rule that lives only in a web file today, it moves into `lib/canonical` first; that is a rulebook change (§3.6).
5. **Shared files are touched by one chat at a time:** `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `docs/RULEBOOK.md`, `lib/canonical/**`, `functions/**`, `docs/OWNER_DECISIONS.md`. Before editing one, check open PRs for the same file. Rulebook version numbers are taken at merge time: whoever merges second rebases and takes the next number.
6. **Nothing runs against production.** Seed and destructive tests run on the emulator only. The owner deploys rules and functions by hand, from the commands in each PR.

---

## 1. Architecture (recommended)

| # | Choice | Why |
|---|---|---|
| A1 | **Reads for the console go through `/api/owner/*` server routes** running on Netlify. They use the owner's own ID token over Firestore REST (`lib/owner/firestoreRest.ts`, pattern exists). The browser keeps live `onSnapshot` listeners only for small queues: the audit log, register interest, feedback, and Needs-you notes. | Works **without** the service-account key (the security rules already let the verified owner read). It also ends the full scans in the browser (AUDIT §3). |
| A2 | **Server-only powers** (Auth facts, disable or revoke, delete user, schedule org deletion, server-written audit rows) use the service-account access token that exists today (`adminGoogleAccessToken` in `lib/owner/identityToolkitAdmin.ts`). **Don't add the `firebase-admin` package to the web app**: the REST pattern already covers it, and Netlify function size stays small. | Reuse, no new dependency. |
| A3 | **One guard for every owner route:** `requireOwnerSession(request, { fresh })` in `lib/owner/requireOwner.ts`. It checks: the token is the verified owner (as today); the signed MFA cookie (`verifySignedMfaOk`) exists and its `uid` equals the token uid; and with `fresh: true`, that the MFA was completed within 10 minutes. To know when, the cookie gains an `iat` (issued-at), and old cookies without one count as "not fresh". Destructive routes use `fresh: true`. | Fixes H1; meets spec §1.3. |
| A4 | **Audit is written by the server and is never optional.** Each action writes `requested` (with a `requestId`) **before** it acts, and refuses the action if that write fails. It then writes `completed` or `failed` with the same `requestId`. Every action is logged; nothing can edit or delete an entry. Fields: `requestId, action, phase, actorUid, targetOrgId, targetUserId, reason, before, after, ip, userAgent, at`. `before` / `after` hold changed fields only, with emails masked and no pay rates or tax ids. | Fixes "audit fails silently" (AUDIT §4). |
| A5 | **History and money come from rollups written by a Cloud Function** in the existing `inbox-push` codebase, using the packed rulebook (`functions/loadCanonical.js`). A nightly run, an owner "Recalculate now" (an HTTPS function that checks the owner token and fresh MFA, D10), and a backfill script share one function. | Spec §2 and §4.5. |
| A6 | **Rollup documents live at the root**, never under `organizations/{id}/…`, because the organisation catch-all rule lets every member read that subtree (`firestore.rules:2397`). Paths: `ownerStats/platform/daily/{yyyy-mm-dd}`, `ownerOrgStats/{orgId}/monthly/{yyyy-mm}`, `ownerStats/jobs/runs/{jobName}`. The spec says `orgStats/{orgId}/…`; `ownerOrgStats` makes it obvious it's owner-only (D13). | Customers must never read platform money. |
| A7 | **Person matching uses the rulebook:** `rosterPeople` (one row per email, with `userIdAliases`) and `personIdSet`. Remove `lib/owner/collapseDirectoryUsers.ts` and its test in the PR that replaces its two callers. (`userIdAliases` in the spec is a field of `rosterPeople` rows, not a function.) | Guardrail 1. |
| A8 | **Test-data rule:** one console helper, `isTestOrganisation(org)` / `isTestPerson(person, org)` in `lib/owner/testData.ts`. An org counts as test when `isInternal === true` or `isTest === true`. A person counts as test when their own `isInternal === true`, or when every org they belong to is test. **The name/email guess** (`isTestRecord`, `/\btest\b|staging|@example./`) **is removed**, because it drops real people (AUDIT O5d). That changes what's hidden (D12). It's a console display rule, not a business rule, so it stays in `lib/owner`. The toggle is remembered per device (`localStorage`). | No invented exclusions. |
| A9 | **The console's state goes in small React-Query-style hooks** per page (`lib/owner/client/*.ts`), each calling one route with `{ period, includeTestData }`. `useAnalyticsStore` is deleted when its last caller is gone (spec §6.6: not before). | One loader per page. |

---

## 2. Metric contracts

Every number shows a ⓘ with its contract text (stored in `lib/owner/metricContracts.ts`, one object per metric, so tests can check every card has one). Unless a row says otherwise: the window is the page's period in **Europe/London** (a platform-level view; each org's money still uses the org's own zone, see the timesheet rows); "test" follows A8 and is excluded unless the toggle is on; and refresh follows spec §2.

| Metric | Definition | Rule / function | Source | Refresh |
|---|---|---|---|---|
| Active organisations | Orgs **not** scheduled for deletion or erased (`organizationDeletionState` = active) with **at least one active person** seen in the period (D1). | `organizationDeletionState`, `rosterSegment` | org docs + people `lastSeenAt` (route); daily rollup for past periods | 60 s / nightly |
| Active people | People (one per `rosterPeople` row) with `lastSeenAt` in the period. For past periods, from the daily rollup `activePeopleIds` (D1). | `rosterPeople` | users docs; `ownerStats/platform/daily` | 60 s / nightly |
| Signed timesheet value | Sum of the **signed value** (§3.6) of sheets that are fully signed, **not reopened**, and whose **sign-off date** (the line manager's, else the person's, when self-signed) falls in the period. **One figure per currency** (D2). | new canonical `signedTimesheetValueOf`, `isTimesheetFullySigned`, `signedTimesheetBookingChanges` | rollup `ownerOrgStats/*/monthly` (+ live current month) | nightly + Recalculate |
| Hours signed | `timesheetTotals(...).hours` of those sheets. | `timesheetTotals` | same | same |
| Labour / overtime / price work / expenses | `timesheetTotals` `standardLabour`, `overtimeLabour`, `priceWork`, `expenses`. | `timesheetTotals` | same | same |
| PAYE vs self-employed | PAYE has no timesheet value (rulebook §8: PAYE days pay 0 on timesheets). This split therefore shows **self-employed £** and **PAYE hours from overtime reports** (§25), never PAYE £ (D3). | `employmentTypeOnDay` | rollup | nightly |
| Sheets not priced | Fully signed sheets with no signed snapshot. Counted and listed by org and person, value = price work + expenses only. | `signedTimesheetValueOf(...).labourCounted` | rollup | nightly |
| Reopened sheets | Signed, not exported, and `signedTimesheetBookingChanges(...).reopened`. Listed, **not** added to value (D2). | `signedTimesheetBookingChanges` | rollup | nightly |
| MRR | Sum of `billing.mrrPence` of orgs whose `billing.status` is `active` or `past_due` within grace (`hasAccess`), **trials excluded**. An org with no `mrrPence` is counted as "MRR missing", **never filled in from the list price**. | `hasAccess` | org `billing` | 60 s |
| ARR | MRR × 12. | | | |
| Paying orgs / trials | Status `active` (paying) / `trialing` (trials). | | | |
| Trial→paid conversion | Of orgs whose `trialEnd` fell in the period, the share now `active`. | | | |
| Churned orgs / MRR | Orgs whose `billing.canceledAt` is in the period, and the MRR they had in the last rollup before it. Needs the daily rollup from the day it ships; earlier history isn't known (D4). | | rollup | nightly |
| Failed payments | Orgs with `lastPaymentFailedAt` in the period; "in grace" when `hasAccess` is still true. | `hasAccess` | | |
| Sign-ups | Users docs created in the period (one per `rosterPeople` row), not events. | | users docs | 60 s |
| New orgs | Org docs with `createdAt` in the period. | | | |
| Activation funnel | Per org created in the period: first invitation (`invitations` by `organizationId`, earliest `createdAt`), first booking (earliest `bookings` `createdAt`), first fully signed sheet. **From records, not events** (AUDIT: the funnel events are never sent). | | rollup | nightly |
| DAU / WAU / MAU | Distinct people seen per day / 7 days / 30 days, from the daily rollup. Starts on the day it ships; earlier days show "Not recorded" (D1). | | rollup | nightly |
| Web vs iOS | People seen by platform. **Needs `lastSeenFrom` and `lastSeenAppVersion` on users docs** (new fields, a rulebook + iOS change, D6). "Not connected" until then. | | | |
| Retention cohorts | Of people who signed up in month M, the share seen in each later month. From the daily rollup's `activePeopleIds`, from its first day. | | rollup | nightly |
| Logins | **Removed.** It double counts (AUDIT O1), and `lastSeenAt` covers activity. | | | |
| Feature usage | `productEvents` counts by name in the period, labelled "web, people who accepted analytics cookies only". | | events (bounded query) | open |
| Emails sent / failed | `emailLog` rows by type and status (new, §3.4). | | | live |
| Push sent / failed | Daily counters written by the push function (new). | | | live |
| Job last run | `ownerStats/jobs/runs/{name}`. | | | live |
| App versions in use | From `lastSeenAppVersion` (D6), compared with `minimumIosBuild` (`appUpdateRequired`). | `appUpdateRequired` | | |
| Errors, Website stats | **Not connected** (D7, D8). | | | |

---

## 3. Data plan

### 3.1 Server routes (all `requireOwnerSession` + `enforceRateLimit` + audit for writes)

| Route | Method | Returns / does |
|---|---|---|
| `/api/owner/directory/orgs` | GET | Paged org rows: `cursor`, `q` (name, id), `sort`, `filter` (test, scheduled, lapsed, unfinished), `includeTestData`. Columns per spec §4.3; money from rollups. |
| `/api/owner/directory/people` | GET | Paged person rows (one per `rosterPeople` row across orgs; `q` = name, email, uid, org). Auth facts are added only on the person page. |
| `/api/owner/search` | GET | ⌘K: orgs and people by name, email, org id or uid (top 10 each). |
| `/api/owner/counts` | GET | Headline counts via `runAggregationQuery` (count / sum) over REST. |
| `/api/owner/orgs/[id]` | GET | Org 360, one tab per `?tab=` (summary, people, jobs, bookings, timesheets, leave, billing, datacheck, activity, audit, notes). |
| `/api/owner/people/[uid]` | GET | Person 360: Auth record (service account; "Not connected" without it), every users doc (`personIdSet`), memberships, push token count (never the tokens), timesheets, audit. |
| `/api/owner/money` | GET | Timesheet value by period, org, category, currency, from rollups plus the live current month. |
| `/api/owner/revenue` | GET | §2 revenue metrics. |
| `/api/owner/growth` | GET | §2 growth metrics. |
| `/api/owner/health` | GET | Job runs, app versions, rulebook web version (`rulebookStamp`), switches (`platformConfig/app`), data quality counts. |
| `/api/owner/needs-you` | GET | The queue (§4.2 of the spec), computed from the sources it names; status and notes in `ownerNotes`. |
| `/api/owner/reveal` | POST | Reveals one masked field (email, phone, rate, tax id) and audits it. Replaces the browser's `/api/owner/audit` "reveal" call. |
| `/api/owner/notes` | POST | Create or update an owner note or tag (`ownerNotes/{id}`). |
| `/api/owner/actions/*` | POST | §4 actions. Every one takes `{ preview: true }` first (dry run, nothing written) and then `{ confirm, reason }`. |
| `/api/owner/audit` | POST | **Removed** once nothing calls it (A4). |

### 3.2 Aggregation queries

Use `runAggregationQuery` over REST with the owner's token:
- count of `organizations`; `users` where `isActive != false`;
- `users` where `lastSeenAt >= since`;
- `organizations` where `deletion.status == 'scheduled'`;
- `organizations` where `billing.status == x`;
- `invitations` where `isUsed == false`.

Test-data exclusion for counts: count all, then subtract the test orgs and people, which are few, listed and fetched by `isInternal == true` / `isTest == true` queries. Indexes: single-field indexes cover these. No composite index is needed until a filter combines two fields; add any to `firestore.indexes.json` in the PR that needs it.

### 3.3 Rollups (Cloud Functions)

New `functions/ownerRollups.js` (pure, unit-tested like `organizationEraser.js`) plus:
- `exports.ownerRollupsNightly = onSchedule('every day 02:41', Europe/London)`;
- `exports.ownerRecalculate = onRequest`: checks the Bearer token is the verified owner. It can't check the MFA cookie (another domain), so the web route `/api/owner/actions/recalculate` checks fresh MFA, then calls it with the owner's token plus a server key (D10).

What it writes:
- `ownerOrgStats/{orgId}/monthly/{yyyy-mm}`: `{ currency, timeZone, value: { pence, sheets, hours, standardLabour, overtimeLabour, priceWork, expenses }, notPriced: [{ sheetId, personId }], reopened: [{ sheetId, personId }], byPerson: { [personKey]: pence }, computedAt, rulebookVersion }`. Month = the sign-off month in the **org's** zone.
- `ownerStats/platform/daily/{yyyy-mm-dd}`: `{ activePeopleIds (hashed), activeOrgIds, signups, newOrgs, mrrPence, payingOrgs, trials, failedPayments, byPlatform? }`.
- `ownerStats/jobs/runs/{jobName}`: `{ lastRunAt, ok, durationMs, summary, error }`. `eraseDeletedOrganizations` and the auth-claims triggers write theirs too (one line each; the auth claims write a per-day counter, not per call).

**Reopened sheets** need bookings: per org per month, load that month's labour and manager site bookings once (bounded by date) and pass them to `signedTimesheetBookingChanges`.

**Backfill:** `scripts/owner-rollups-backfill.mjs` (dry run by default, `--apply`, `--from 2025-01`) calls the same pure function with the Admin SDK. The owner runs it.

### 3.4 Logging (new, small)

- **`emailLog/{id}`**, written by `functions/email/handler.js` after each send attempt: `{ type, status: sent|failed|deduped|rate_limited, providerMessageId, organizationId, recipientCount, at }`. **No body, subject or addresses.** Kept 180 days (TTL field `expireAt`; the owner enables the TTL policy, D9).
- **Push counters:** the push function increments `ownerStats/push/daily/{yyyy-mm-dd}` `{ sent, failed, skipped }` (one write per notification, batched counters).
- **Bounces:** only if the owner chooses the Resend webhook (D9).

### 3.5 Security rules (budget: `scripts/rules-budget.json`; root-level rules cost little)

Root additions, all **read by owner only; written by no client** (the server and functions use the service account or Admin SDK):
- `ownerStats/{document=**}`
- `ownerOrgStats/{document=**}`
- `emailLog/{id}`
- `erasedOrganizations/{id}` (L3)
- `ownerNotes/{id}`: **owner read and write** (it's the owner's own data; through the route).

Changes:
- `adminAuditLog`: create allowed **only** with `actorUid == request.auth.uid` and the A4 field shape; never update or delete (test: owner, admin, everyone refused). After the service account is live, drop client create entirely (D10).
- `productEvents` create: fields `hasOnly([...])`, `eventName` a string ≤ 60, `metadata` a map, size limits (M2).
- Remove the dead `analyticsDaily` / `analyticsMonthly` / `analyticsTotals` / `ownerAlerts` / `adminJobs` matches (L1) once nothing reads them (grep first).
- **Not here:** `productFeedback` counters (M3). They touch the customer feedback flow, so they get a separate PR.

Every new or changed rule gets an emulator test: owner allowed; super admin, admin, manager, operative, signed out and unverified email refused (spec §6.3.2). Add the new test file to `npm run test:rules`. Check the compile cost and the rules type check (`owner-working-style.md`).

### 3.6 Rulebook changes (each one bumps `docs/RULEBOOK.md` with the iOS hand-off)

1. **`signedTimesheetValueOf({ sheet, subject, roster, timeZone })`**, moved from `lib/owner/signedTimesheetValue.ts` into `lib/canonical`. It returns `{ fullySigned, signedAtMs, pence, hours, parts, labourCounted, currency }`. The "fully signed" test inside uses `isTimesheetFullySigned` with the counter-sign rule the web uses today (`requiresLineManagerCounterSign` → canonical `timesheetSelfSigned`), so web and functions agree. A new §8 paragraph "Platform owner value". The iOS hand-off is a sync only (no iOS screen).
2. (D6) **`lastSeenFrom` and `lastSeenAppVersion`** on `users/{uid}`, written with the `lastSeenAt` heartbeat by both apps (§1 device-owned field). Added to `USER_DOCUMENT_FIELDS` and the auth-claims ignore list (it must not trigger a claims recompute). The iOS hand-off adds the write.

---

## 4. Actions plan

All actions:
- go to `POST /api/owner/actions/<name>` and call `requireOwnerSession({ fresh })`;
- follow A4 auditing;
- run `{ preview: true }` first; the dialog shows that result;
- need a reason of 3–500 characters.

"Fresh" means MFA within 10 minutes.

| Action | Route | Rulebook / code path | Confirmation | Fresh | Notes |
|---|---|---|---|---|---|
| Send password reset | `send-password-reset` (existing, moved) | `adminPasswordResetLink` | button + reason | no | The 2-minute guard moves from memory to `ownerStats/rateLimits/{key}` (survives restarts, M4). |
| Resend invite | `resend-invite` | shared helper extracted from `app/api/invites/send-setup-email` | names person + org | no | Only an unused invitation. |
| Resend verification | `resend-verification` | `accounts:sendOobCode VERIFY_EMAIL` | names person | no | |
| Change login email | `change-email` (existing, hardened) | `adminUpdateAuthEmail`, then **every** org the person is in (claims and roster rows per membership) | type the new email twice | **yes** | Writes Firestore first and Auth last; on failure it reports the step reached (fixes AUDIT 20). |
| Disable / re-enable sign-in | `set-sign-in` | new `adminSetAuthDisabled(uid, bool)` (`accounts:update disableUser`) + `adminRevokeRefreshTokens` | type the person's email | **yes** | Not an org deactivation. Never the owner. |
| Sign out everywhere | `revoke-sessions` | `adminRevokeRefreshTokens` | names person | **yes** | |
| Reset MFA | **not needed** | — | — | — | MFA here is an emailed code, not a phone factor [Certain: `lib/auth/mfa`]. A lost phone doesn't lock anyone out, and "Sign out everywhere" forces a new code. Drop from the catalogue (D14). |
| Deactivate / reactivate in an org | `set-org-active` | `userActiveWrites` (§11) | names person + org | **yes** | Same writes as an org admin; `lineManagerChangeBlock` refusal shown as-is. |
| Transfer Super Admin | `transfer-super-admin` | `superAdminTransferWrites`, candidates from `superAdminSuccessors` | type the org name | **yes** | |
| Delete user | `delete-user` | `accountDeletionPath` → `executeAccountDelete` (`lib/account/accountDeleteAdmin.ts`) | type `DELETE` + person's email | **yes** | `handover_required` is shown, not overridden. `delete_with_company` goes through Delete organisation. Needs the service account. |
| Delete unfinished sign-up | `delete-unfinished-user` (existing, **fixed**) | server re-checks: no org, or org unfinished; `passwordSet` false or created more than 12 months ago; not a member anywhere. Then the `delete-user` path. | type email | **yes** | Fixes H2. |
| Delete organisation | `delete-organisation` (replaces 501) | `organizationDeleteConfirmationError` + `scheduleOrganizationDeletion({ restoreBy: 'platform_owner' })` | company name + `DELETE` | **yes** | **D5:** that function also cancels Stripe at the period end. |
| Restore organisation | `restore-organisation` | the existing `app/api/organization/restore` logic | type org name | **yes** | Also resumes Stripe (D5). |
| Erase now | **not built** unless D15 is yes | — | — | — | |
| Mark test / internal | `mark-internal` (existing) | separate `isInternal` and `isTest` (today both are set together) | button + reason | no | |
| Export org data | **D11** | the existing company export (Settings → Data export) run server-side | | yes | |
| Owner notes and tags | `notes` | `ownerNotes` | — | no | |
| Recalculate rollups | `recalculate` | `ownerRecalculate` function | button | **yes** | |

---

## 5. Decisions needed (with recommendations)

| # | Question | Recommendation |
|---|---|---|
| D1 | What is "active"? | **Seen** (`lastSeenAt`) in the period, web or iPhone. One person counts once. An org is active when one of its people is. Past days come from the daily rollup, so history starts the day it ships. |
| D2 | Which month does signed money belong to, and what happens to reopened sheets? | The **sign-off** month (the money became final then; work-period dates can change while unsigned). Reopened sheets are listed and **not** counted until re-signed. Optional second view: "by work period". |
| D3 | PAYE on the money page? | Self-employed £ only (PAYE has no timesheet £ by rulebook §8). PAYE shows overtime **hours** from overtime reports. |
| D4 | Churn history before the rollup exists | Accept "from today". Optional: a read-only Stripe call later. |
| D5 | Delete / restore organisation from the console touches Stripe (cancel or resume at period end). The spec says "no billing changes". | Allow it, because the rulebook §20 deletion **is** that cancel. The dialog says so, and it's audited. Otherwise the owner must cancel in Stripe by hand first. |
| D6 | Record platform and app version on each person (new users fields, iOS change) | **Yes.** It's the only source for web vs iOS and app versions. |
| D7 | Errors source | A small sampled `clientErrors` collection (web + iOS, at most 20 per user per day, message + route + build, no personal data) is free at this size. A hosted tool such as Sentry has a free tier, but sends data to a third party and needs a privacy-policy line. Recommend `clientErrors`. "Not connected" until answered. |
| D8 | Website stats source | Netlify Analytics (paid add-on, ~$9/month) or Plausible (~£9/month, privacy-friendly). Recommend Plausible, later. "Not connected" until then. |
| D9 | Email bounces | Add the Resend webhook later (one more server route). `emailLog` now. Enable a 180-day TTL on `emailLog.expireAt`. |
| D10 | Audit rows written only by the server (needs the service account) | Yes, once the key is set. Until then the owner token writes them with the strict shape rule. |
| D11 | GDPR org export format | Reuse the existing ZIP (CSV per area + JSON), generated server-side and downloaded once. |
| D12 | Test-data rule | Only `isInternal` / `isTest` flags count, never a name guess. Mark the owner's test orgs once with Mark test. Guardrail 3: real people with "test" in their name **reappear** in counts. |
| D13 | Rollup path name | `ownerOrgStats/{orgId}/monthly/{yyyy-mm}` (root, owner-only). |
| D14 | "Reset MFA" | Not needed (emailed code); use Sign out everywhere. |
| D15 | Erase now | No (owner default). |
| D16 | Feedback copies in customers' users docs (`ppIdea*`) | Stop writing them, keep reading for one release, then a clean-up script. Separate PR after the console. |
| D17 | Releases & switches editing | Read-only now. Editing later with confirm + audit, one switch at a time. |

---

## 6. Service account (owner steps; give these in PR 1, one per step)

1. Google Cloud console → project `project-planner-f986c` → **IAM & Admin → Service accounts → Create service account**. Name: `owner-console-server`.
2. Roles: **Firebase Authentication Admin** and **Cloud Datastore User**. (Stripe isn't Google; the Stripe key is separate and already on Netlify.) Skip Owner and Editor.
3. Open the account → **Keys → Add key → JSON**. A file downloads. **Don't paste it into any chat.**
4. Netlify → Site configuration → Environment variables → **Add a variable**:
   - name `FIREBASE_SERVICE_ACCOUNT_JSON`;
   - value = the whole file contents;
   - scope "Functions";
   - mark it as secret.
5. Netlify → Deploys → **Trigger deploy**.
6. Open `/developer/health`. "Server key" reads **Connected** (`firebaseAdminConfigured()` plus one test token request; the page never shows the key).
7. Delete the downloaded file from your Mac.

This also turns on customer **Delete my account** and **Delete organisation**, which return 501 without it (AUDIT H3).

---

## 7. Test plan

- **Seed:** `scripts/owner-console-seed/seed.mjs` writes to the emulator only and refuses to run unless `FIRESTORE_EMULATOR_HOST` is set. It contains everything in spec §6.2. Old shapes come from `lib/canonical/cross-platform-contract.json`. Timesheets are built with the canonical writers.
- **Fixtures:** `scripts/owner-console-seed/expected.json`, generated by `expected.test.ts` with the canonical functions and checked in. One figure per metric per org per month.
- **Unit:**
  - `lib/owner/*.test.ts` (metrics, directory, search, filters, test-data rule, contracts present);
  - `functions/ownerRollups.test.js`;
  - route tests in `lib/owner/routes/*.test.ts`, which call the route handlers with mocked `fetch`: 401, 403, not fresh, bad input, rate limit, exact writes and one audit pair, idempotent, part failure.
- **Rules:** `tests/ownerConsole.rules.test.ts`, added to `test:rules`.
- **E2E:** `@playwright/test` dev dependency. `npm run test:owner-e2e` starts the Firestore + Auth + Functions emulators, seeds, runs `next start` against them (`NEXT_PUBLIC_USE_EMULATORS=1`, a new env switch in `lib/firebase/config.ts`), signs in the owner and an org super admin, and covers spec §6.3.5. It uses Chromium from `/opt/pw-browsers` in the cloud; on CI, `npx playwright install chromium`.
- **CI:** new jobs in `.github/workflows/web-ci.yml`: `rules-tests` (`npm run test:rules`), `storage-rules-tests` (after the storage suite is fixed or explained; it fails 20/28 today, AUDIT §1), `owner-e2e`. They are required checks.
- **Customer no-regression:** the e2e suite records the Daily Overview, Weekly Report and Timesheet figures for the seed before and after, and asserts they're equal.

---

## 8. PR list (in order; each ends with "Smoke test for you" and "If something's wrong")

| PR | Contents | Owner deploys after |
|---|---|---|
| **0. Security hotfix** (small, first) | **C1:** the owner skip only when the owner's Auth account was created < 24 h ago (Identity Toolkit `accounts:lookup` with the caller's own ID token returns `createdAt` [Likely: confirm in the PR]; no service account needed). **C2:** `accountConfirmed === false` skips only under the same < 24 h test. **H1:** `requireOwnerSession` on all six owner routes (MFA cookie uid = token uid). **H2:** `delete-unfinished-user` re-checks on the server and refuses live people. Failing tests first for each. Raise `minimumIosBuild`? **No**: iOS doesn't use these routes [Likely: check the iOS repo for `grant-setup`]. | Netlify deploy only (automatic on merge). |
| **1. Foundations** | Seed, fixtures, Playwright harness and CI jobs; `requireOwnerSession({ fresh })` with `iat` in the MFA cookie; A4 audit; `isTestOrganisation`; directory, search and counts routes; new sidebar groups (spec §4) with the old pages kept; the store stops downloading events and sessions (bounded to the page's period); the service-account steps. Rules: the `adminAuditLog` shape rule, `ownerNotes`, `erasedOrganizations` read, and tests. | Publish rules. |
| **2. Command centre** | §4.1. The old scoreboard moves to Growth. | — |
| **3. Needs you** | §4.2 + `ownerNotes` status. | — |
| **4. Organisations 360** | List + tabs; the delete / restore / mark-test / transfer actions. | — |
| **5. People 360 + actions** | Directory, person page, all person actions; `collapseDirectoryUsers` removed. | — |
| **6. Money + rollups** | Rulebook `signedTimesheetValueOf` (version bump + iOS sync hand-off); `functions/ownerRollups.js`, nightly + recalculate; the backfill script; root rules; the money page; reconciliation of 3 orgs × 2 months in the PR. | Deploy functions `ownerRollupsNightly`, `ownerRecalculate`; publish rules; run the backfill dry run, then `--apply`. |
| **7. Revenue** | §4.6 with the §2 contracts. | — |
| **8. Growth** | §4.7 from records + rollups. | — |
| **9. Health** | Job runs (eraser and auth claims write their last run), app versions (if D6), switches read-only, data quality counts per org, rulebook version. | Deploy the changed functions. |
| **10. Audit log** | Live, filters, before/after, CSV export. | — |
| **11. The rest** | Emails & notifications (`emailLog`, push counters), Errors / Website stats "Not connected" or the chosen source, Feedback / Roadmap / Register interest in the new layout, owner writes moved to routes. Remove `useAnalyticsStore` and the `/api/owner/audit` route. | Deploy functions `sendEmail`, `sendDevicePushOnNotificationCreate`; publish rules. |
| 12 (later) | D16 feedback clean-up; M3 `productFeedback` counter rule; D6 iOS fields. | |

---

## 9. What this plan did not check

- Production data volumes and real read counts (no production access).
- Whether `FIREBASE_SERVICE_ACCOUNT_JSON` is on Netlify.
- The iOS repo (whether iOS calls `grant-setup`, or writes `productEvents`).
- Why the storage-rules suite fails here.
- Any browser run of the console.
- The design reference HTML (not in the repo).
