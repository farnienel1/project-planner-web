# Deploying rulebook 1.11.0

This file supersedes `docs/DEPLOY_1.10.0.md`. It covers 1.10.0, 1.10.1 and 1.11.0 together, because none of their
security rules have been deployed yet.

## What changes for whom

- **Reads (RULEBOOK §17).** 1.10.0 limits job and booking reads for managers without a job toggle. 1.11.0 also limits
  booking reads **by job kind**: a manager with only the Projects toggle reads project bookings, and a manager with
  only the Small works toggle reads small works bookings. Each booking says its kind in `jobCollection`.
- **The switch.** Both apps plan their queries from `ENFORCED_READS_ACTIVE` in `lib/canonical/staffAccess.ts`. It is
  **false** in 1.11.0. While it is false, every admin and manager reads whole job and booking collections, as before
  1.10.0, and the screens filter with `canSeeJob`. The flag only becomes true in a later release, after **both**
  backfills below have run.
- **Rules last.** The 1.11.0 rules refuse a manager's whole-collection booking query, so they must not be deployed
  while any app build still reads whole collections. That is every build with the flag false, which includes this one.

## Order

Do the steps in this order. Do not skip a dry run.

### 1. Merge web 1.11.0

Merge the branch `rulebook-1.11.0-levels` after `rulebook-1.10.1-reads-off` (PR #217). Wait for CI
(`.github/workflows/rulebook.yml`). Merging deploys nothing in Firebase. Web keeps reading whole collections because
the flag is false.

> **Check now.** A web build from 1.10.0 (merged before 1.10.1) queried a restricted manager's jobs with
> `managerUserIds array-contains <uid>`. Jobs saved before 1.10.0 have no `managerUserIds`, so **production web
> showed those managers no jobs** until 1.10.1 shipped. 1.10.1 and 1.11.0 fix this on web. Confirm that the live web
> deploy runs 1.10.1 or later.

### 2. Backfill `managerUserIds` on jobs

```sh
cd functions && npm ci && cd ..          # firebase-admin (the scripts find it in functions/node_modules)
gcloud auth application-default login     # or GOOGLE_APPLICATION_CREDENTIALS=<service-account.json>
node scripts/backfill-job-manager-user-ids.mjs --project <firebaseProjectId> --all            # dry run
node scripts/backfill-job-manager-user-ids.mjs --project <firebaseProjectId> --all --apply    # write
```

The checks are as in 1.10.0. Every `?` line must be expected, nothing must be removed that should stay, and a second
dry run must report `0 to update`.

**This must run before any app build that queries jobs by `managerUserIds` reaches restricted managers, even under the
old rules.** The rules have nothing to do with it: that query only finds jobs that already have the field. With the flag
false, iOS 1.11.0 does not run that query. But an iOS build made from the 1.10.0 hand-off (before 1.10.1) does. If such
a build was released, or is about to be, run this step first.

### 3. Release iOS 1.11.0

iOS 1.11.0 is the build from `docs/ios-handoff/v1.11.0.md`. It keeps the flag false and writes `jobCollection` on every
booking it creates or edits. It also has the permission levels, the PAYE timesheet rule, invites and line-manager
pickers. Older builds still save bookings without `jobCollection`. Step 4 picks those up, and you can run it again.

### 4. Backfill `jobCollection` on bookings

```sh
node scripts/backfill-booking-job-collection.mjs --project <firebaseProjectId> --all            # dry run
node scripts/backfill-booking-job-collection.mjs --project <firebaseProjectId> --all --apply    # write
```

- The script reads every `bookings`, `subcontractorBookings` and job-linked `managerSiteBookings` document. It looks up
  the job among `projects` and `smallWorks` without regard to letter case, using the rulebook's `bookingJobId`,
  `jobCollectionForJobId` and `bookingJobCollectionFields` from the packed script. It writes only `jobCollection`, as a
  partial update, and only where the field is missing or wrong. It adds no write metadata and skips tombstoned
  bookings.
- `?` lines are bookings whose job is in neither collection, such as history from a deleted job. They are also bookings
  on an id that exists in **both** collections (older iOS builds created such pairs; `jobIdsInBothCollections`). These
  are left alone. Only admins, the job's managers and the people they book can read them. Review the pairs with the
  owner.
- `!` lines are manager site bookings with no job that carry a `jobCollection`. They are left alone.
- A second dry run must report `0 to update`. Run the script again just before step 6, to catch bookings that older
  app builds saved in the meantime.

### 5. Release both apps with `ENFORCED_READS_ACTIVE = true`

This is a separate, later release. It is not 1.11.0. Change the constant in `lib/canonical/staffAccess.ts`, bump the
rulebook, and ship web and iOS. Do this only after steps 2 and 4 have reported `0 to update`. The new builds query:

- jobs: every job of a kind the viewer has the toggle for, else `managerUserIds array-contains <uid>`;
- bookings: admins every booking; toggle managers `jobCollection == <kind>`; every manager the bookings of their
  managed jobs, one job per query, plus their own bookings.

These queries also work under the old rules, so this release can go out before step 6.

### 6. Deploy rules, indexes and functions

```sh
firebase deploy --only firestore:rules,firestore:indexes,functions
```

New indexes in 1.11.0: `jobCollection` + `date` on `bookings`, `managerSiteBookings` and `subcontractorBookings`. The
1.10.0 indexes are still listed in `DEPLOY_1.10.0.md`. Indexes cannot refuse anything, so you can deploy them earlier
with `--only firestore:indexes`. They must show **Enabled** before step 5's queries run.

The 1.11.0 rules also change things that do not depend on the flag. These are safe in any order after step 1:

- Accepting an invitation to a second company writes the membership and `members.{uid}` with exactly the invitation's
  role and permissions. Before this deploy, that write is refused and the person is asked for a new invitation.
- Admins have no operative mode in the rules. An admin with a stray `operativeMode` flag decides leave and reads like
  an admin.
- Booking writes check `jobCollection` against the job's collection.

**Between steps 1 and 6**, builds from before 1.11.0 keep working, and the old rules still apply.

## After deploying

- Sign in as a manager with only the Projects toggle. They see every project, only the small works they manage, every
  project booking and their small works' bookings.
- Sign in as a manager without toggles. They see only the jobs they manage, those jobs' bookings and their own.
- Sign in as an operative. My Schedule shows their bookings and job names.
- Sign in as an admin. Everything shows.
- Add a manager to a job, then remove them. The job appears on their list and then leaves it.
- Sign in as a PAYE operative. There is no My Timesheets.
- Sign in as a PAYE manager who reviews others. User Timesheets is still there.
- Open an admin in Manage Users. Every permission is on and greyed out except Annual Leave Management.
