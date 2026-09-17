# Project Planner website security checklist

Claude-style hardening list applied to the Next.js web app. Items that would change product behaviour or risk breaking iOS/web data access are **deferred** (see the last section).

## Applied (no intended feature changes)

- [x] **Security headers** — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `COOP`, and a Content-Security-Policy that still allows Firebase, Stripe, Google Maps, Leaflet/OSM, and the pdf.js worker.
- [x] **Hide `X-Powered-By: Next.js`**
- [x] **Require sign-in for email-sending APIs** — `/api/invites/send-setup-email` and `/api/invites/send-org-addition-email` were public mail relays. Signed-in managers/admins can still send the same invites.
- [x] **Require sign-in for geocoding** — `/api/geocode` can no longer be used anonymously to drain the Maps quota. Dashboard maps still send the user's Firebase token.
- [x] **Require sign-in for Stripe Checkout creation** — `/api/stripe/create-checkout-session` now checks the Firebase user matches the checkout `userId` / email. Org setup still creates the Firebase account first, then starts Checkout.
- [x] **Rate limits** on invite, geocode, plans, checkout, and verify-session routes.
- [x] **Input checks** — email format, UUID invitation/org ids, Stripe session id format, body size, geocode query length.
- [x] **HTML escaping** in invite emails and site-map popups; strip CR/LF from email subjects (header injection).
- [x] **Invitation listing is no longer public** in Firestore (`allow get` for setup-password links; `allow list` only when signed in). Password setup still works from the email token.
- [x] **Do not return raw secret material** in API error strings.

## Deferred (would change behaviour or could break the live app / iOS)

Tell me if you want these done as a follow-up:

- Tightening `canAccessOrganization` (today any signed-in user can reach an org that exists) — this is likely load-bearing for iOS and web after permission-denied bugs.
- Scoping `users` reads to the current organisation — any signed-in user can currently read user docs; changing this can break staff lists, invites, and iOS.
- Removing the `canPatchOperativeProfileMetadataOnly` emergency fallback.
- Restoring org-scoped rules on `holidayBookings` (currently any signed-in user, by design, while ACL was unstable).
- Requiring sign-in on `/api/stripe/verify-session` — left public so Safari/ITP dropping the Firebase session during Stripe redirect cannot block paid setup. Session ids remain unguessable.
- Enforcing 2FA / stronger password rules — that would change the sign-in feature.
- Adding Firebase Admin / Storage rules files — there is no Admin SDK or `storage.rules` in this repo; adding them needs extra secrets and a deploy path.

Firestore rules still need to be **deployed** to Firebase for the invitation listing change to take effect (`firebase deploy --only firestore:rules`).
