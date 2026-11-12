# Email function (`sendEmail`)

`sendEmail` is the one way either app sends email. It replaces `sendProjectPlannerEmail`, which was deployed from outside any repo, had no authentication, and sent any HTML, attachments and "From" name to any address from `info@projectplanner.us` for anyone who found its URL (the URL ships inside the iOS app).

Source: `functions/email/` (wired in `functions/index.js`, codebase `inbox-push`). Tests: `functions/email/email.test.js` (rules, rate limiter, mocked Resend) and `lib/email/emailFunctionParity.test.ts` (the function's template copies match the web builders). Both run in `npm test`.

## What it enforces

| Check | Rule |
|---|---|
| Authentication | App: `Authorization: Bearer <Firebase ID token>`, verified with `verifyIdToken(token, checkRevoked = true)`. Web server: `X-Project-Planner-Server-Key` (secret `EMAIL_SERVER_KEY`) plus the user's ID token when the route has one. |
| App Check | `X-Firebase-AppCheck` verified when present (an invalid token is refused). When absent it is logged (`sendEmail: no App Check token`) and allowed, so it can be enforced later. |
| Membership | App callers must be an active member of `orgId` (`organizationMemberActive`). Level from `organizationLevelFor`; `staff` templates need admin or manager. |
| Templates | Apps send a template name and data; subject, HTML and links are rendered in the function. Apps cannot send HTML. `web_rendered` (pre-rendered HTML) is accepted only with the server key. |
| Recipients | Per template, below. Never a free address from an app. One message per recipient (no shared To line). |
| From | `"<organisation name>" <info@projectplanner.us>` (`parseOrganizationName`, header-sanitised), or `"Project Planner"` with no organisation. A `fromName` (or `senderName`, `cc`, `replyTo`) in the request is always ignored. Caller envelope (`callerEnvelopeFields`): with `data.fromCaller: true` the From is `"<caller's name> via Project Planner" <info@projectplanner.us>` — for `web_rendered` (server key) and for app templates that opt in (`callerEnvelope: true`: `material_request`). The name is the verified caller's own: for app callers `firstName surname` from their `users/{uid}` document (no name there → the organisation From); for the web server the same profile name, else the token name. The address is always `info@projectplanner.us`, never the caller's. |
| CC | Only with `data.ccCaller: true` on `web_rendered` or an opted-in app template: the verified caller's email (app callers: the ID token email) on every message, never an address from the request. The caller's own entry in `to` (`isSelf`) is then dropped for app callers, so they get one CC per recipient and no separate copy. |
| Reply-To | `info@projectplanner.us`; the sender's own token email for `material_request` (with or without the caller envelope); for `web_rendered` the `data.replyTo` the web route set. |
| Attachments | PDF, XLSX, CSV only (by extension; content type set by the function), strict base64, at most 80 files and 10 MB decoded in total. Only `timesheet_export` and `web_rendered` take attachments. |
| Rate limit | `emailRateLimits/{uid}` (Firestore transaction): 60 messages an hour and 300 a day per user; web mail with no user uses `emailRateLimits/server` (600 / 3000). Each recipient (To) counts; the caller's own CC does not add a count. No security rule matches the collection, so apps cannot read or reset it. |
| Headers | Only `List-Unsubscribe` / `List-Unsubscribe-Post`, and only from the web server. |
| Request id | Optional top-level `requestId` (8–128 letters, digits, `-`, `_`; a UUID). Checked after every other check above (job check, recipients, render), before the rate limit. The function claims `emailRequestSends/{sha256(caller uid or server, orgId, template, requestId, sorted recipients)}` in a Firestore transaction: a repeat of a sent request answers 200 with the first send's response plus `deduped: true` — no email sent, no rate-limit count; a repeat while the first is still sending (claim under 5 minutes old) answers 409 `inProgress: true`; a claim older than 5 minutes (the call died) is taken over. A claim is deleted when nothing was sent (rate limited, every message refused), so a retry sends. iOS sends the queued send's id (the send record id) on every replay; the web route sends one id per Send press, the same for each recipient's call. Without `requestId` nothing changes (older builds). No security rule matches the collection (Admin SDK only, like `emailRateLimits`); each record has `expireAt` (30 days) for an optional TTL policy. Known gap: if the function dies after the provider accepted a message and before it records the send, a retry after 5 minutes sends again. |

## Templates

| Template | Who may send | Recipients (rule) | Data | Notes |
|---|---|---|---|---|
| `invite_setup` | admin, manager | exactly the email on `invitations/{data.invitationId}`, which must belong to `orgId` and be unused (`invitation`) | `invitationId` | Welcome pack (`welcomeEmailPack.js`, byte-identical to web). Link `https://www.projectplanner.us/setup-password.html?token=<invitationId>`. First name from the invitation. |
| `password_reset_link` | admin, manager | same as `invite_setup` | `invitationId` | iOS reset-link body (`createPasswordResetLinkEmailBody`), rendered here. |
| `timesheet_export` | admin, manager | 1–5 active members of the organisation, found by their users email (`member`) | `weekTitle`, `paymentRunStamp`, `timesheetCount?`, `downloadLinks?` (Firebase Storage URLs only) | `managerExportEmailHTML`; greeting from the recipient's users document; PDF attachments. |
| `material_request` | admins, super admins and managers (`canSendMaterialOrders`) | contacts on the organisation's `wholesalers` documents (`parseWholesalerDocument`), at most 3 typed addresses, plus the sender's own email; at least one non-sender recipient (`materialOrderRecipientCheck`, `wholesaler_or_self`) | `requestType` (`quote` / `order`), `jobNumber`, `siteName?`, `siteAddress?`, `materials[]` (1–250), `sendAsPlainText?`, `deliveryRequiredAt?` (ISO), `senderPhone?`, `fromCaller?`, `ccCaller?`, `jobId?` (1.24.0: must be a project or small works of `orgId` when sent; 1.27.0: the caller must also see that job — `canSeeJob` — and `jobNumber` must be its stored job number, `materialRequestJobCheck`) | Web/iOS material builder. Subject, From name, Reply-To and CC are `materialRequestEmailEnvelope` (rulebook 1.24.0), the same builder the web route uses. Sender name, email and phone from the caller's users document and token; company and logo from the organisation; dates in the organisation zone (`organizationTimeZone`, `formatMaterialDeliveryRequired`, `defaultMaterialDeliveryRequiredAt`). Opts in to the caller envelope (`callerEnvelope: true`): with `fromCaller` and `ccCaller` (what iOS sends) each wholesaler gets one message From `"<sender> via Project Planner"`, CC and Reply-To the sender, and no `Copy:` message is sent (the sender is CC'd instead). Without `ccCaller` (older iOS builds) the sender's own address in `to` still gets a separate message whose subject starts `Copy: `. |
| `leave_cancelled` | admin, manager | one active member (`member`) | `dateText` | "<caller> has cancelled your annual leave request for <dateText>." |
| `web_rendered` | web server key only | the one address the web route chose | `subject`, `html`, `text?`, `replyTo?`, `headers?`, `fromCaller?`, `ccCaller?` | Used by every web API route (below). `fromCaller: true` sends as `"<signed-in caller's profile name> via Project Planner" <info@projectplanner.us>`; `ccCaller: true` copies the signed-in caller (CC) on the same message. Both use only the verified caller (ID token + users document), never a name or address in the request. The response carries `ccSupported: true` and each message's Resend `id` and `cc`. |

