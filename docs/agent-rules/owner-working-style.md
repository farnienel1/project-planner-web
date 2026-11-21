# How the owner works (standing instructions — every chat, web and iOS)

Loaded automatically through `CLAUDE.md`. These were given by the owner over several chats; they apply to every message.

## Start of every chat
1. Read `docs/HANDOVER.md` first (where things stand, what to do next), then `docs/OWNER_DECISIONS.md` (loaded below), then the rule files.
2. The live launch checklist is https://claude.ai/artifact/7Q7erHuNW9RBFFK4VuiAcR (database collection `items`). Update its rows as work merges.
3. Before a chat gets long, update `docs/HANDOVER.md` and the checklist, then tell the owner to start a new chat and give them the start message.

## Every message
- End with a status line: ⏳ Waiting on / Next / Your move.
- Plain English (the owner is not a developer). Numbered lists with context; never terse info without context.
- Advisor rules (`advisor.md`): don't open by agreeing; tag claims [Certain] / [Likely] / [Guessing]; never "Great question", "You're absolutely right", "That makes a lot of sense", "Absolutely", "Definitely"; show evidence.
- Terminal steps are beginner step-by-step, one command per step, with what it does and what the owner should see. Folders: `~/Developer/project-planner-web` and `~/Developer/project-planner-ios`. Firebase project: `project-planner-f986c`.

## Every change
- Considers web, iOS and the shared rule: a 3-factor table (Web / iOS / Shared rule) in every brief and PR.
- Decisions that change pay or who sees what go to the owner; record every answer in `docs/OWNER_DECISIONS.md`.
- Safeguards A–F (screen map, PR checklist CI, **C: independent review before every merge**, shared test scenarios, weekly drift check, checkpoint test lists). Merge bar: every review finding fixed and no regression versus the live / previous version.
- A rules release (`firestore.rules`) is not handed to the owner to publish until: the static compile cost (`scripts/rules-cost/metric.py`) is clearly below the live rules, the emulator type check (`scripts/rules-cost/ctime.py`) shows 0 errors, the rules suites pass on port 8080, and `RULES_STRICT_BUDGET=1` shows no new 1,000-expression refusals (`docs/firestore-rules-notes.md` "Compile cost").

## Hard constraints
- Never hand-edit `canonical-business.js`, its `.sha256`, `canonical-manifest.json` or the iOS `docs/RULEBOOK.md` mirror; iOS syncs with `scripts/sync-rulebook-from-web.sh`.
- Firestore rules, Storage rules and Firestore indexes are published through the **Firebase rules deploy** GitHub Actions workflow (`docs/firebase-rules-deploy.md`, owner decision 16 Nov), only from `main` and only after the full rules bar under "Every change" passes; it checks the live release matches `main`. Cloud Functions are still deployed **only by the owner, by hand**, when Claude says so. No other automated deploys.
- Never touch production data, billing, signing, TestFlight or the App Store (App Store work is parked until the owner says "lets get ready to launch to app store").
- No model identifier in commits, PRs or code. Commit trailers: `Co-Authored-By` plus the chat's `Claude-Session:` URL; PR bodies end with the Claude Code line and session URL; GitHub comments end with the Claude Code footer.
- Keep web worktrees and clones out of any folder that also holds `project-planner-ios` (use `/home/user/wt/<name>` or the scratchpad, never `/home/user/<name>`): `npm test`, `npm run build:canonical` and the pre-commit hook copy the packed rulebook into `../project-planner-ios`, and on 16 Nov this overwrote the iOS checkout twice. If it happens, restore the four mirror files with `git restore` in the iOS repo (`Project Planner/Canonical/canonical-business.js`, its `.sha256`, `canonical-manifest.json` and `docs/RULEBOOK.md`).
- Never use a bare `git stash`. Keep secrets out of chat and code. Never revoke push key BSA6D294ZA.
- Every change, web and iOS, has its own branch and PR, merged to `main` after the independent review (owner decision 13 Nov, item 10; the old rule that iOS pushed only to `main-vr2rt0-uoqzwv` is dropped).

## Owner rules (19 Nov)
1. **Merge procedure.** Mark the PR ready for review, squash-merge it, and pass the expected head commit (the merge fails if the branch moved). Commit messages end with the `Co-Authored-By` line and the chat's `Claude-Session:` line, no model name.
2. **Rulebook version order.** Web PRs that change the rulebook merge in version order (1.66 → 1.67 → 1.68 …); never merge one out of order. A PR behind main is renumbered to the next free version before it merges.
3. **Lean mode.** No background agents waiting on CI; no PR activity subscriptions; one independent review per change plus one quick re-check; small fixes done directly; finish the queue before new work; short messages.
4. **Security review.** Change no code until the owner approves; fix only items marked Vulnerable, with the smallest change; add an attack test per fix; never rewrite git history or touch outside dashboards; tell the owner which keys to rotate; keep `docs/security-audit-log.md` (no secrets or customer data in it).
