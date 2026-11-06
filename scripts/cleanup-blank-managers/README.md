# Blank "Assigned manager" clean-up

Owner steps (dry run first, then `--apply`, then undo if needed): [`docs/scripts/cleanup-blank-managers.md`](../../docs/scripts/cleanup-blank-managers.md).

- `../cleanup-blank-managers.mjs` — the runner (reads Firestore, backs up, writes only with `--apply`).
- `plan.mjs` — the pure decisions: which rows are junk, which are only listed for review, and the job updates.
- `plan.test.mjs` — tests: `node --test scripts/cleanup-blank-managers/plan.test.mjs`.
