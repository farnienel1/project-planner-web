# 26 — Switch organisation

iOS parity source: `Views/SwitchOrganisationView.swift`, `Views/SettingsView.swift` (Personal row), `Core/FirebaseBackend+OrganizationMembership.swift`, `Core/OrganizationMembershipSupport.swift`

Screenshots: none in `docs/ios-parity/screenshots/` this run.

## Purpose

Any signed-in user can pick which organisation is active. Reached from **Settings → Personal → Switch organisation** (`SettingsView.swift:63–64`, `212–227`). Not admin-gated.

## Layout (top → bottom)

1. Nav title: **Switch organisation** (`SwitchOrganisationView.swift:53`)
2. Intro card: **Work across teams** / *Choose which organisation you want to use in the app. Your schedule, projects, and settings will update to match.* (`66–69`)
3. Loading: **Loading organisations…** (`32`)
4. Empty: **No organisations found** / *If you were invited to another organisation, pull to refresh or sign out and sign in again.* (`81–84`)
5. Section: **YOUR ORGANISATIONS** (`38`, `94–96`)
6. Rows: building icon · name · role · optional **Trial** / **Locked** · trailing **Active** / lock / chevron (`118–187`)
7. Inline error in red (`42–47`)

No primary CTA. Each switchable row is a button. Disabled when already active, switching, or locked (`186`).

## Data

Load (`FirebaseBackend+OrganizationMembership.swift:17–62`):

1. `organizations` where `members.{uid} != ""` (role from members map, else `member`)
2. `organizations` where `creatorUserId == uid` (role `admin` if not already listed)
3. Map through `OrganizationTrialPolicy.membershipSummary`
4. Sort: active org first, then name A→Z

Trial (`OrganizationMembershipSupport.swift:55–65`): `isTrial == true` or `subscriptionStatus`/`billingStatus` == `trial`. Locked: `trialAccessBlocked` or `accessBlocked`.

## Switch write (`switchActiveOrganization`, `66–136`)

Updates `users/{uid}`: `organizationId`, `role`, `updatedAt`. Backfills `organizations.members` if missing. Reloads profile. **Does not dismiss** the list.

Errors: not signed in / not found / not a member / trial blocked (*Email info@projectplanner.us to unlock this organisation.* unless a custom message is stored).

## Desktop

Two-column: intro + list card (max width ~720px). Keep web-only “Set up a new organisation” below the iOS list.

Web-only distinguishers (same-name / empty pending orgs from Activate retries): created date, short ID, **Setup incomplete** badge. Incomplete rows are not switchable; they show **Continue setup**, which reopens `/setup` for that pending organisation so payment can finish. Complete orgs sort above incomplete copies. Public `/setup` does not attach a second live organisation to an existing login — sign in, then use this page. Activate reuses a pending org of the same name (or the resume id) and does not switch away from a paid organisation until the new one is activated.


## Test script (Farnie)

1. Open Settings → Personal → Switch organisation; current org shows **Active**.
2. Switch to another membership; Home/projects reload for that org.
3. Locked/trial-blocked rows stay disabled.
4. Create on web, confirm the same list on iPhone.
