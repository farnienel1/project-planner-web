# Firebase rules deploy button

Owner decision 16 Nov (`docs/OWNER_DECISIONS.md`, standing rules): Claude may publish the Firestore rules, the Storage rules and the Firestore indexes through a GitHub Actions workflow, after the full rules bar passes. Cloud Functions stay owner-deployed by hand for now.

Workflow: `.github/workflows/firebase-rules-deploy.yml` ("Firebase rules deploy"). Helper: `scripts/firebase-rules-deploy.mjs` (tests: `scripts/firebase-rules-deploy.test.mjs`).

## What it does

1. Refuses to run unless it was started on `main` and the confirm box says `publish` — the first step, before anything touches the key.
2. Maps the chosen target to `firebase deploy --only …` — the only targets it knows:

   | Target | `--only` |
   |---|---|
   | `firestore-rules` | `firestore:rules` |
   | `storage-rules` | `storage` (the default bucket's rules, `project-planner-f986c.firebasestorage.app`) |
   | `indexes` | `firestore:indexes` |
   | `firestore-rules+storage-rules` | `firestore:rules,storage` |
   | `all-rules` | `firestore:rules,firestore:indexes,storage` |

3. Refuses to run unless CI passed on that exact commit: the latest **push-to-main** run of `web-ci.yml` (jobs `build-and-test`, `rules-typecheck`) and of `rulebook.yml` (job `rulebook-check`) for `GITHUB_SHA` must have succeeded (`scripts/firebase-rules-deploy.mjs ci-check`, read through the Actions API with the job's own token, `actions: read`). Runs from other events — the daily scheduled rulebook run, where `rulebook-check` is skipped, or a manual dispatch — never count, and jobs are matched to their workflow file, not by name alone. A missing run or job, an unfinished run or a skipped job blocks. So a failing test or rules check on `main` blocks a publish.
4. Installs with `npm ci --ignore-scripts` (no package install scripts run in the job that later holds the key) and runs the same rules guards CI runs: the size and compile-cost budget (`npm run check:rules-budget`) and the emulator type check (`scripts/check-rules-typecheck.mjs`).
5. Writes the `FIREBASE_DEPLOY_SA_KEY` secret to a private temporary file and checks it is a service-account key of `project-planner-f986c` — any problem prints one fixed message, never the file or a parse error (which could quote the private key). Then deploys with `firebase-tools@15.34.2 --non-interactive` to `project-planner-f986c`, and deletes the key file at the end whatever happened.
6. **Checks what is really live** (also after a half-failed combined deploy, so the summary says what is live) (the method in `docs/firestore-rules-notes.md` "After publishing"): reads `releases/cloud.firestore` (and `releases/firebase.storage/<bucket>` when Storage rules were deployed), then the ruleset each points at, and compares its source with the file on `main` by sha256. The job fails if they differ. The release name, live ruleset id, its `updateTime` and the hash go in the run's summary.

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

- Secret: `FIREBASE_DEPLOY_SA_KEY` (the service account's JSON key). Service account: `github-rules-deployer@project-planner-f986c.iam.gserviceaccount.com`. The job runs in the GitHub environment **`firebase-rules`**.
- Roles: `roles/firebaserules.admin` (create, test and release rulesets; read releases and rulesets for the check), `roles/datastore.indexAdmin` (indexes and the Firestore database lookup), `roles/serviceusage.serviceUsageConsumer` (firebase-tools checks the APIs are enabled), `roles/firebase.viewer` (the project and the default Storage bucket lookup).
- Third-party actions are pinned to full commit SHAs (the tag is in a comment beside each).

### Owner steps, in this order (do these before the first run)

A repository secret can be read by a workflow file on **any** branch that someone with write access pushes, so the workflow's own "main only" check is not enough on its own. These steps lock the key to `main`:

1. **Create the environment.** GitHub → the `project-planner-web` repo → Settings → Environments → **New environment** → name it exactly `firebase-rules` → Configure environment.
2. **Main only.** In that environment: Deployment branches and tags → **Selected branches and tags** → Add deployment branch or tag rule → type `main` → Add rule.
3. **Add the environment secret.** Same page → Environment secrets → **Add environment secret** → name `FIREBASE_DEPLOY_SA_KEY` → paste the key JSON (step 5 gives a fresh one; do step 5 first if you want to paste the new key straight away) → Add secret.
4. **Delete the repository secret.** Settings → Secrets and variables → Actions → Repository secrets → `FIREBASE_DEPLOY_SA_KEY` → delete. From now on only a job in the `firebase-rules` environment on `main` can read the key.
5. **Rotate the key** (the old one sat in a repository secret any branch could read). Google Cloud console → IAM & Admin → Service accounts → `github-rules-deployer@…` → Keys → **Add key → Create new key → JSON** (downloads the new file; put it in the environment secret, step 3) → then delete the old key in the same list (check its key ID and creation date). Delete the downloaded file from your computer once it is saved in GitHub.
6. **Protect main.** Settings → Branches (or Rules → Rulesets) → add a rule for `main`: **Require a pull request before merging**, **Require status checks to pass** with `build-and-test`, `rules-typecheck` and `rulebook-check` selected, and block force pushes. This stops anyone pushing straight to `main` to get round the environment rule.
7. *Optional:* Required reviewers on the environment would make every run wait for an approval. You chose not to, so runs start straight away; you can add it later in the same Environments page.

### First storage-rules run: check the log

When Storage rules are deployed, firebase-tools may try to read the project's IAM policy to check the Storage service account can use cross-service rules. In non-interactive mode it normally skips this, but if the log of the first `storage-rules` (or `firestore-rules+storage-rules` / `all-rules`) run shows a warning naming `resourcemanager.projects.getIamPolicy`, add a read-only role to the deploy account:

```
gcloud projects add-iam-policy-binding project-planner-f986c --member=serviceAccount:github-rules-deployer@project-planner-f986c.iam.gserviceaccount.com --role=roles/iam.securityReviewer
```

It is a warning, not a failure: the rules are still published, and the run's "Check what is really live" step says whether they match.

### Revoking

Delete the key in Google Cloud → IAM & Admin → Service accounts → the account → Keys, and delete the GitHub environment secret.
