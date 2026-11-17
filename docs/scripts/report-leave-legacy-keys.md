# Report: annual leave an operative would no longer see (1.56.0)

Read only. From rulebook 1.56.0 an operative's app loads only their own annual leave: the records whose stored `userId`
or `operativeId` is exactly one of their ids (their users id, a former invite id, an `operatives` row on their email, or
their email). Before the security rules are narrowed (Phase B, switch `operativeOwnLeave`), this report lists every
leave record that belongs to an operative but is stored in a way that query does not match, so it can be fixed first
(owner answer 17 Nov, Q4: "fix the data"). Nothing is written to Firestore.

1. `cd ~/Developer/project-planner-web`
   Opens the web project folder.
2. `git pull`
   Gets the latest `main` (the report needs the 1.56.0 rulebook).
3. `gcloud auth application-default login`
   Once only: signs the script in with your admin Google account. A browser window opens; pick your account.
4. `node scripts/report-leave-legacy-keys.mjs --project project-planner-f986c --all --csv leave-legacy-keys.csv`
   Reads every company's leave, people and `operatives` rows and prints the records operatives would miss. You
   should see either `0 leave record(s) listed.` or one block per company, then a CSV file `leave-legacy-keys.csv`.

What each reason means and how to fix it:

| Reason | What it means | Fix |
|---|---|---|
| `letterCase` | the stored id is the person's id in another letter case or with spaces | set `userId` to the id in the `fix` column |
| `sameEmailAccount` | filed under a second users document on the person's email | set `userId` to the person's main users id (the `fix` column) |
| `legacyKey` | the person's id is only under an older key (`user_id`, `uid`, `user.id`, …) | add `userId` = the id in the `fix` column; leave the old key |

Fix each listed record in the Firebase console (Firestore → `organizations/<company>/holidayBookings/<leaveId>` → add or
edit the `userId` field), or send the CSV to Claude to prepare a reviewed fix. Run the report again until it lists 0,
then the Phase B rules can be published. Ghost operatives (no login), managers and admins are not listed: they never run
an own-leave query. A record with no readable start date is not listed (no app shows it today either).
