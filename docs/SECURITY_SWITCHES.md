# Security switches: `enforcedReads` and `privatePay`

Plain-English guide for the owner. Rulebook 1.26.0 (§8, §16, §17, §18). Nothing in this guide happens by itself:
both switches stay **off** until you turn them on, and turning one off again takes effect at once with no deploy.

## What each switch protects

| Switch | Off (today) | On |
|---|---|---|
| `enforcedReads` | Every member of a company can read every job and every booking of that company. The apps only *hide* what a person should not see. | The server only hands out what each person may see. A manager without the Projects / Small works toggle gets only the jobs they manage, those jobs' bookings and their own. An operative gets only their own bookings and the jobs they are booked on (one at a time, never a list). Admins still see everything. |
| `privatePay` | Every member can read everyone's rate history, timesheets and the `operativeProfiles` pay copy, and rates are still stored on the people documents everyone can read. | Rate history, timesheets and the pay copy are read only by the person, their line manager, admins, and a manager with the Operatives toggle (for operatives). New pay is saved only in the private pay profile. After the **strip** (step 8 below) no colleague can read another person's rate anywhere. |

Why it matters: a curious operative with a little technical knowledge could today download every booking and every
rate in the company, even though the app never shows them. The switches close that at the server.

## Where the switches live

One Firestore document: **`platformConfig/app`** (the same one that holds `minimumIosBuild`). Only the platform owner
account (`info@projectplanner.us`, email verified) can change it.

| Field | Type | Meaning |
|---|---|---|
| `enforcedReadsOrganizationIds` | array of strings | Companies with `enforcedReads` on. |
| `privatePayOrganizationIds` | array of strings | Companies with `privatePay` on. |
| `enforcedReads` | boolean | `true` = on for **every** company. |
| `privatePay` | boolean | `true` = on for **every** company. |

A company id must be typed **exactly** as it is stored (same upper / lower case). A wrong id does nothing (safe).

## Before you start: check today's values

1. Open https://console.firebase.google.com → project **project-planner-f986c** → **Firestore Database** → **Data**.
2. Click the `platformConfig` collection → the `app` document.
3. Note what is there. If `enforcedReads` or `privatePay` is already `true`, stop and tell the web agent first
   (this guide assumes both are missing or `false`).
4. Find your own company id: in the same console open `organizations`, find the document whose `name` is your
   company, and copy its **document id** (the long id in the middle column). Keep it in a note.

## The order (do not skip or swap steps)

### 1. Backfills (data first)

Run from a computer with the web repo checked out and Google credentials
(`gcloud auth application-default login` once). Each command is a **dry run** first: it only prints what it would do.

```sh
cd project-planner-web

# For enforcedReads: every job gets its managers' account ids, every booking its job kind.
node scripts/backfill-job-manager-user-ids.mjs   --project project-planner-f986c --all
node scripts/backfill-job-manager-user-ids.mjs   --project project-planner-f986c --all --apply
node scripts/backfill-booking-job-collection.mjs --project project-planner-f986c --all
node scripts/backfill-booking-job-collection.mjs --project project-planner-f986c --all --apply

# For privatePay: copy every rate into the private pay profiles (copies only; removes nothing).
node scripts/backfill-pay-profiles.mjs --project project-planner-f986c --all
node scripts/backfill-pay-profiles.mjs --project project-planner-f986c --all --apply
```

Run each dry run again afterwards: it must say **0 to update** / **0 to copy**. Lines starting with `?` or `!` in the
booking backfill are bookings of deleted jobs or office bookings; they are listed, not changed — send them to the web
agent if there are many.

### 2. Deploy the rules

```sh
firebase deploy --only firestore:rules --project project-planner-f986c
```

Nothing changes for anyone yet: both switches are still off.

### 3. Deploy the web app

The web app (rulebook 1.26.0) reads the switches live and works either way. Check the live site shows version
1.26.0 or later is live (check the web deploy log).

### 4. Ship an iOS build that supports the switches

The iOS agent ships the 1.26.0 hand-off (`docs/ios-handoff/v1.26.0.md`). Wait until it is on the App Store / TestFlight
for your users and note its **build number** (App Store Connect → the app → TestFlight → the build, e.g. `231`).

