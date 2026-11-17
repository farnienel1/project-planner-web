# iOS follow-on: branded password reset email (17 Nov)

No rulebook change (rulebook unchanged; no packed-script change). Web PR: branch `w-branded-password-reset`.

## What web did

`POST https://projectplanner.us/api/auth/password-reset` with JSON `{ "email": "<address>", "continueUrl": "https://projectplanner.us/login" }`
(no auth header). The server makes the Firebase reset link itself (`returnOobLink: true`, so Firebase sends no email) and
sends the branded Project Planner email. Answers:

- `200 { "ok": true }` for every valid request — account or not, per-email limit hit, send failed. Show the same
  "check your email" message as today.
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
3. `FirebaseBackend.swift` `resetUserPassword(email:)` (~line 7788, `UserStore.sendFirebaseAuthPasswordResetEmail`):
   same client.
4. Tests: a `PasswordResetClientTests` for the URL (apex host, POST, JSON body), 200 / 429 / 503-fallback / other
   handling, and that Firebase is called only on the 503 fallback.

`minimumIosBuild`: not needed (older builds keep sending Firebase's default email, which still works).