Web routes on `web_rendered` (the route does its own checks first): MFA code (`/api/auth/mfa/start`, `/resend`), invite set-up (`/api/invites/send-setup-email`), organisation addition (`/api/invites/send-org-addition-email`), account confirmation (`/api/org-setup/send-confirm-email`), material request (`/api/materials/send-request-email`), timesheet export (`/api/timesheets/export-email`), billing (Stripe webhook: purchase, trial ending, payment failed), owner password reset, support contact form, login-email fix request, register-interest acknowledgement and owner ping (`lib/interest/notifyEmail.ts`).

## iOS request contract

Replace `ResendEmailService.sendViaFirebaseFunction` (and remove the `#if DEBUG` direct-Resend fallback and the `EmailService` plain-text invite fallback, which would also stop working) with:

```
POST https://us-central1-<FirebaseApp.options.projectID>.cloudfunctions.net/sendEmail
Content-Type: application/json
Authorization: Bearer <Auth.auth().currentUser.getIDToken()>
X-Firebase-AppCheck: <AppCheck token>        (optional for now; send it once App Check is set up)
```

```json
{
  "orgId": "<FirebaseBackend.currentOrganization.firestoreDocumentId>",
  "template": "invite_setup | password_reset_link | timesheet_export | material_request | leave_cancelled",
  "to": ["recipient@example.com"],
  "data": { },
  "attachments": [{ "filename": "Name timesheet for payment run date 26.10.26 01.11.26.pdf", "content": "<base64>" }],
  "requestId": "<stable id of this send, optional>"
}
```

`data` per template (iOS call site → template):

