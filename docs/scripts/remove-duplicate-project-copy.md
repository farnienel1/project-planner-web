# Remove the duplicate "project" copy of a small works job (owner only, one-off)

**Without `--apply` this script only reads.** Run the look-only step as often as you like.

## Why we need it

The report from 10 Nov (`scripts/report-job-collection-mismatch.mjs`, see `report-job-collection-mismatch.md`) found
one job saved **twice**, under the same id, in both lists of the database:

| Company | Job | `projects` copy | `smallWorks` copy |
|---|---|---|---|
| Raccord MEP (`2C67391E-D1FE-4F9F-8055-7149ACDE1F96`) | C716 Ludgate Hill (`94472FA5-B93D-4EC5-B60E-F798AD5E490C`) | old: created and last saved 5 May 2026, typed Small Works, saved by an old iPhone build | live: last saved 3 Nov 2026 |

Older iPhone builds did this. Both apps decide whether a job is a project or a small works job by **which list it is
in** (rulebook §17 "Job kind", `jobKind`), so this job shows under Projects **and** under Small works, on the website
and on the iPhone. The script deletes the old `projects` copy and keeps the live `smallWorks` copy.

## What it does — and what it never does

1. It refuses unless the job is really in **both** lists of that company. If only the kept copy is left (for
   example on a second run) it says "Nothing to do" and stops.
2. It prints the **differences between the two copies** (job number, site name, type, live flag, managers,
   hidden operatives, client, address, map pin, dates, who saved it last).
3. It lists everything that still points at the job: labour, manager and subcontractor bookings (with the list name
   each booking carries, `jobCollection`, and older labour bookings that store the job under `projectID`),
   materials, material send records, tasks, site audits, variations, variation trackers, notifications about the
   job, the health & safety and deadline settings for the job (under both spellings of the id), deadline assignments,
   and anyone's My Projects / My Small works picks.
4. It lists every document **stored under** the copy it would remove (for example `…/projects/{id}/healthSafety/data`),
   with its field names and how many rows each list holds.
