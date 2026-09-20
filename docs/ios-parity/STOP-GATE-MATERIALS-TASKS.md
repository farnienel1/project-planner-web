## ⏸ STOP GATE: Materials send list + job My Tasks

**Done:**
- Materials **Send list** on projects and small works now follows `MaterialsSendListSheet.swift`: wholesaler groups + contacts, one-off Name/Email, plain-text toggle, Quote/Order, multi-wholesaler order alert, Review materials, Quote sent / Order placed.
- Emails go through the same Cloud Function as iOS (`sendProjectPlannerEmail`), HTML or plain-text wrapper, then Firestore send history + line status.
- Job **My Tasks** now has the iOS search+filter bar, filter sheet, clipboard empty, task rows (assignees, created by, gear), New task sheet (Myself/Manager/Operatives, checklist, priority grid), and assigned-to-me excludes completed.

**Files created/changed:** `MaterialsSendListSheet.tsx`, `lib/materials/sendListLogic.ts`, `lib/email/materialRequestEmail.ts`, `app/api/materials/send-request-email/route.ts`, task sheets under `components/projects/tasks/`, `ProjectTasksSection.tsx`, `ProjectMaterialsSection.tsx`.

**Parity table:**
| iOS element | Web | Status |
|---|---|---|
| Send list wholesaler groups + contacts | MaterialsSendListSheet | ✅ |
| One-off Name + Email | MaterialsSendListSheet | ✅ |
| Send in plain text | toggle + email builder | ✅ |
| Quote / Order + multi-wholesaler alert | MaterialsSendListSheet | ✅ |
| Review materials / confirmation | MaterialsSendListSheet | ✅ |
| Cloud Function email | `/api/materials/send-request-email` | ✅ |
| Job task rows + filters + New task | ProjectTasksSection | ✅ |
| Task photo/file/site-audit attach | AddProjectTaskSheet | ⚠️ uploads when chosen; camera is the file picker |

**Deviations and why:** Home Tasks hub still the older list. Full iOS HTML email templates are rebuilt in TypeScript with the same copy and layout, not byte-copied from Swift string literals.

**Blocked / needs Farnie:** Confirm on the **deploy preview for this PR**, not only production (production can lag). Q11 test org still needed for a live wholesaler send.

**Next step:** Open the preview after merge/deploy, Send list on a project and a small work, then My Tasks create/filter.