- `FirebaseBackend.sendInvitationEmail` → `invite_setup`, `to: [invitation email]`, `data: { "invitationId": "<invitations doc id>" }`.
- `FirebaseBackend.sendPasswordResetVerificationEmail` → `password_reset_link`, same shape (the new invitation id).
- `InvoicingView` timesheet export → `timesheet_export`, `to: [exporter email]`, `data: { "weekTitle", "paymentRunStamp", "timesheetCount", "downloadLinks": [{ "fileName", "url" }] }`, PDFs in `attachments`. The recipient must be an active member (today it is the exporter themself).
- `MaterialRequestEmailClient.send` → `material_request`, one call with `to: [each wholesaler contact email…]` (not the sender), `data: { "requestType": "quote"|"order", "jobNumber", "siteName", "siteAddress", "materials": [{ "material", "quantity", "unit", "brand", "productCode", "notes", "lengthDisplay" }], "sendAsPlainText", "deliveryRequiredAt": "<ISO 8601>", "senderPhone", "fromCaller": true, "ccCaller": true }`. Each wholesaler gets one message, CC the sender; the response's `results[].cc` lists the sender and `ccSupported` is true. Every non-self recipient must be a contact saved on a `wholesalers` document of the organisation plus at most 3 typed addresses (see "One-off material recipients"). Optional `"jobId": "<project or small works document id>"` (rulebook 1.24.0): when sent, the job must be in `organizations/{orgId}/projects` or `smallWorks`, else `404 Job not found in this organisation`; 1.27.0: the caller must see the job (rulebook §17 `canSeeJob`: admins every job, a manager with the Projects / Small works toggle every job of that kind, any other manager the jobs they manage) else `403 You cannot send materials for this job.`, and `jobNumber` must be the job's stored number (spaces and case aside) else `409 The job number does not match this job. Reopen the job and send again.`; without `jobId` the request is accepted as before. Top-level `requestId` (optional, "Request id" above): the queued send's id, created once when the order is queued (the send record id) and sent unchanged on every replay, so a replay after a crash or timeout is answered `deduped: true` instead of emailing the wholesaler again; a `409` with `inProgress: true` means wait and retry. The web send route (`/api/materials/send-request-email`) sends `jobId` and applies the same check.
- `NotificationService` annual leave cancelled email → `leave_cancelled`, `to: [person email]`, `data: { "dateText": "<annualLeaveDateText>" }`.

Response: `200 { "sent": true, "sentCount": n, "failed": [], "results": [{ "to", "id", "cc" }], "from", "ccSupported": true }` (plus `"deduped": true` when it repeats an earlier send with the same `requestId`). When some recipients failed: `200` with `"sent": false` and their addresses in `failed`. Errors: `{ "sent": false, "error": "<message>" }` with `400` (bad template, data, attachment or recipient list), `401` (no / bad ID token or App Check token), `403` (not an active member, wrong level, recipient not allowed), `404` (organisation or invitation not found), `413` (attachments over 10 MB or 80 files), `409` (a request with this `requestId` is still being sent; `inProgress: true`), `429` (rate limit; `Retry-After` seconds, `retryAfterSec` in the body), `502` (Resend refused every message). iOS keeps treating `sent == true` as success.

## Owner steps

1. Secrets (once):
   - `firebase functions:secrets:set RESEND_API_KEY` — the Resend key (the one the old function uses).
   - `firebase functions:secrets:set EMAIL_SERVER_KEY` — a long random value (e.g. `openssl rand -hex 32`).
   - Netlify: set `EMAIL_SERVER_KEY` to the same value (server-side env, not `NEXT_PUBLIC_`).
2. Deploy the function: `firebase deploy --only functions:inbox-push` (deploys `sendEmail` beside `sendDevicePushOnNotificationCreate`; it does not touch `sendProjectPlannerEmail`). The function is `invoker: public` at the IAM level on purpose; every request is checked in code.
3. Test before the web deploy:
   - No token → 401: `curl -s -X POST https://us-central1-project-planner-f986c.cloudfunctions.net/sendEmail -H 'Content-Type: application/json' -d '{}'`.
   - Server mode to your own inbox: the same with `-H "X-Project-Planner-Server-Key: $EMAIL_SERVER_KEY" -d '{"template":"web_rendered","to":["you@example.com"],"data":{"subject":"sendEmail test","html":"<p>ok</p>"}}'` → `200 {"sent":true,…}`.
   - App mode: with a signed-in test user's ID token, send `timesheet_export` to that user's own email with a small PDF.
4. Deploy the web app (Netlify) with `EMAIL_SERVER_KEY` set. Without it every web email fails with "EMAIL_SERVER_KEY is not set" (fail closed). Check an MFA sign-in and an invite.
5. Ship the iOS change (contract above).
6. Once the iOS release that calls `sendEmail` is the minimum build (`platformConfig/app.minimumIosBuild`, rulebook §18), delete the old function: `firebase functions:delete sendProjectPlannerEmail --region us-central1`. Until then older iOS builds keep using the open function, so the hole stays open until this step.
7. Later: enforce App Check (refuse requests without `X-Firebase-AppCheck`) once the logs show no `sendEmail: no App Check token` from current builds.

## One-off material recipients (decided, rulebook 1.15.0)

The owner accepted a narrow exception: a send may include at most 3 typed addresses that are not saved on any wholesaler (`materialOrderRecipientCheck`, `MATERIAL_ORDER_TYPED_RECIPIENTS_MAX`, message `MATERIAL_ORDER_TYPED_RECIPIENTS_MESSAGE`), plus any number of saved wholesaler contacts and the sender's own copy. Both senders apply the same check: `material_request` in this function (`wholesaler_or_self`, `recipients.js`) and the web route `/api/materials/send-request-email` before it renders and sends through `web_rendered`. A fourth typed address, an invalid address, or a send with nobody but the sender is refused with the rulebook message. Regular suppliers are saved as wholesaler contacts.
