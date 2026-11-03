# Deploying rulebook 1.10.0

1.10.0 enforces job and booking **reads** in the Firestore rules (RULEBOOK §17). A manager without the Projects /
Small works toggle can read a job only when its `managerUserIds` holds their account id. Jobs saved before 1.10.0 do
not have that field, so the backfill must run **before** the rules are deployed. If it does not, those managers lose
their jobs.

Do the steps in this order. Do not skip the dry run.

## 1. Merge

Merge the web change (branch `rulebook-1.10.0-hardening`) to `main`. Wait for CI (`.github/workflows/rulebook.yml`) to
pass. Merging deploys nothing in Firebase.

## 2. Backfill dry run

From the web repo, with credentials for the production project:

```sh
cd functions && npm ci && cd ..          # firebase-admin (the script finds it in functions/node_modules)
gcloud auth application-default login     # or GOOGLE_APPLICATION_CREDENTIALS=<service-account.json>
node scripts/backfill-job-manager-user-ids.mjs --project <firebaseProjectId> --all
```

It writes nothing. For each job it would change it prints `would write projects/<id>: +[added] -[removed] → [list]`.
It prints a `?` line for each job whose managers match no active account. Each organisation gets a summary, then a
total.

Check that:

- the jobs you know have managers show those managers' account ids;
- every `?` line is expected (a manager row with no account yet, or an inactive manager). Fix the job or the manager
  row first if not;
- nothing is removed that should stay (`-[...]`).

You can check one organisation alone with `--org <orgId>` instead of `--all`.

## 3. Backfill apply

```sh
node scripts/backfill-job-manager-user-ids.mjs --project <firebaseProjectId> --all --apply
```

It writes only `managerUserIds`, as a partial update, and only where the list changes. It adds no write metadata:
`updatedFrom` accepts only `web` / `ios` / `android`. Run the dry run again afterwards. It must report `0 to update`,
because the script is idempotent.

## 4. Deploy rules, indexes and functions

```sh
firebase deploy --only firestore:rules,firestore:indexes,functions
```

The new composite indexes are `projectId`+`date` and `operativeId`+`date` on `bookings`, `locationId`+`date` and
`userId`+`date` on `managerSiteBookings`, and `projectId`+`date` on `subcontractorBookings`. They must finish building
before the restricted-manager queries work, so watch the Firebase console until they show **Enabled**.

## 5. Release iOS

Release the iOS build that runs `jobQueryPlan` / `bookingQueryPlan` through `CanonicalBusinessEngine` (iOS hand-off
`docs/ios-handoff/v1.10.0.md`).

**Between steps 4 and 5**, iOS builds from before 1.10.0 still query whole job and booking collections. For managers
without a job toggle, and for operatives, the rules refuse those queries, so their job and booking lists are empty
until they update. Admins and managers with a toggle are not affected. To avoid the gap, the owner can release iOS
first: the new iOS queries also work under the old rules. If you do that, run steps 1–3, then 5, then 4.

## After deploying

- Sign in as a manager without the toggle. They see only the jobs they manage, those jobs' bookings and their own.
- Sign in as an operative. My Schedule shows their bookings and job names.
- Sign in as an admin. Everything shows.
- Add a manager to a job, then remove them. The job appears on their list and then leaves it.
