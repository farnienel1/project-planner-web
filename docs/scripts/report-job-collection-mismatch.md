# Report: projects and small works stored in the wrong list (owner only, read-only)

**This report only reads. It never changes, adds or deletes anything.** You can run it as often as you like.

## Why we need it

On 10 Nov you saw small works jobs in the **My Projects ⚙** picker, on the website and on the iPhone. Both apps decide
whether a job is a project or a small works job by **which list it is saved in** in the database (`projects` or
`smallWorks`), not by its "job type" text (rulebook §21, `jobKind`). So a small works job that was saved into the
`projects` list shows under Projects on both apps.

This report lists, for each company:

- **(a)** jobs in the `projects` list whose job type says **Small Works** — the likely cause of what you saw;
- **(b)** jobs saved in **both** lists under the same id — they show under Projects and Small works;
- **(c)** how many jobs each list holds;
- **(d)** job numbers used in both lists under different ids (a copy saved with a new id);
- **(info)** small works jobs typed as something else (harmless; shown so we can see which app saved them).

When you send Claude the output, Claude writes a one-off move script for the jobs it finds. That script will come with
its own dry run and backup; this report does nothing to your data.

## Before you start (once)

Each step is one command. Type it (or paste it) into Terminal and press Return. These are the same set-up steps you
used for the 6 Nov backfill scripts, so if you did those on this Mac, steps 4 and 6 are already done — running them
again does no harm.

1. Open **Terminal** (Applications → Utilities → Terminal).

2. Go to the web folder:
   ```bash
   cd ~/Developer/project-planner-web
   ```
   **What it does:** moves Terminal into the website's folder. **You should see** the prompt end in
   `project-planner-web`.

3. Get the latest code (the report arrives when pull request #295 is merged):
   ```bash
   git checkout main && git pull
   ```
   **What it does:** switches to the main version and downloads the latest changes. **You should see**
   `Already on 'main'` or `Switched to branch 'main'`, then `Already up to date.` or a list of changed files.
   If it says your local changes would be overwritten, stop and send the message to Claude.

4. Install the Firebase tools the report uses (takes a minute):
   ```bash
   cd functions && npm ci && cd ..
   ```
   **What it does:** installs the library that lets the report read the database. **You should see** `added …
   packages` near the end, and the prompt ends in `project-planner-web` again.

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
   **What it does:** a browser window opens; pick that account and allow access. This lets the report read the
   database. **You should see** `Credentials saved to file: …` in Terminal. No `gcloud`? Install the Google Cloud CLI
   from <https://cloud.google.com/sdk/docs/install>. Or, instead of this step, point the report at a service-account
   key file: `export GOOGLE_APPLICATION_CREDENTIALS=~/path/to/key.json`. Never commit or share that file.

## Run the report

7. Run it for every company:
   ```bash
   node scripts/report-job-collection-mismatch.mjs --project project-planner-f986c --all-orgs
   ```
   **What it does:** reads the `projects` and `smallWorks` lists of every company and prints what it finds. It takes
   a few seconds per company.

   **What you will see:**

   - the first line: `READ-ONLY report (nothing is written) — project project-planner-f986c, N organisation(s)`;
   - for each company, a block starting `Organisation <company id> (<company name>)`, then:
     - `(c) Documents: projects 12, smallWorks 30` — how many jobs each list holds;
     - `(a) projects documents typed Small Works …: 3`, followed by a small table (collection, id, job number, site
       name, job type, …) or `(none)`;
     - `(b) ids stored in BOTH projects and smallWorks …`, `(d) job numbers in both collections …` and `(info) …`,
       each with a table or `(none)`;
   - a line `Summary: N finding(s) in (a) (b) (d). Nothing was written.`;
   - then a block of comma-separated lines starting `orgId,finding,collection,id,…` — the same findings in a form a
     spreadsheet can open.

   If you see `ERROR`, nothing was changed: copy the whole message. `firebase-admin is not installed` means step 4 was
   missed; `Could not load the default credentials` means step 6 was missed. A line such as `--org needs a value.`
   means part of the command was left out: copy the command in step 7 again exactly.

8. **Send the output to Claude.** Select everything the report printed (from `READ-ONLY report` to the last line),
   copy it, and paste it into the chat. The output holds company ids, job numbers and site names, but no pay or
   contact details.

## Optional

- One company only: replace `--all-orgs` with `--org YOUR_COMPANY_ID` (the company id is the document id under
  **Firestore Database → organizations** in the Firebase console).
- Save the spreadsheet part to a file: add `--csv-only > job-report.csv` to the end of the command in step 7. The file
  is real company data: keep it on your Mac, never commit it.

For developers: the decisions are in `scripts/report-job-collection-mismatch/plan.mjs` (pure, tested by
`node --test scripts/report-job-collection-mismatch/plan.test.mjs`). It reads the packed rulebook only (`jobKind`,
`jobIdsInBothCollections`, `isLegacyPlaceholderDocumentId`, `documentInstantMs`), adds no shared rule, and makes only
collection and document reads — no set, update, delete, batch or transaction.
