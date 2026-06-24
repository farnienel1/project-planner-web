# Deploy Firestore rules (fix “permission denied” on org setup)

## Why you saw that error

When you click **Activate without payment**, the app:

1. Creates your Firebase Auth account
2. Writes `organizations/{newOrgId}` with you as admin
3. Writes `users/{yourAuthUid}` with your profile
4. Writes guided setup data (project, clients, etc.)

If Firestore **security rules** don’t allow those writes, step 2 or 3 fails with:

> Firestore blocked this setup (permission denied)

The app code is correct — **your Firebase project rules** need updating. Rules are not stored in the deployed web app; they live in the Firebase project.

## Quick fix (Firebase Console)

1. Open [Firebase Console](https://console.firebase.google.com) → your project (`project-planner-f986c`)
2. **Firestore Database** → **Rules**
3. Copy the full contents of **`firestore.rules`** from this repo
4. Paste into the editor → **Publish**

## Deploy via CLI (optional)

```bash
cd ~/project-planner-web
git pull   # includes .firebaserc with project-planner-f986c
npm install -g firebase-tools   # if needed
firebase login
firebase deploy --only firestore:rules
```

If you see **“No currently active project”**, either pull latest (`.firebaserc` sets the default) or run once:

```bash
firebase use project-planner-f986c
firebase deploy --only firestore:rules
```

`firebase.json` in this repo points at `firestore.rules`.

## What changed vs your previous rules

Three small additions for **web org setup** and **multi-org** — everything else is your existing iOS rules:

1. **`isOrgBootstrapAdminProfileCreate`** + **Path 3** on `users` create — lets the org creator write `users/{authUid}` right after creating the org (before a `users` doc exists for admin checks).
2. **`users/{userId}/orgMemberships/{membershipOrgId}`** — required for Change organisation and cross-org invites.
3. **`isOrgAdminViaMembersMap`** — org admin checks via `members` map (works during bootstrap before profile exists); used on `userEmails` and org `update`.

Path 1 self-creation now also requires `request.auth.uid == userId` and case-insensitive email match.

## After publishing rules

1. `git pull` latest web app code
2. `npm run dev`
3. Run **fresh** org setup (use a new email if the previous attempt partially created an Auth user)
4. **Activate without payment** should complete and redirect to the dashboard

## Email verification (paid path only)

- **Activate without payment** → goes straight to dashboard (no verify step)
- **Stripe payment** → after success → `/setup/verify-email` → click link in email → **I have verified my account** → dashboard

Verification email is sent automatically when the account is created during setup.
