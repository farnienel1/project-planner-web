# Deploying rulebook 1.10.0 – 1.12.1

This file supersedes `docs/DEPLOY_1.10.0.md`. It covers 1.10.0, 1.10.1, 1.11.0, 1.12.0 and 1.12.1 together, because none of
their security rules have been deployed yet. **1.12.1 changes the order:** the rules and functions now deploy right
after the 1.12.0 merge, so its security fixes (RULEBOOK changelog 1.12.0: platform owner, invitations, alias ids,
super admin, deactivated people, roster emails, inbox recipients, account confirmations) go live at once. The read
scoping of 1.10.0 / 1.11.0 waits behind a switch in the data, not behind the deploy.

## What changes for whom

- **Reads (RULEBOOK §17).** 1.10.0 limits job and booking reads for managers without a job toggle. 1.11.0 also limits
  booking reads **by job kind**: a manager with only the Projects toggle reads project bookings, and a manager with
  only the Small works toggle reads small works bookings. Each booking says its kind in `jobCollection`.
- **Two switches, flipped together.** The apps plan their queries from `ENFORCED_READS_ACTIVE` in
  `lib/canonical/staffAccess.ts` (false). The security rules apply the read scoping only when
  `platformConfig/app.enforcedReads` is `true` (1.12.1, RULEBOOK §17 / §18; written by the platform owner only). While
  the document or field is missing or false, every member of the organisation reads every job and booking, as before
  1.10.0, and the screens filter with `canSeeJob`. **Apps first, then the document:** the field is set true only
  after a release with `ENFORCED_READS_ACTIVE = true` has reached every user (step 7); setting it back to false is the
  rollback.
- **Writes are not switched.** Job create / edit, booking writes (`canWriteBooking`, `canDeleteBooking`, tombstones,
  `jobCollection` checks), invitations, memberships and every 1.12.0 fix apply from the rules deploy in step 2.

## Order

Do the steps in this order. Do not skip a dry run.

### 1. Merge web 1.12.1

Merge PR #220 (`rulebook-1.12.0-hardening`). Wait for CI (`.github/workflows/rulebook.yml`). Merging deploys nothing in
Firebase. **Before step 2**, open the Firebase Auth console and confirm that `info@projectplanner.us` shows its email
as **verified**: the 1.12.0 rules (`isPlatformOwner`) and the owner API (`requireOwner`) require it. Confirm that
`platformConfig/app` has no `enforcedReads: true` (missing is right).

### 2. Deploy rules, indexes and functions

```sh
firebase deploy --only firestore:rules,firestore:indexes,functions
```

Reads stay as before 1.10.0 because `enforcedReads` is not set, so every app build in use keeps its job and booking
lists. What goes live now:

- the 1.12.0 security fixes (refused: an operative's users `email` change, a manager's admin invitation, a self-added
  `formerUserIds`, a non-Super-Admin `isSuperAdmin` or ownership write, a deactivated person's reads, a manager
  rewriting a managers row email, a notification to a non-member, an `accountConfirmations` list);
- the push function only pushes to active members of the row's organisation;
- the 1.10.0 / 1.11.0 write rules: admins write every booking; managers write bookings on the jobs they manage;
  operatives never write bookings; a manager without the Projects / Small works permission edits a managed job's
  details but not its manager list; `jobCollection` must match the job; accepting an invitation to a second company
  writes exactly the invitation's role and permissions. App builds older than 1.10.0 that let an operative save a
  booking, or a manager book a job they do not manage, get a permission error for that save.

New indexes (1.10.0 and 1.11.0, including `jobCollection` + `date` on `bookings`, `managerSiteBookings` and
`subcontractorBookings`) build in the background; they must show **Enabled** before step 6's queries run.

### 3. Release iOS 1.12.1

iOS 1.12.1 is the build from `docs/ios-handoff/v1.12.1.md`. It keeps `ENFORCED_READS_ACTIVE` false, writes
`jobCollection` on every booking it saves and reads `platformConfig/app` for the forced-update gate
(`appUpdateRequired`, `minimumIosBuild`). Older builds still save bookings without `jobCollection`; step 5 picks
those up and can run again.

### 4. Backfill `managerUserIds` on jobs

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

### 5. Backfill `jobCollection` on bookings

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
- A second dry run must report `0 to update`. Run the script again just before step 7, to catch bookings that older
  app builds saved in the meantime.

### 6. Release both apps with `ENFORCED_READS_ACTIVE = true`

This is a separate, later release, not 1.11.0 or 1.12.x. Change the constant in `lib/canonical/staffAccess.ts`, bump the
rulebook, and ship web and iOS. Do this only after steps 4 and 5 have reported `0 to update`. The new builds query:

- jobs: every job of a kind the viewer has the toggle for, else `managerUserIds array-contains <uid>`;
- bookings: admins every booking; toggle managers `jobCollection == <kind>`; every manager the bookings of their
  managed jobs, one job per query, plus their own bookings.

These queries work with the switch off and on, so this release goes out before step 7.

### 7. Turn on enforced reads

Only after step 6 has reached every user (set `platformConfig/app.minimumIosBuild` to that build to force iOS, and
check the live web build), and steps 4 and 5 report `0 to update`. Signed in as the platform owner, set
`platformConfig/app` `{ enforcedReads: true }` (a partial update; keep `minimumIosBuild`). The rules apply the §17 read
scoping from the next request. To roll back, set it to `false`: reads return to the pre-1.10.0 behaviour at once, with
no deploy.

## After step 2

- Sign in as a manager without toggles. They still see every job and booking (enforced reads are off).
- Sign in as an operative. My Schedule shows their bookings and job names; saving a booking is refused.
- Deactivate a test operative, then sign in as them: the deactivated screen shows and nothing else loads.
- Send a test notification from Settings: it arrives (`push_test` to yourself).

## After step 7

- Sign in as a manager with only the Projects toggle. They see every project, only the small works they manage, every
  project booking and their small works' bookings.
- Sign in as a manager without toggles. They see only the jobs they manage, those jobs' bookings and their own.
- Sign in as an operative. My Schedule shows their bookings and job names.
- Sign in as an admin. Everything shows.
- Add a manager to a job, then remove them. The job appears on their list and then leaves it.

## Any time after step 3

- Sign in as a PAYE operative. There is no My Timesheets.
- Sign in as a PAYE manager who reviews others. User Timesheets is still there.
- Open an admin in Manage Users. Every permission is on and greyed out except Annual Leave Management.
