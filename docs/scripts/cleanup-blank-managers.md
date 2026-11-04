# Clean up blank "Assigned manager" rows (owner only, one-off)

Older iPhone builds (before iOS #185), when someone edited a project or small works whose manager had not loaded,
saved a stand-in manager called **"Assigned manager" with no email** into `organizations/{orgId}/managers`. Later
edits on other jobs matched that row by its empty email and put it on those jobs in place of their real manager.

`scripts/cleanup-blank-managers.mjs` finds those rows, lists every job that uses one, and — only when you add
`--apply` — takes the junk id off each job and deletes the row. It **only reads unless you add `--apply`.**

What counts as junk (all must be true; anything else with a blank email is printed as `review` and never touched):
blank or missing email, name exactly "Assigned manager", no linked account, nothing else typed in (phone, notes,
department, trade, pay), its id is not a user account of the company, and no manager site booking uses it.

Jobs whose only manager was the junk row are left **without a manager** (they are not deleted). The script lists them
at the end so an admin can assign one in the app.

## Before you start (once)

1. Open **Terminal** (Applications → Utilities → Terminal).
2. Go to the web folder:
   ```bash
   cd ~/Developer/project-planner-web
   git pull
   ```
3. Install the Firebase tools the script uses:
   ```bash
   cd functions && npm ci && cd ..
   ```
4. Sign in to Google with the account that owns the Firebase project (a browser window opens; pick that account):
   ```bash
   gcloud auth application-default login
   ```
   (No `gcloud`? Install the Google Cloud CLI: <https://cloud.google.com/sdk/docs/install>. Or, instead of step 4, point
   the script at a service-account key file: `export GOOGLE_APPLICATION_CREDENTIALS=~/path/to/key.json`. Never commit
   that file.)

The company id (`--org`) is the document id under `organizations` in the Firebase console.

## Step 1 — look (dry run, writes nothing)

One company:

```bash
node scripts/cleanup-blank-managers.mjs --project project-planner-f986c --org YOUR_COMPANY_ID
```

Every company:

```bash
node scripts/cleanup-blank-managers.mjs --project project-planner-f986c --all-orgs
```

For each company it prints every junk row (`would delete managers/…`), a table of the jobs that use it (job number,
site, job id, the other managers), the exact change to each job (`would update …`), `review` rows it will never touch,
and the jobs that would be left with no manager. The last line is a summary and says "Nothing was written".

## Step 2 — fix

Run the same command with `--apply` (start with one company):

```bash
node scripts/cleanup-blank-managers.mjs --project project-planner-f986c --org YOUR_COMPANY_ID --apply
```

Optional: `--actor YOUR_FIREBASE_UID` stamps your user id as `updatedBy` on the jobs (default `cleanup-script`).

What `--apply` does:

- saves a backup of every job and row it changes **first**, in `cleanup-backups/<date-time>/<company>/` (real company
  data: keep it, never share or commit it);
- on each job, removes only the junk id from `managerIds`, `managerUserIds`, `assignedManagerUserIds` and `managerId`
  (`managerId` moves to the next manager, or is removed when none is left; a list left empty is removed), as a
  partial update stamped `updatedBy`, `updatedFrom: web` and the time;
- then deletes the junk manager rows — only if every job update went through;
- refuses a batch (up to 400 writes) if anyone changed one of its documents after the script read it, and says
  "run the script again";
- changes nothing on a second run. Run the dry run again afterwards: it should say "nothing to do".

Then open each job in the "Jobs left with no manager" list in the app and assign a manager.

## Undo

```bash
node scripts/data-cleanup.mjs --project project-planner-f986c --restore cleanup-backups/<date-time>           # look first
node scripts/data-cleanup.mjs --project project-planner-f986c --restore cleanup-backups/<date-time> --apply   # put back
```

This puts each backed-up job and row back exactly as it was (a whole-document write: changes made to those documents
after the clean-up are lost — restore soon).

## Note

The real manager a job had before an older iPhone repointed it to the junk row is not stored anywhere, so the script
cannot put it back; those jobs need a manager assigned by hand.
