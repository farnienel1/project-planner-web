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
2. It lists everything that still points at the job: labour, manager and subcontractor bookings (with the list name
   each booking carries, `jobCollection`), materials, material send records, tasks, site audits, variations, variation
   trackers, the health & safety and deadline settings for the job, deadline assignments, and anyone's My Projects / My
   Small works picks.
3. It **refuses to delete** while any booking says `jobCollection: projects` for this job, or a
   `settings/healthSafety_projects_…` / `settings/deadlines_projects_…` document for it holds data. Those records
   are never changed by this script: send the output to Claude and decide together. (`--force-refs` deletes anyway,
   still without changing those records — only use it if Claude tells you to.)
4. With `--apply` it first saves a **backup** of the copy it removes (and everything stored under it) to a file on
   your Mac and prints where, then deletes that copy and everything under it, in one go. If someone changed that copy
   in the meantime, the delete is refused and nothing is deleted.
5. It **never touches the kept `smallWorks` copy**, and it writes nothing else.

**No live data is hidden** (platform guardrail 3): the job, its bookings, tasks, materials and everything else stay
under Small works, because they are linked by the job id, which is the same for both copies. What changes: the job
no longer shows under Projects, and if someone had ticked it in their **My Projects** list it stops showing there (it
still shows under Small works; they can tick it in **My Small works**). The script prints those people under
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
   - a list of references with a count each, for example `bookings   12   (jobCollection=smallWorks: 12)`;
   - `Will delete N document(s)` and the paths it would delete (all under `…/projects/94472FA5-…`);
   - if anything blocks it, a `Blocking --apply:` list;
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
   then `Deleted N document(s). The smallWorks copy … was not touched.` and an `Undo:` command. Keep the backup file on
   your Mac (it is company data: never commit or share it).

   If you see `REFUSED: …` nothing was deleted: send the message to Claude.

10. Check: run the step 7 command again. **You should see** `The job is only in smallWorks (…). Nothing to do.` Then
    open Small works in the app: C716 Ludgate Hill is there; it is no longer under Projects.

## Undo (only if Claude asks)

The `Undo:` line printed in step 9 puts the deleted copy back exactly as it was. Run it first without `--apply` (it
only lists what it would restore), then with `--apply`:

```bash
node scripts/data-cleanup.mjs --project project-planner-f986c --restore cleanup-backups/<the folder printed in step 9>
```

## Options

- `--keep projects` keeps the `projects` copy and removes the `smallWorks` one instead (not needed for C716).
- `--backup-dir <folder>` puts the backup somewhere else (default `cleanup-backups`, which git ignores).

For developers: the decisions are in `scripts/remove-duplicate-project-copy/plan.mjs` (pure, tested by
`node --test scripts/remove-duplicate-project-copy/plan.test.mjs`). It reads the packed rulebook only
(`jobIdsInBothCollections`, `normalizeDocumentId`, `bookingJobId`, `deadlineProjectKey`, `deadlinesDocumentId`,
`healthSafetyDocumentIds`, `isLegacyPlaceholderDocumentId`, `documentInstantMs`) and adds no shared rule. The only
write is one batch of deletes (subcollection documents first, the copy last, with its read `updateTime` as a
precondition). The backup uses the `scripts/data-cleanup.mjs` format, so `--restore` reads it.