5. It **refuses to delete** while any of these is true:
   - a booking says `jobCollection: projects` for this job;
   - a `settings/healthSafety_projects_…` / `settings/deadlines_projects_…` document for it holds data;
   - a document stored under the `projects` copy holds data (it would be deleted with the copy);
   - the `projects` copy lists a manager the `smallWorks` copy does not (the security rules accept a manager listed on
     either copy, so that person could lose access to the job's bookings).
   Nothing is changed by this script except the delete: send the output to Claude and decide together.
   (Claude may give you a command ending `--force-refs=N` to delete anyway, still without changing any other record.
   N is the number of blockers your dry run showed; if anything changed since, the script refuses. Never type
   `--force-refs` on your own: on its own it is always refused.)
6. With `--apply` it first saves a **backup** of the copy it removes (and everything stored under it) to a file on
   your Mac and prints where, then deletes that copy and everything under it, in one go. If someone changed that copy
   in the meantime, the delete is refused and nothing is deleted.
7. It **never touches the kept `smallWorks` copy**, and it writes nothing else.
8. It does **not** remove files in Storage: uploads under `organizations/{company}/healthSafety/{job id}/` are shared
   by both copies and stay.

**What you can see before deleting** (platform guardrail 3): the bookings, tasks, materials and other records listed
in the dry run are linked to the job by its id, which the `smallWorks` copy keeps, so they stay with the job under
Small works. The dry run shows anything that is only on the `projects` copy — differing fields, documents stored
under it, managers only it lists — and the script refuses to delete while any of those exist. What changes when it
is deleted: the job no longer shows under Projects, and anyone who had ticked it in **My Projects** stops seeing it
there (it still shows under Small works; they can tick it in **My Small works**). The dry run lists those people under
`worksListPicks`.

## Before you start (once)

Each step is one command. Type it (or paste it) into Terminal and press Return. If you ran the report on this Mac,
steps 4 and 6 are already done — running them again does no harm.

1. Open **Terminal** (Applications → Utilities → Terminal).

2. Go to the web folder:
   ```bash
   cd ~/Developer/project-planner-web
   ```
   **You should see** the prompt end in `project-planner-web`.

3. Get the latest code (the script arrives when its pull request is merged):
   ```bash
   git checkout main && git pull
   ```
   **You should see** `Already on 'main'` or `Switched to branch 'main'`, then `Already up to date.` or a list of
   changed files. If it says your local changes would be overwritten, stop and send the message to Claude.

4. Install the Firebase tools the script uses (takes a minute):
   ```bash
   cd functions && npm ci && cd ..
   ```
   **You should see** `added … packages`, and the prompt ends in `project-planner-web` again.

5. Check Node is installed:
   ```bash
   node -v
   ```
   **You should see** a version such as `v20.x` or `v22.x`. If you see "command not found", install Node from
   <https://nodejs.org> (the LTS button) and start again at step 1.

6. Sign in to Google with the account that owns the Firebase project:
   ```bash
   gcloud auth application-default login
   ```
   A browser window opens; pick that account and allow access. **You should see** `Credentials saved to file: …`.

## Step 1 — look (dry run, writes nothing)

7. Run:
   ```bash
   node scripts/remove-duplicate-project-copy.mjs --project project-planner-f986c --org 2C67391E-D1FE-4F9F-8055-7149ACDE1F96 --job 94472FA5-B93D-4EC5-B60E-F798AD5E490C
   ```
   **What you will see:**
   - `DRY RUN (nothing is written) — project project-planner-f986c`;
   - `Keep:   smallWorks/94472FA5-…` and `Remove: projects/94472FA5-…`, each with its job number, site name and dates;
   - `Field differences between the copies (N of 27 compared):` and, for each field that differs, the `keep` and
     `remove` values;
   - a list of references with a count each, for example `bookings   12   (jobCollection=smallWorks: 12)`;
   - `Stored under the projects copy (subcollection documents): N` and each one with its fields;
   - `Will delete N document(s)` and the paths it would delete (all under `…/projects/94472FA5-…`);
   - `Blocking --apply:` followed by `none — …` or a list of what blocks it;
   - the last line: `Dry run: nothing was written. Re-run with --apply to delete.` or, when blocked,
     `… --apply is refused; the owner decides …`.

8. **Send the whole output to Claude** and wait for the go-ahead. Claude checks that nothing still points at the
   `projects` copy before you delete it.

## Step 2 — delete the old copy (only after Claude says go)

9. Run the same command with `--apply` at the end:
   ```bash
   node scripts/remove-duplicate-project-copy.mjs --project project-planner-f986c --org 2C67391E-D1FE-4F9F-8055-7149ACDE1F96 --job 94472FA5-B93D-4EC5-B60E-F798AD5E490C --apply
   ```
   **You should see** the same list, then `Backup written: …/cleanup-backups/<date-time>/…/001-duplicate-job-copy.json`,
   then `Deleted N document(s). The smallWorks copy … was not touched.` then `Undo: copy the whole next line. …` and,
   under it, a line starting `node scripts/data-cleanup.mjs --project project-planner-f986c --restore "/…"`. **Copy that
   whole `node …` line into a note** (it holds the exact backup folder on your Mac). Keep the backup file on your Mac (it is company data:
   never commit or share it).

   If you see `REFUSED: …` nothing was deleted: send the message to Claude.

10. Check: run the step 7 command again. **You should see** `The job is only in smallWorks (…). Nothing to do.` Then
    open Small works in the app: C716 Ludgate Hill is there; it is no longer under Projects.

11. If the job ever shows under Projects again later (an old iPhone build could save the `projects` copy back), do
    not run the script again on your own: tell Claude.

## Undo (only if Claude asks)

1. Paste the whole `node scripts/data-cleanup.mjs … --restore "/…"` line you saved in step 9, exactly as printed,
   and press Return. **You should see**
   `Restore — DRY RUN (nothing is written): N document(s) …` and the paths it would put back. Nothing is written yet.
2. Paste the same line again, add ` --apply` at the end, and press Return. **You should see** `Restored N
   document(s).` The `projects` copy is back exactly as it was.

## Options

- `--keep projects` keeps the `projects` copy and removes the `smallWorks` one instead (not needed for C716).
- `--backup-dir <folder>` puts the backup somewhere else (default `cleanup-backups`, which git ignores).

For developers: `--force-refs=N` overrides every blocker of one run together — references naming the removed
collection (a booking's `jobCollection`, a `settings/{healthSafety|deadlines}_{removed}_{KEY}` document with data),
documents with fields stored under the removed copy (they are backed up and deleted with it), and manager ids only the
removed copy lists — and only when N equals the number of blockers found in that run (`parseForceRefs`,
`planRemoval`). It never rewrites the blocking records. A bare `--force-refs`, a mismatched N or a malformed value is
refused. The decisions are in `scripts/remove-duplicate-project-copy/plan.mjs` (pure, tested by
`node --test scripts/remove-duplicate-project-copy/plan.test.mjs`). It reads the packed rulebook only
(`jobIdsInBothCollections`, `normalizeDocumentId`, `bookingJobId`, `deadlineProjectKey`, `deadlinesDocumentId`,
`healthSafetyDocumentIds`, `isLegacyPlaceholderDocumentId`, `documentInstantMs`, `jobManagerIds`) and adds no shared rule. The only
write is one batch of deletes (subcollection documents first, the copy last, with its read `updateTime` as a
precondition). The backup uses the `scripts/data-cleanup.mjs` format, so `--restore` reads it.
