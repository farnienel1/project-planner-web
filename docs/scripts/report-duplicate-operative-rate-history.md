# Report: duplicate operatives rows with newer rate history (1.36.0)

Read only. Lists the people whose pay rate changes because web 1.36.0 reads rate history under **every** `operatives`
row on their email (rulebook §8, `payRateOnDay` "every id"): people with two or more rows on one email where a row that is
not their linked row has a history row newer than the one web read before. Nothing is written.

1. `cd ~/Developer/project-planner-web`
2. `gcloud auth application-default login` (once; admin credentials for the script).
3. `node scripts/report-duplicate-operative-rate-history.mjs --project project-planner-f986c --all`

Each person shows their rows, which row is linked, and the rate before and from 1.36.0. "0 person(s) listed" means
nobody's rate changes. The owner decision is in `docs/OWNER_DECISIONS.md` (7 Nov).
