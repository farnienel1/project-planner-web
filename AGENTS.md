# Project Planner web

Business rules that the iOS app must also follow live in `lib/canonical/`. Read `docs/CANONICAL_ARCHITECTURE.md` before changing bookings, warnings, invoicing, labour, organisation context, or dates.

## Rules

1. Canonical business logic. Search `lib/canonical` before adding or changing a business rule. Do not implement that rule again in a page, store, or hook.
2. Organisation context. Organisation-scoped reads and writes use `adoptCurrentOrganization` / `organizationContextStillCurrent`. Do not infer the open company from a stale user field, a cache entry, or another organisation's listener.
3. Architectural changes. A change to business logic, data access, organisation handling, or cross-platform behaviour updates `lib/canonical` and `docs/CANONICAL_ARCHITECTURE.md` in the same change.
4. New business logic. A rule that both web and iOS must share is added to `lib/canonical/engine.ts` and the canonical bundle. UI and navigation stay in the app.
5. Discrepancies. If web and iOS disagree, find the first divergence (database, query, organisation context, business rule, date rule, cache, then UI). Do not patch the screen to copy the other platform's number.
6. Regression tests. A cross-platform discrepancy gets a test in `lib/canonical/canonical.test.ts` that locks the shared result.

`npm test` rebuilds `lib/canonical/dist/canonical-business.js` and the copy under the iOS repo. Commit both outputs when the canonical module changes.
