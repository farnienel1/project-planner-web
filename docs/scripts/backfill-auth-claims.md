# Backfill: auth claims for the 1.32.4 rules

Rulebook 1.32.4 makes the security rules read each person's role and company facts from their Firebase sign-in token
(custom claims), instead of looking them up in Firestore on every request. This is what lets Google publish the rules
again. Before the new rules go live, everyone needs those claims. A Cloud Function keeps them up to date from then on;
this script sets them once for everybody who already has an account.

Nothing changes for anyone until step 4: the rules that are live today do not read the claims.

## What you need

- A terminal in the `project-planner-web` folder, on the branch with 1.32.4 merged.
- The Firebase CLI signed in to the Project Planner project (`firebase login`).
- Google credentials for the script: run `gcloud auth application-default login` once (or set
  `GOOGLE_APPLICATION_CREDENTIALS` to a service-account key file that can manage Firebase Auth users and read Firestore).
- The script's libraries: `npm ci`, then `cd functions && npm ci && cd ..`.
- `npm run build:canonical` (refreshes the rule script the function and the backfill use).

## The four steps, in order

1. **Deploy the functions.**

   ```
   firebase deploy --only functions:inbox-push:authClaimsOnUserWrite,functions:inbox-push:authClaimsOnMembershipWrite,functions:inbox-push:authClaimsOnOrganizationWrite
   ```

   From now on, any change to a person's account, membership or company members list updates their claims within
   seconds.

2. **Backfill.** First the dry run, which changes nothing:

   ```
   node scripts/backfill-auth-claims.mjs --project project-planner-f986c
   ```

   It ends with a line like `DRY RUN on project-planner-f986c: 412 accounts, 398 to change, 0 already current, 0
   refresh-token revocations, 0 failed.` Accounts without a Project Planner profile are counted but skipped. If it
   lists people who "belong to more organisations than fit in their claims", stop and send the list to the developer:
   the new rules would refuse them in the companies listed. Then apply:

   ```
   node scripts/backfill-auth-claims.mjs --project project-planner-f986c --apply
   ```

   Run the dry run again: it should say `0 to change`. To check one person: add `--uid <their uid>` (it prints their
   claims).

3. **Wait one hour.** Phones and browsers that were already signed in pick up their new token within the hour.

4. **Publish the rules** (`firebase deploy --only firestore:rules`, or paste `firestore.rules` into the console), then
   check what is live as in `docs/firestore-rules-notes.md` "After publishing: check what is really live".

## What changes for people

- A change to someone's role, permissions or company (or deactivating them) applies within seconds on the web app
  and on iPhones with the next iOS release; older iPhone builds pick it up within an hour.
- Deactivating someone also signs them out at their next token refresh. A token they already hold keeps working until
  it expires, at most an hour.
- If something goes wrong after step 4, publish the previous rules again (1.32.3). The claims can stay; they do no harm.

## If the script fails

- `firebase-admin is not installed`: run `cd functions && npm ci`.
- `The packed rulebook has no authClaimsForPerson`: run `npm run build:canonical`.
- `Could not load the default credentials`: run `gcloud auth application-default login`.
- `FAILED <uid>: …` lines: re-run the script; it only changes what is still out of date.
