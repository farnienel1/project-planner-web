# Report: signed price work / expenses that differ from their decisions (read only)

Rulebook 1.76.0 (owner answer 23 Nov, b): a line manager can now change or remove signed price work and expenses with **Make changes**. A signed, unexported timesheet whose signed copy's price work or expense figures differ from what those entries pay now is read as changed — it moves to **Awaiting sign-off** (export and invoice blocked) until the line manager signs it off again. Before 1.76.0 every reviewer save updated those figures, so this should find **0** sheets. Run it before deploying 1.76.0 to be sure.

It **only reads**. It never writes, deletes or changes anything.

## Steps

1. Open Terminal and go to the web folder:
   `cd ~/Developer/project-planner-web`
   (nothing visible happens)
2. Make sure you are on the branch with rulebook 1.76.0 and the packed rulebook is built:
   `npm run build:canonical`
   You should see `canonical bundle …`.
3. Sign in for Google Cloud reads (once per machine):
   `gcloud auth application-default login`
   A browser opens; sign in with the owner account.
4. Run the report for every organisation:
   `node scripts/report-signed-money-mismatch.mjs --project project-planner-f986c --all-orgs`
   (or `--org <organisationId>` for one)

## What you see

- `READ-ONLY dry run (nothing is written)` first.
- One line per organisation: sheets checked, signed-off unexported sheets, and how many would wait for the line manager.
- `TOTAL …` and, if any, the timesheet documents that would wait.
- `Nothing was written.` last.

If the total is **0**, nothing changes for anyone on deploy. If it is above 0, send Claude the list before deploying: each listed sheet would need its line manager to sign it off again.
