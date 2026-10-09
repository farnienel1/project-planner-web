# Project Planner web

Business rules that the iOS app must also follow live in `lib/canonical/`. Read `docs/CANONICAL_ARCHITECTURE.md` before changing bookings, warnings, invoicing, labour, organisation context, or dates.

## Rules

1. Canonical business logic. Search `lib/canonical` before adding or changing a business rule. Do not implement that rule again in a page, store, or hook.
2. Organisation context. Organisation-scoped reads and writes use `adoptCurrentOrganization` / `organizationContextStillCurrent`. Do not infer the open company from a stale user field, a cache entry, or another organisation's listener.
3. Architectural changes. A change to business logic, data access, organisation handling, or cross-platform behaviour updates `lib/canonical` and `docs/CANONICAL_ARCHITECTURE.md` in the same change.
4. New business logic. A rule that both web and iOS must share is added under `lib/canonical/` and the canonical bundle. UI and navigation stay in the app. Qualification, unverified, and unbooked warning rows are `lib/canonical/warningRows.ts`. Annual leave against bookings is `lib/canonical/leaveCoverage.ts`. Allowance vs year-count, the leave year, and a one-year remaining override are `lib/canonical/annualLeaveBalance.ts`. Material catalogue search is `lib/canonical/materialSearch.ts`. The standard day and its AM/PM halves are `halfDayWindows` in `lib/canonical/engine.ts`; never compute a midpoint elsewhere. Who sees every job and every warning, who may add or edit a work catalogue, and which managers receive a job notification are `lib/canonical/staffAccess.ts`. The `users/{uid}` document, employment-type day rule, and Edit User permission copy are `lib/canonical/userProfile.ts`.
5. Discrepancies. If web and iOS disagree, find the first divergence (database, query, organisation context, business rule, date rule, cache, then UI). Do not patch the screen to copy the other platform's number.
6. Regression tests. A cross-platform discrepancy gets a test in `lib/canonical/canonical.test.ts` that locks the shared result.

A commit that touches `lib/canonical` packs the rulebook through `.githooks/pre-commit` and stages `lib/canonical/dist/canonical-business.js`. When `../project-planner-ios` is checked out, that commit is refused until `Project Planner/Canonical/canonical-business.js` is committed there. `npm test` packs and then runs `npm run check:canonical`. An agent window with only this repo must not hand-edit the iOS script. An agent window with only the iOS repo calls `CanonicalBusinessEngine` and does not add a second calculator for a rule this module already owns.