### 5. Raise `minimumIosBuild`

In the console, `platformConfig/app` → edit the `minimumIosBuild` field → set it to that build number → **Update**.
Older iPhones then show "Update required" instead of breaking when a switch is on.

### 6. Turn the switches on for **your company only**

In the console, `platformConfig/app`:

1. **Add field** → name `enforcedReadsOrganizationIds` → type **array** → add one item, type **string**, value =
   your company id → **Add**.
2. Test (step 7). If all is well:
3. **Add field** → name `privatePayOrganizationIds` → type **array** → one **string** item, your company id → **Add**.
4. Test again (step 7).
5. Only for your company and only after the tests pass, remove old rates from the shared documents:

   ```sh
   node scripts/backfill-pay-profiles.mjs --project project-planner-f986c --org <your company id> --strip           # dry run
   node scripts/backfill-pay-profiles.mjs --project project-planner-f986c --org <your company id> --apply --strip   # do it
   ```

   **Take a backup first** (console → Firestore → **Import/Export** → Export, or
   `gcloud firestore export gs://<a bucket you own>/backup-$(date +%F) --project project-planner-f986c`). The strip
   cannot be undone except by restoring.

### 7. Test with your real accounts

Sign in on the web **and** on an updated iPhone for each:

- [ ] **Admin**: sees every project, small work and booking; Warnings and Daily Overview as before; Manage Users shows
      everyone's rate; Timesheets → User Timesheets lists everyone with figures; Weekly Report has pay.
- [ ] **Manager without the Projects / Small works toggle**: sees only the jobs they manage and those jobs' bookings,
      plus their own; no "Missing or insufficient permissions" or empty screens; Daily Overview lists only their jobs'
      people.
- [ ] **Manager with the Projects toggle only**: every project and its bookings; only the small works they manage.
- [ ] **Operative**: My Schedule shows their bookings and the job names; their own timesheet shows their rate and pay;
      they cannot see anyone else's rate (open a colleague's profile: no rate).
- [ ] **Line manager**: their reports' timesheets show rates and totals; they can sign them.
- [ ] Change an operative's day rate as an admin, then reopen: the new rate shows on web and iPhone, and the timesheet
      uses it from the effective date.
- [ ] Add a new user with a rate (Add User): the save succeeds.
- [ ] Add a manager to a job, then remove them: the job appears and disappears on their list.

### 8. Everyone

When your company has run for a few days without problems, either add the other companies' ids to the lists, or switch
everyone on at once: set `enforcedReads` → `true` (boolean), then later `privatePay` → `true`. Run the strip for
everyone last:

```sh
node scripts/backfill-pay-profiles.mjs --project project-planner-f986c --all --apply --strip
```

## How to turn a switch back off

Console → `platformConfig/app`:

- Your company only: open `enforcedReadsOrganizationIds` (or `privatePayOrganizationIds`) → delete the item (the
  bin icon next to it) → **Update**.
- Everyone: set `enforcedReads` (or `privatePay`) to `false`.

It takes effect on the next read (seconds). The web app re-plans by itself; iPhones re-read the switch when they come
back to the foreground. No deploy. The strip is **not** undone by turning `privatePay` off: rates stay in the pay
profiles, which the updated apps read anyway.

## Known limits (tell the web agent if any matters to you)

- A catalogue operative with no account (an `operatives` row only): with `privatePay` on, only admins see their rate
  history.
- A person invited while `privatePay` is on: their rate is kept on their invite's pay profile. Admins see it; the
  person and their line manager see it once an admin saves their rate again (owner question 2 below).
- Older iPhone builds below `minimumIosBuild` cannot be used while a switch is on — that is why step 5 comes first.

## Questions for the owner

1. Switch order: `enforcedReads` first, then `privatePay` a few days later (recommended), or both together?
2. Invited people under `privatePay`: should accepting an invitation copy the invited rate into the new account's own
   pay profile automatically? That needs a small rules change (the person may create their own pay profile once, with
   exactly the invited values) or a server function. Recommended: the rules change, in the next release.
3. Catalogue operatives (no account): should managers with the Operatives toggle see their rate history while
   `privatePay` is on? Today only admins do.
