# Platform guardrails

These rules come from bugs this project has actually had. Each one names the bug it prevents. They apply to web and iOS alike, alongside `feature-completeness.md`. Where a CI check exists, it is named; fix the code rather than silencing the check.

## 1. One "who is this person" rule

**Bug it prevents:** a person has several records — an old invite id, an `operatives` row, a second users document on the same email. Code that matched on one id skipped 3 overtime lines, hid a live manager from the job picker, and left demotions half applied.

- To match a person to bookings, leave, timesheets, claims, approvals or notifications, use the rulebook's person-id functions: `personIdSet`, `bookingIdsForAccount`, `leaveRecordsForAccount`, `userIdAliases` from `rosterPeople`, and the overtime/claims person-ids rule from 1.32.
- Never compare a single `user.id === booking.operativeId`.
- Never pick "one operatives row by email" (`findOperativeForUser` and the like) for anything except display.
- Writes about a person (Manage Users) reach every users document of that person in the organisation: use the unfolded roster, not the email fold.
- CI: `scripts/check-second-calculators.mjs` flags direct person-id equality in screens, stores and hooks.

## 2. The organisation's time zone only

**Bug it prevents:** web job dates and Book labour used London time, and iOS Scheduling uses the device calendar. A company outside the UK, or a phone abroad, gets the wrong day.

- Every day key, weekday, week, weekend test, payrun and "today" comes from the rulebook with the organisation's time zone: `organizationTimeZone`, `dateFromDayKeyInZone`, `addDaysInZone`, `isoWeekdayOfDayKey`, iOS `OrganizationRulebookContext`.
- Never use `new Date().getDay()`, London-only helpers (`londonMidnight`, `londonIsoWeekday`), or `Calendar.current` / `TimeZone.current` for a business date in a screen or store. Display formatting may use the organisation zone only.
- CI: the same script flags these patterns outside `lib/canonical`, with a reviewed allow-list for display-only uses.

## 3. Never hide old data

**Bug it prevents:** a 1.30.2 rule narrowed the Exported timesheets list, and the owner's own exported sheets vanished, as did inactive people's.

- A change that shows fewer rows anywhere (a new filter, a scope, a stricter reader, a role check) must say in the PR exactly which existing records drop out of view and why. Test it with real old document shapes (cross-platform contract samples, older field names, ids in other letter case, inactive and deleted people).
- If existing records disappear from a list a user relied on, that is an owner decision. Ask, and record the answer in `docs/OWNER_DECISIONS.md`.
- Readers never drop a row because of an unknown value; they read it as the default (rulebook §1).

## 4. Release order: web, rules and iOS together

**Bug it prevents:** web 1.31 went live while the 1.31 Firestore rules could not deploy and iOS was still on 1.30.3, so the three disagreed for an afternoon.

- A release that changes `firestore.rules` or `storage.rules` is merged on web only when:
  - the rules compile on the local emulator, and
  - the owner has the deploy commands that day.
- iOS adopts it the same day or the next; the `web-drift` check fails on every iOS branch until it does.
- A release that changes pay, hours or who may write a document must raise `minimumIosBuild` (rulebook §18) before the behaviour is switched on, so an older iOS build cannot calculate differently or be refused mid-save. The PR says whether this is needed.
- Each PR body says what the owner must deploy (rules, storage, indexes, which functions) or "nothing to deploy".

## 5. Security rules size budget

**Bug it prevents:** `firestore.rules` grew from 145 KB to 188 KB in a week. Google's rules checker then timed out with HTTP 503, and the deploy failed for hours.

- CI checks `firestore.rules` against a byte budget and fails above it.
- The per-request expression counts measured on the emulator (line manager decides leave, admin edits a user, admin updates the organisation, admin creates a project) are kept in the PR when rules change, and must not exceed the previous release without a stated reason.
- Prefer shared functions with `let` bindings over repeated blocks. Move long rationale comments to `docs/`. Delete dead functions.

## 6. Owner decisions live in the repo

**Bug it prevents:** owner decisions were kept in a session's working notes and would have been lost when the session ended.

- `docs/OWNER_DECISIONS.md` is the register. Every decision is added there, with date and status, in the change that acts on it.
- Plans and PRs quote the rows they implement. A PR that completes a row updates its status.

## 7. UI-only means UI-only

**Bug it prevents:** an iOS design pass found that editing a PAYE booking from Scheduling silently removed the unpaid break. A restyle could just as easily introduce such a change unnoticed.

- A change described as UI-only changes no model, store, write payload, calculation, permission or navigation destination.
- It is proven by a test, not by eye: the same booking saved before and after shows identical figures on Daily Overview, the weekly report and timesheets (`payrollHoursResult` inputs and the written fields compared).
- A behaviour bug found during UI work is fixed in its own clearly labelled commit, listed in the PR, and recorded in `docs/OWNER_DECISIONS.md` when it changes what users see.
