# Firebase

Firebase rules, indexes, storage rules, and functions are deployed only from this repo with `firebase deploy`.

The live project is `project-planner-f986c` (see `.firebaserc`). This repo is the single home for:

- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`
- Cloud Functions under `functions/` (`inbox-push`)

Do not deploy Firestore, Storage, or Functions from the iOS checkout. After a change, publish from this repo:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage,functions:inbox-push
```

Use a narrower `--only` list when you are publishing just one of those surfaces. Do not run a bare `firebase deploy` unless you intend to publish every configured target in `firebase.json`.

`interestRegistrations` create is denied for clients. New rows go through `POST /api/interest/register` (Admin SDK / service account). Owner console still reads and updates as the platform owner.
