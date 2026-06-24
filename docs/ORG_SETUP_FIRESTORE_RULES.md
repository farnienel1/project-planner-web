# Firestore rules — org setup & super admin

These notes describe the access model the web app expects. **Deploy the rules** from `firestore.rules` in this repo — see `DEPLOY_FIRESTORE_RULES.md`.

## Super admin (org creator)

The user who completes `/setup` is written as:

- `users/{authUid}` with `isSuperAdmin: true`, `role: 'admin'`, and **all permission toggles on**
- `organizations/{orgId}.members[authUid] = 'admin'`
- `users/{authUid}/orgMemberships/{orgId}` with `status: 'active'`

They can edit anything in the web or mobile app for their organisation.

Profile fields pulled from setup:

| Field | Source |
|-------|--------|
| firstName, surname, email | Account step |
| mobileNumber | Account step (optional) |
| annual leave policy | Organisation Features step |
| My Schedule options | Organisation Features step |
| payroll, warnings, invoicing | Organisation Features step |

Items **not** collected during setup (add in-app later): skills, qualifications, day rate, VAT, UTR on user profiles.

## Guided setup persistence

After activation, `persistGuidedSetup` writes:

- First **project** (required)
- **Client(s)** — one from the project, or two if the client step name differs
- **Skill**, **qualification**, **job type** (deduplicated in `settings/jobTypes`)
- **Wholesaler** and **subcontractor** (same shape as in-app stores)
- `teamOnboarding.status = 'pending_add_users'` — prompts admin to open Manage Users

Managers and operatives are **not** created during setup; add them via **Settings → Manage Users**.

## Same-email rules

| Scenario | Behaviour |
|----------|-----------|
| Same email, same org | Error — blocked in `inviteUserCore` |
| Same email, new org, existing account | Membership added as `pending`; org-addition email sent; accept via **Change organisation** |
| Same email, new user | Standard invite + password setup email |

## Multi-org

- One Firebase Auth account per email (one password)
- `users/{uid}/orgMemberships/{orgId}` tracks each org (`pending` → `active`)
- `users/{uid}.organizationId` is the **active** org
- Switching org reloads the dashboard with a clear loading state (no data overlap)
