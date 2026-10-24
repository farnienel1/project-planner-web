# Project Planner web

The canonical rulebook is the single source of business rules for this web app and the iOS app. Both platforms run the same rules from `lib/canonical`, so they read and write the same data and show the same results. Every change follows it.

## The rulebook

@AGENTS.md
@.cursor/rules/canonical-architecture.mdc
@.cursor/rules/shared-operational-change.mdc

The full boundary, every shared function and the iOS side are described in `docs/CANONICAL_ARCHITECTURE.md`. Read it before changing bookings, warnings, invoicing, labour, organisation context, dates, people, invites, notifications or billing.

## Always

1. Point to the rulebook. Before writing logic, search `lib/canonical` and call the existing function. Name the canonical function you used in your report.
2. One rulebook. Never add a second calculator, status enum, Deleted-user check or toggle list in a page, store, hook or API route.
3. Shared changes start in `lib/canonical`. Export through `bundleEntry.ts`, add a test in `lib/canonical/canonical.test.ts`, and update `docs/CANONICAL_ARCHITECTURE.md`. The pre-commit hook packs `lib/canonical/dist/canonical-business.js`, and that packed file is what iOS commits as `Project Planner/Canonical/canonical-business.js`. Its sha256 must match on both sides.
4. Platforms disagree: trace the first divergence (database, query, organisation context, business rule, date rule, cache, then UI). Never patch a screen number to match the other platform.
5. After a shared-rule change, give the follow-on prompt for the iOS window from `shared-operational-change.mdc`, so iOS calls the same function through `CanonicalBusinessEngine`.
