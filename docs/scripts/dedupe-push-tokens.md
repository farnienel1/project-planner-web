# Clean up push tokens (one person getting the same push twice)

Each iPhone that signs in saves a "push token" on that person's `users/{uid}` document (`pushTokens`). The push
function sends a notice to every token there. When one phone has two tokens on the list (after an app reinstall or a
token refresh, on iPhone builds before the push-token fix), that phone gets every push twice. The inbox still shows the notice once.

The script below only reads until you add `--apply`. It prints the last 10 characters of each token, never the whole
token.

## Step 0: confirm it is duplicate tokens (optional)

1. Open https://console.cloud.google.com/logs/query?project=project-planner-f986c
2. Search for `device push sent` around the time of the double push.
   You should see `tokensFound` (how many tokens the notice went to) and `successCount`. A `successCount` of 2 or more
   for a person with one phone means duplicate tokens.

## Step 1: look (dry run)

1. `cd ~/Developer/project-planner-web`
   Opens the web project folder.
2. `git pull`
   Gets the latest `main` (with this script).
3. `cd functions && npm ci && cd ..`
   Installs the Firebase admin library the script uses. Takes a minute.
4. `gcloud auth application-default login`
   Once only: signs the script in with your admin Google account. A browser window opens; pick your account.
5. `node scripts/dedupe-push-tokens.mjs --project project-planner-f986c --user <UID> --validate`
   Replace `<UID>` with the line manager's users id (Firebase console → Firestore → `users` → their document id).
   You should see a line `validate users/<UID>: 8 token(s), N dead…` and `Plan: remove … token(s)`. Nothing is written.
   FCM may still accept tokens of a deleted app, so `0 dead` is possible.

## Step 2a: remove the tokens FCM says are dead

1. `node scripts/dedupe-push-tokens.mjs --project project-planner-f986c --user <UID> --validate --apply`
   Removes only the tokens FCM rejected. You should see `Applied: 1 users documents updated.` (or `0` if none were dead).

## Step 2b: if pushes still come twice — keep only the phone's current token

Do these one straight after the other: the app puts that phone's current token first when it opens.

1. `node scripts/dedupe-push-tokens.mjs --project project-planner-f986c --user <UID> --keep-newest`
   Dry run: shows which token would be kept and which removed.
2. On the iPhone that should keep receiving pushes, open Project Planner (signed in as that person) and wait until
   the home screen has loaded.
3. Straight after, on the computer:
   `node scripts/dedupe-push-tokens.mjs --project project-planner-f986c --user <UID> --keep-newest --apply`
   Keeps one token. If the person has another phone or iPad, it gets pushes again the next time they open the app
   there — so don't open the app on another device between steps 2 and 3.

## Every account at once

`node scripts/dedupe-push-tokens.mjs --project project-planner-f986c --validate` (then add `--apply`) checks every
users document that holds tokens. `--keep-newest` is for one person only (it needs `--user`).

If the script stops with "FCM refused the project credentials", nothing was removed: the APNs key in the Firebase
console (Project settings → Cloud Messaging) needs checking first.
