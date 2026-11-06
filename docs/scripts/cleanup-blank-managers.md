# Clean up blank "Assigned manager" rows (owner only, one-off)

Launch checklist row 1.27. Owner decision (4 Nov): the blank rows are removed with an owner-run script, dry run first.

## What this fixes

Older iPhone builds (before iOS #185), when someone edited a project or small works whose manager had not loaded,
saved a stand-in manager called **"Assigned manager" with no email** into `organizations/{orgId}/managers`. Later
edits on other jobs matched that row by its empty email and put it on those jobs in place of their real manager.

`scripts/cleanup-blank-managers.mjs` finds those rows, lists every job that uses one, and — only when you add
`--apply` — takes the junk id off each job and then deletes the row. **Without `--apply` it only reads.**

## Which rows it removes

A row is removed only when **all** of these are true:

1. the email is blank or missing;
2. the name is exactly "Assigned manager";
3. it is not linked to a user account, and nothing else was typed in (phone, notes, department, trade, pay);
4. its id is not a user account of the company;
5. **no booking points at it** — labour bookings, manager site bookings (office / working from home / site survey),
   subcontractor bookings, holiday bookings and accepted clashes are all read, and any mention of the row's id in any
   field keeps the row;
6. **no job would still point at it** after the clean-up: the script takes the id out of the job's manager fields; if
   the id is anywhere else on the job (for example a hidden-managers list), the row is kept.

Any other row with a blank email is printed as **`review (never changed)`**, with the reason and the jobs that use it.
Neither the row nor those jobs are touched. Check them in the app by hand.

Jobs whose only manager was a removed row are left **without a manager** (the job itself is never deleted). The
script lists them at the end so an admin can assign one in the app.

## Before you start (once)

Each step is one command. Type it (or paste it) into Terminal and press Return.

1. Open **Terminal** (Applications → Utilities → Terminal).
2. Go to the web folder:
   ```bash
   cd ~/Developer/project-planner-web
   ```
   You should see the prompt end in `project-planner-web`.
3. Get the latest code:
   ```bash
   git pull
   ```
   You should see `Already up to date.` or a list of changed files.
4. Check Node is installed:
   ```bash
   node -v
   ```
   You should see a version such as `v20.x` or `v22.x`. If you see "command not found", install Node from
   <https://nodejs.org> (the LTS button) and start again at step 1.
5. Install the Firebase tools the script uses (takes a minute):
   ```bash
   cd functions && npm ci && cd ..
   ```
   You should see `added … packages` and be back in `project-planner-web`.
6. Sign in to Google with the account that owns the Firebase project (a browser window opens; pick that account and
   allow access):
   ```bash
   gcloud auth application-default login
   ```
   You should see `Credentials saved to file: …`. No `gcloud`? Install the Google Cloud CLI from
   <https://cloud.google.com/sdk/docs/install>. Or, instead of this step, point the script at a service-account key
   file: `export GOOGLE_APPLICATION_CREDENTIALS=~/path/to/key.json`. Never commit or share that file.
7. Find your company id: in the Firebase console, open **Firestore Database → organizations**. The company id is the
   document id on the left (a long string of letters and numbers).

## Step 1 — look (dry run, writes nothing)

One company (replace `YOUR_COMPANY_ID`):

```bash
node scripts/cleanup-blank-managers.mjs --project project-planner-f986c --org YOUR_COMPANY_ID
```

Or every company:

```bash
node scripts/cleanup-blank-managers.mjs --project project-planner-f986c --all-orgs
```

What you should see:

- the first line starts with `DRY RUN (nothing is written)`;
- for each company, `would delete managers/…` for each row it would remove, with a table of the jobs that use it (job
  number, site, job id, the other managers on that job);
- `would update projects/…` or `smallWorks/…` with the exact change to each job;
- `review (never changed) managers/…` for rows it will not touch, with the reason and the jobs that use them;
- `Jobs left with no manager` (if any);
- a last line starting `Summary:` that ends with `Nothing was written`.

If a company says `nothing to do`, there is nothing to clean there. If you see `ERROR`, nothing was changed for that
company: copy the message to Claude.

Read the list. If anything looks wrong (for example a real manager under `would delete`), **stop** and send the output
to Claude before going on.

## Step 2 — fix (writes)

Run the same command with `--apply`. Start with one company:

```bash
node scripts/cleanup-blank-managers.mjs --project project-planner-f986c --org YOUR_COMPANY_ID --apply
```

Optional: add `--actor YOUR_FIREBASE_UID` to stamp your user id as `updatedBy` on the jobs (default `cleanup-script`).

What you should see:

- `Backup: cleanup-backups/<date-time>/<company>/001-blank-managers.json` first;
- the same list as the dry run, with `delete` / `update` instead of `would …`;
- a line `Applied: N write(s)…` and an `Undo:` command. **Copy the Undo command somewhere safe.**

What `--apply` does, in order:

1. saves a backup of every job and row it will change, **before** writing anything, in
   `cleanup-backups/<date-time>/<company>/` (real company data: keep it, never share or commit it);
2. on each job, removes only the junk id from `managerIds`, `managerUserIds`, `assignedManagerUserIds` and
   `managerId` (`managerId` moves to the next manager, or is removed when none is left; a list left empty is removed),
   as a partial update stamped `updatedBy`, `updatedFrom: web` and the time;
3. then deletes the junk manager rows — only if every job update went through, so a job is never left pointing at a
   deleted row;
4. refuses a batch (up to 400 writes) if anyone changed one of its documents after the script read it, and says
   "run the script again".

## Step 3 — check

1. Run the Step 1 dry run again. It should say `nothing to do` for that company (review rows, if any, are still
   listed — they are never changed).
2. In the app, open each job from the `Jobs left with no manager` list (Projects / Small works → the job → Edit) and
   assign a manager.
3. When one company looks right, repeat Step 2 for the others (or use `--all-orgs --apply`).

## Undo

Use the `Undo:` command the script printed, first without and then with `--apply`:

```bash
node scripts/data-cleanup.mjs --project project-planner-f986c --restore cleanup-backups/<date-time>
node scripts/data-cleanup.mjs --project project-planner-f986c --restore cleanup-backups/<date-time> --apply
```

The first only shows what would be put back. The second puts each backed-up job and row back exactly as it was (a
whole-document write: changes made to those documents after the clean-up are lost — restore soon).

## Note

The real manager a job had before an older iPhone repointed it to the junk row is not stored anywhere, so the script
cannot put it back; those jobs need a manager assigned by hand.

For developers: the decisions are in `scripts/cleanup-blank-managers/plan.mjs` (pure, tested by
`node --test scripts/cleanup-blank-managers/plan.test.mjs`); it reads the packed rulebook only
(`jobManagerIds`, `jobManagerRemovalWrites`, `stableManagerId`, `parseManagerDocument`, `parseJobDocument`,
`writeMetadataFields`, `rulebookStamp`) and adds no shared rule.
