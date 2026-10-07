# Canonical architecture

Web and iOS are separate repositories and separate languages. They share one executable business core. Screens, navigation, and platform persistence stay in each app.

## Paths

| Piece | Path |
|---|---|
| Canonical core | `project-planner-web/lib/canonical/` (`engine.ts` for windows, organisation, and slots; `warningRows.ts` for which qualification, unverified, and unbooked warnings exist) |
| Web consumption | Import `@/lib/canonical`. Existing modules such as `lib/warnings/warningLookahead.ts`, `lib/orgMembership/webActiveOrg.ts`, and `lib/timesheets/timesheetWeekUtils.ts` call that module instead of keeping a second copy. |
| iOS consumption | `Project Planner/Canonical/canonical-business.js` is the bundle built from `lib/canonical/bundleEntry.ts`. `Project Planner/Canonical/CanonicalBusinessEngine.swift` evaluates it. Warning scans and invoicing defaults use that result, with `Europe/London` when the script cannot load. |
| Bundle command | `npm run build:canonical` in the web repo. `npm test` rebuilds it. |
| Backend | There is no Cloud Functions package. Firebase security rules are the server-side organisation boundary: `project-planner-web/firestore.rules` and `project-planner-ios/Project Planner/firestore.rules`. |
| Organisation context | `adoptCurrentOrganization` / `currentOrganizationId` in `lib/canonical/engine.ts`. The web auth store calls it when the signed-in company changes and on sign-out. iOS keeps the open company on `FirebaseBackend.currentOrganization`. Both compare ids with `organizationIdsMatch` (trim, then case-insensitive). |
| Architecture rules | `project-planner-web/AGENTS.md`, `project-planner-web/.cursor/rules/canonical-architecture.mdc`, and `project-planner-ios/AGENTS.md`. |

## What is shared

The canonical module owns:

- Organisation id matching and which company a session should open
- The in-process organisation epoch used to drop a late result after a switch or sign-out
- Invoicing-period bounds, including wrapped payment runs and short months
- Warning coverage windows (`numberOfDays`, full Monday–Sunday week, invoicing period)
- Organisation time zone for those windows (default `Europe/London`, never the device zone)
- Named booking slots (`FULL DAY` / `FULL_DAY`, `AM`, `PM`)
- Whether two minute intervals clash
- Cache key shape `kind:organizationId`
- Which qualification warnings exist, which operatives are unverified, and which people are unbooked labour (`qualificationExpiryRows`, `unverifiedOperativeRows`, `unbookedLabourRows`)

## What stays in each app

- SwiftUI and React screens, navigation, and copy
- Firestore listeners, offline outbox, and local databases
- Clash timeline math and the material cut-off message (`lib/warnings/generateOrgWarnings.ts` and `Core/WarningsComputation.swift`). Those dates use the London business calendar on iOS
- Overtime and break payroll (`Core/PayrollHoursEngine.swift` and the web timesheet helpers that are not named slots)

Do not add a second coverage window, a second unbooked-person loop, or a second `FULL DAY` hour value.

## Organisation context

One signed-in session has one current organisation id.

Web order, in `chooseSessionOrganization`: explicit switch, then the company this browser remembered (`pp.webActiveOrg:{userId}`), then `users/{uid}.organizationId`. A confirmed non-member is skipped. A slow read does not throw away the remembered company.

iOS stores the open company on the backend object and `cached_organizationId`. Membership still has to include that company. The browser and the phone may show different companies until the person switches on that device. Each device still has only one active company.

## Switching organisation

Switching is not a single assignment.

1. Membership in the destination company is checked before its data is shown.
2. `adoptCurrentOrganization` advances the epoch on web. iOS replaces `organizationSwitchToken` and removes the previous organisation listener.
3. A Firestore listener started for company A does not call the callback that now belongs to company B (`lib/firebase/subscribeOrgCollection.ts`).
4. `runOrgLoad` does not keep a successful cache entry when the epoch changed during the request.
5. Booking creates and edits do not write the response into the store when the epoch changed.
6. iOS `SmartCacheService` and `PersistenceService` key memory and UserDefaults by the current organisation id, and by user id. Signing out clears `cached_organizationId`.

## Firebase authorisation

`canAccessOrganization` is membership in that organisation (the user document, the members map, or the creator). On the web rules, the platform owner account is also allowed. An admin flag on the user document is not membership in every company. `organizationExists` is not access.

A signed-in user can still list organisation documents. The apps query that list with `members.{uid}` or `creatorUserId`. Tightening the list rule further has to stay compatible with those two queries. Subcollection reads and writes, and a direct read of another company's organisation document, are membership-scoped.

Other role gaps inside one company (for example who may edit settings) are listed in `project-planner-ios/app-tests/rules/firestore.rules.test.mjs`. Closing the cross-company hole does not by itself close those.

## Where new business logic goes

If both apps must agree, add the function under `lib/canonical/` (`engine.ts` or `warningRows.ts`), export it from `lib/canonical/index.ts` and `bundleEntry.ts`, then call it from web and from `CanonicalBusinessEngine`. Committing that change packs the script. `.githooks/pre-commit` runs `npm run build:canonical`, stages `lib/canonical/dist/canonical-business.js`, and refuses the commit when the iOS checkout beside this repo has an uncommitted packed file. `npm install` turns the hook on. `npm run check:canonical` fails when a packed file does not match the rulebook.

## Agent windows

UI work can stay in one repository. Shared business rules cannot.

A window that only has the web repo may change screens and may change `lib/canonical`. A commit that touches `lib/canonical` packs the script and stages `lib/canonical/dist/canonical-business.js`. The pack is written to `Project Planner/Canonical/canonical-business.js` only when the iOS checkout is at `../project-planner-ios`, and the website commit is refused until that iOS file is committed. If that checkout is not there, commit the web packed file and copy it into the iOS repo in a change that has the iOS repo. Do not leave the phone running an older script.

A window that only has the iOS repo may change SwiftUI and data loading. Shared results come from `CanonicalBusinessEngine`. Do not edit `canonical-business.js` by hand, and do not add a second calculator for a rule the script already has. A new shared rule is added in the web `lib/canonical` module, the script is rebuilt, and both copies are committed.

A workspace with both repositories changes the TypeScript, rebuilds, and commits both generated scripts in the same phase.

## First divergences this architecture closes

Warning counts differed because the scan window was calculated twice, and because qualification, unverified, and unbooked rows were selected twice. Web used the organisation time zone. iOS used `Calendar.current`, so a person outside the UK could be on a different calendar day, and an empty payment-run list fell back to days 1–2 instead of the half-month default. The shared window and the shared row functions are the fix. The count is whatever those functions produce from the same data, settings, and time zone. It is not copied from one screen onto the other.

Bookings differed for the same reason when a listener for company A could still publish into the store after a switch to company B, and when local caches were not keyed by organisation.
