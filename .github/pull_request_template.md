<!--
Fill every section. CI (.github/workflows/pr-checklist.yml → scripts/check-pr-body.mjs) fails the PR
when a required heading is missing or left empty. Write "none" or "n/a" where nothing applies.
Docs-only PRs (every file under docs/ or .github/, or *.md) need only 3-factor and What I did NOT check.
Rules: docs/agent-rules/feature-completeness.md, docs/agent-rules/platform-guardrails.md, docs/OWNER_DECISIONS.md.
Tag claims [Certain], [Likely] or [Guessing].
-->

## Summary

<!-- What changed and why, in two or three sentences. -->

## 3-factor

<!-- Every change considers all three (owner decision 3 Nov). Keep the three rows. -->

| | What changes | Files |
|---|---|---|
| Web | | |
| iOS | | |
| Shared rule | | |

## Owner decisions

<!-- Every docs/OWNER_DECISIONS.md row this work implements or touches: ✓ done / ✗ not done. List judgement calls for the owner to confirm. -->

| Date | Decision (row) | Status in this PR |
|---|---|---|
| | | |

## Call sites

<!-- Both repos. Search by function name and by concept (feature-completeness.md step 1). -->

| Path | Rulebook function ✓ / own calculation ✗ (fixed here / follow-up) |
|---|---|
| | |

## Ways in checked

<!-- Every link, button, notification, Home tile and deep link that opens the screen, on web and iOS (step 2). -->

## Screen map rows updated

<!-- docs/SCREEN_MAP.md rows changed in this PR, or "none (no screen touched)". -->

## Deploy needed

<!-- firestore.rules / storage.rules / firestore.indexes.json / which Cloud Functions, with the exact commands — or "nothing to deploy". -->

## minimumIosBuild needed

<!-- yes / no, and why (platform-guardrails.md §4: pay, hours or who may write a document). -->

## Not done / follow-ups

<!-- Every finding not fixed here (step 5). "Out of scope" is fine; "not mentioned" is not. -->

## What I did NOT check

<!-- No browser run, no device build, no production data, emulator only… -->

## Checklist

- [ ] Call sites table (both repos), every ✗ fixed or listed as follow-up
- [ ] Every way in opened and matched (list them)
- [ ] Web file + iOS file named per rule; iOS hand-off updated if iOS not in this PR
- [ ] Decisions table: every owner decision ✓/✗, judgement calls listed
- [ ] Not done / follow-ups listed
- [ ] What I did NOT check
