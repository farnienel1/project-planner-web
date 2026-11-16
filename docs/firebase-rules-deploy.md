# Firebase rules deploy button

Owner decision 16 Nov (`docs/OWNER_DECISIONS.md`, standing rules): Claude may publish the Firestore rules, the Storage rules and the Firestore indexes through a GitHub Actions workflow, after the full rules bar passes. Cloud Functions stay owner-deployed by hand for now.

Workflow: `.github/workflows/firebase-rules-deploy.yml` ("Firebase rules deploy"). Helper: `scripts/firebase-rules-deploy.mjs` (tests: `scripts/firebase-rules-deploy.test.mjs`).

## What it does

1. Refuses to run unless it was started on `main` and the confirm box says `publish`.
2. Maps the chosen target to `firebase deploy --only …` — the only targets it knows:

   | Target | `--only` |
   |---|---|
   | `firestore-rules` | `firestore:rules` |
   | `storage-rules` | `storage` (the default bucket's rules, `project-planner-f986c.firebasestorage.app`) |
   | `indexes` | `firestore:indexes` |
   | `firestore-rules+storage-rules` | `firestore:rules,storage` |
   | `all-rules` | `firestore:rules,firestore:indexes,storage` |

3. Runs the same rules guards CI runs: the size and compile-cost budget (`npm run check:rules-budget`) and the emulator type check (`scripts/check-rules-typecheck.mjs`).
4. Writes the `FIREBASE_DEPLOY_SA_KEY` secret to a private temporary file, deploys with `firebase-tools@15.34.2 --non-interactive` to `project-planner-f986c`, and deletes the key file at the end whatever happened.
5. **Checks what is really live** (the method in `docs/firestore-rules-notes.md` "After publishing"): reads `releases/cloud.firestore` (and `releases/firebase.storage/<bucket>` when Storage rules were deployed), then the ruleset each points at, and compares its source with the file on `main` by sha256. The job fails if they differ. The release name, live ruleset id, its `updateTime` and the hash go in the run's summary.

Indexes: `--non-interactive` without `--force` never deletes an index that is live but missing from `firestore.indexes.json` (firebase-tools only warns). Indexes are not compared after the deploy; the deploy log says what was created.

## How to run it

1. GitHub → the `project-planner-web` repo → **Actions** → **Firebase rules deploy** → **Run workflow**.
2. Leave the branch as **main**.
3. Choose the target, type `publish` in the confirm box, press **Run workflow**.
4. Open the run. Green means the deploy finished and the live rules match `main`; the summary shows the live ruleset and time.

The full rules bar (`docs/agent-rules/owner-working-style.md`: compile cost below live, emulator type check 0 errors, rules suites on port 8080, `RULES_STRICT_BUDGET=1` with no new refusals) is checked before a rules change is merged; the workflow re-runs the budget and the type check only.

## Rolling back

- Revert the rules change on `main` (a pull request that restores the previous `firestore.rules` / `storage.rules`), then run the workflow again with the same target. It publishes the previous file and checks it is live.
- Or publish the previous file by hand in the Firebase console (Firestore → Rules / Storage → Rules → paste → Publish), as before.
- Or point the release back at the previous ruleset (`docs/firestore-rules-notes.md` "After publishing", step 3). Note the live ruleset id from the run summary before every publish.

## What it never does

Cloud Functions, hosting, Realtime Database, data, users, billing, `platformConfig` switches. It cannot run on another branch or from a pull request, and it never runs by itself (manual trigger only, one run at a time).

## The secret and the service account

- Secret: `FIREBASE_DEPLOY_SA_KEY` (repository secret, the service account's JSON key). Service account: `github-rules-deployer@project-planner-f986c.iam.gserviceaccount.com`.
- Roles: `roles/firebaserules.admin` (create, test and release rulesets; read releases and rulesets for the check), `roles/datastore.indexAdmin` (indexes and the Firestore database lookup), `roles/serviceusage.serviceUsageConsumer` (firebase-tools checks the APIs are enabled), `roles/firebase.viewer` (the project and the default Storage bucket lookup).
- To revoke: delete the key in Google Cloud → IAM → Service accounts → the account → Keys, and delete the GitHub secret.
