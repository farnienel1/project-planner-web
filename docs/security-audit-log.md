# Security audit log

One line per security finding: when it was found, what it was, and what was done about it. **No secrets, keys, passwords or customer data go in this file**: name a key only by its service and type, never its value.

Owner rules for security work (19 Nov, `docs/agent-rules/owner-working-style.md` rule 4):
- change no code until the owner approves;
- fix only items marked Vulnerable, with the smallest change;
- add an attack test for each fix;
- never rewrite git history or change outside dashboards;
- tell the owner which keys to rotate.

| Found | Finding | Severity | Fix | Status |
|---|---|---|---|---|
| 4 Nov | An Operatives manager could make an operative an admin through `permissions.adminAccess` (and other privilege flags), and create a user with them. | Vulnerable | Rules 1.31.1: privilege flags typed and read in either place; operatives managers act only on real operatives (#264) | fixed, published |
| 4 Nov | Accepting an invitation needed only the invitee's email, so an unverified sign-up on that email could take the invite (F5). | Vulnerable | Proof of the emailed invitation (`invitationId`, marked used in the same batch) (#264) | fixed, published |
| 10 Nov | Notification creates with a server timestamp crashed the rules engine; phones queued writes behind them. | Availability | Rules 1.33.1: notifications allow split | fixed, published |
| 15 Nov | Uploads accepted SVG, Office and macro files and any declared type; stored URLs were rendered as links without checks. | Vulnerable | 1.50.0 upload policy (photos and PDF only, content checked from the first bytes), `safeExternalUrl` for stored links, Storage rules per path | fixed, published |
| 16 Nov | Platform scan: timesheets could be filed under a colleague's id; Storage roles were read from another company; timesheet export PDFs were readable by every manager; the eraser could delete a person who belonged elsewhere; the export email accepted typed recipients. | Vulnerable | Rules and Storage 1.54.1 (#334) | fixed, published |
| 16 Nov | Owner console: the 2FA setup skip applied to any account; owner routes did not check the 2FA cookie for the same account. | Vulnerable | 24-hour new-account window read from Firebase Auth; signed purpose-bound cookies (#340) | fixed |
| 16 Nov | Line managers could not open reports' timesheets with `privatePay` on (read of a missing document). | Availability | Rules 1.54.2 | fixed, published |
| 17 Nov | Secret scan of all three repos: credentials committed in history (an M365 mailbox password, an M365 app password, two Resend API keys, a SendGrid API key). The old `project-planner-email-backend` repo held the mailbox password. | Vulnerable | Mailbox password changed and sign-ins checked by the owner; old repo made private and confirmed unused. **Owner to revoke:** the M365 app password, both Resend keys and the SendGrid key. History is not rewritten (owner rule). | partly done; revoke pending |
| 17 Nov | The web page gate trusted the MFA pass alone, with no server-side session. | Hardening | Firebase session cookie bound to the same uid (#359) | fixed |
| 17 Nov | Mass-assignment audit: server routes spread request bodies; several rules were denylists; reports were saved from the device unchecked; `isOrganizationSuperAdmin` had a blank fallback. | Vulnerable | Server allowlist and stored names (#391, rulebook 1.65.x); rules 1.64.0 allowlists (#392, published 18 Nov); server report checks (decision B); iOS writes changed fields only (iOS #263) | fixed, published |

## Open

- Owner: revoke the four keys listed on 17 Nov in their dashboards (Microsoft 365, Resend, SendGrid).
- Owner: decide `STRIPE_TRIAL_REQUIRES_CARD` and TOTP for the owner login (security review step 6); approve Part B.
- Follow-up (not a vulnerability): scheduled notices without an actor can still be written by any member for another member; narrowing needs a server writer (1.64.0 notes).
