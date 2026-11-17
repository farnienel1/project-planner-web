# iOS follow-on: branded password reset email (17 Nov)

No rulebook change (rulebook unchanged; no packed-script change). Web PR: branch `w-branded-password-reset`.

## What web did

`POST https://projectplanner.us/api/auth/password-reset` with JSON `{ "email": "<address>", "continueUrl": "https://projectplanner.us/login" }`
(no auth header). The server makes the Firebase reset link itself (`returnOobLink: true`, so Firebase sends no email) and
sends the branded Project Planner email. Answers:

- `200 { "ok": true }` for every valid request, after a fixed 1.5 seconds — account or not, per-email limit hit. The
  link and email are sent after the answer; if the branded email fails the server asks Firebase to send its own.
  Show the same "check your email" message as today.
- `400 { "error": … }` — not a valid email.
- `429 { "error": …, "retryAfterSec": n }` — too many requests from this address (10 per 15 minutes).
- `503 { "ok": false, "fallback": "firebase" }` — the server cannot send at all. Only then call
  `Auth.auth().sendPasswordReset(withEmail:)` as today, so a reset is never lost.
- Anything else (network error, 5xx without `fallback`) — show the existing failure message; do not fall back to
  Firebase (the server may already have sent the branded email).

Use the apex host `projectplanner.us`, not `www.` (www answers `/api/*` with a 301 that URLSession follows as a GET;
same reason as `AccountDeletionClient.endpointURL`). `continueUrl` is optional; only `https://(www.)projectplanner.us`
`/login` or `/developer-login` is accepted, the server always picks the path from the email.

## iOS files and calls to change

1. `Project Planner/FirebaseBackend.swift` `sendPasswordResetEmailFromLogin(email:)` (~line 1110, the login
   "Forgot password" from `PasswordResetView.swift:111`): replace `try await auth.sendPasswordReset(withEmail: trimmed)`
   with a call to a new `PasswordResetClient.request(email:)` (pattern of `Core/AccountDeletionClient.swift`), falling
   back to `auth.sendPasswordReset(withEmail:)` only on `503 fallback: firebase`.
2. `FirebaseBackend.swift` `resetPassword(email:)` (~line 1122): its three `auth.sendPasswordReset(withEmail: email)`
   fallbacks (~1130, ~1147, ~1154) call the same client. The invitation / verification-code path for users in the
   organisation (`sendPasswordResetVerificationEmail`) is a different email and is not changed here.
3. `FirebaseBackend.swift` `resetUserPassword(email:)` (~line 7788, `UserStore.sendFirebaseAuthPasswordResetEmail`)
   is an admin sending a reset to someone else: use the admin route below, not the public one.
4. Tests: a `PasswordResetClientTests` for the URL (apex host, POST, JSON body), 200 / 429 / 503-fallback / other
   handling, and that Firebase is called only on the 503 fallback.

### Admin "Send password reset" (Manage Users / Edit User)

`POST https://projectplanner.us/api/users/send-password-reset`, `Authorization: Bearer <idToken>`, JSON
`{ "organizationId": "<open organisation>", "userId": "<the person's users id>" }`. The server reads the stored email,
checks the caller may edit that person (`canEditTargetUser`: admins, an Operatives manager for an operative, never the
Super Admin unless the caller is one) and reports the real result: `200 { ok: true }` sent (branded, or Firebase's own
when the branded email failed); `400` not set up yet (pending invite or ghost); `403` not allowed; `404` no login;
`502` could not send. Show the route's `error`. No per-email cap. Use it from `UserStore.sendFirebaseAuthPasswordResetEmail`
(~3915). `UserStore.sendPasswordResetEmail` / `FirebaseBackend.resetPassword(email:)` sends the invitation
verification-code email and is not changed.

`minimumIosBuild`: not needed (older builds keep sending Firebase's default email, which still works).

## Also from 17 Nov: every account email from Project Planner

Same pattern, both need the signed-in user's Firebase ID token (`Authorization: Bearer <idToken>`), apex host:

### Confirm a new login email (was `user.sendEmailVerification(beforeUpdatingEmail:)`)

`POST https://projectplanner.us/api/auth/change-email` with JSON `{ "newEmail": "<address>" }`.

- `200 { ok: true }` → show the existing "We sent a link to …" message and remember the pending email as today
  (`pendingSignInEmailKey`). The answer is the same when the address already belongs to another login.
- A failed send answers `503 { fallback: "firebase" }` too (below). `400` invalid or same as the current email. `429` too many. `401 { code: "requires-recent-login" }` → the person
  must sign in again (the server checks the ID token's `auth_time` is within 5 minutes, as Firebase does); show the
  route's `error`. `401` without a code → sign in again.
- `503 { fallback: "firebase" }` → only then call `user.sendEmailVerification(beforeUpdatingEmail:)` as today.
- File: `Project Planner/FirebaseBackend.swift` `sendVerifyBeforeUpdateEmail(to:)` (~line 6489; the call at ~6497),
  used by `Core/UserStore.swift` (~2639). Get a fresh token with `user.getIDToken()`.

### Resend email verification (`sendEmailVerification`)

iOS does not send plain email verification today (no call on `origin/main`). If it ever does, use
`POST https://projectplanner.us/api/auth/verify-email` with an empty JSON body and the same 200 / 429 / 503-fallback
handling.

### Links the apps open

The verify, confirm-new-email and undo links land on `https://www.projectplanner.us/auth/action` (web); nothing to
change on iOS. Web's action page now handles `verifyEmail`, `verifyAndChangeEmail` and `recoverEmail` (before 17 Nov
it only handled password resets).

### Stays a Firebase template

The "your sign-in email was changed" notice Firebase sends to the **old** address after a change is applied
(`recoverEmail`, with an undo link) is sent by Firebase automatically and cannot be replaced. The owner sets Sender
name "Project Planner" on it (and on the other templates, for the fallback cases) in the Firebase console.
