# Prompt to paste into the chat that builds the owner console

Copy everything between the lines into the other chat as its first message.

---

You're taking over the **owner console rebuild** (`/developer`) in `project-planner-web`. The audit and the plan are done and are in the repo. Your job is to **build it, one PR at a time**, exactly as planned.

**Read first, in this order:**
1. `CLAUDE.md` and everything it loads.
2. `docs/HANDOVER.md`
3. `docs/OWNER_DECISIONS.md`
4. `docs/owner-console/SPEC.md` (what I asked for; it wins where it is clear)
5. `docs/owner-console/AUDIT.md` (what is broken today, with file and line evidence and the test baseline)
6. `docs/owner-console/PLAN.md` (how to build it: architecture A1–A9, metric contracts, data plan, actions, decisions D1–D17, test plan, PR list)

These files are on the branch `main-tiictq` until they're merged. If they aren't on `main` yet, run `git fetch origin main-tiictq` and read them from there.

**How to work:**
1. **First, check the plan independently.** Re-run the §6.1 baseline from `SPEC.md`, then spot-check five AUDIT findings in the code, including C1, C2 and H2. Tell me in plain English if anything in `AUDIT.md` or `PLAN.md` is wrong or missing. Don't redo the whole audit.
2. **Then show me the decisions** D1–D17 from `PLAN.md` §5 as a numbered list with the recommendation for each, so I can answer. Record my answers in `docs/OWNER_DECISIONS.md` in your first PR.
3. **Build the PRs in the order of `PLAN.md` §8**, starting with **PR 0 (security hotfix)**. One branch and one draft PR each. Tests first (failing tests for the AUDIT broken-list items), then the fix. Independent review before merge. **Stop after each PR and wait for my "go".**
4. Every PR body follows the template and ends with "Smoke test for you" and "If something's wrong" (`SPEC.md` §6.7). It also lists what I must deploy, one command per step.
5. Never run anything against production. Never deploy rules or functions yourself. Never touch billing or Stripe settings.
6. **Shared files** (`firestore.rules`, `docs/RULEBOOK.md`, `lib/canonical`, `functions/`, `docs/OWNER_DECISIONS.md`) may be changed by another chat too. Check open PRs before editing them, and take the next free rulebook version number when you merge.
7. If the code disagrees with the plan, the code is the truth: tell me what differs and what you recommend, then wait.

**Known environment notes from the audit:**
- This repo's `xlsx` dependency downloads from cdn.sheetjs.com. A cloud sandbox may block it; if `npm ci` fails on it, report it rather than changing `package.json`.
- `npm run build` needs the placeholder Firebase settings CI uses (`.github/workflows/web-ci.yml`).
- The storage-rules suite failed 20/28 in the audit sandbox; check whether it passes in yours.
- The design reference `docs/design/admin-console/admin-console-reference.html` isn't in the repo yet. Ask me for it before the first UI PR (PR 1's sidebar).

Start with step 1 and finish your message with the status line.

---
