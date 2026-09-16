## ⏸ STOP GATE: Phase 3 — Clients, Projects list/hub, Daily overview
**Done:**
- Specs for Clients, Projects (list+hub), Daily overview from Swift.
- Clients master–detail with original wording, address field, UUID `setDoc`, `client_created` notification, admin-only delete.
- Projects list: stats, search (incl. address), chips, iOS work cards, `visibleWorks`, empty states.
- Project hub desktop split (Manage 8/12 + Details 4/12).
- Daily overview date strip, glance hero, unbooked labour, annual leave, other/office/WFH, by-project cards.

**Files created/changed:** `docs/ios-parity/sections/09-clients.md`, `12-projects.md`, `22-daily-overview.md`; `components/clients/ClientsScreen.tsx`; `components/projects/{WorkCard,ProjectsListScreen}.tsx`; `components/daily-overview/DailyOverviewScreen.tsx`; `lib/daily-overview/buildDailyOverview.ts`; converters serializeClient/Notification; `projectStore` client writes.

**Evidence coverage:** Clients 5/5 Swift files. ProjectsView + hub portion of ProjectDetailView (not 6k-line tiles). DailyOverviewView layout/grouping (payroll engine not ported).

**Parity table:**
| iOS element | Web | Status | Note |
| Client cards / create / edit | `ClientsScreen` | ✅ | |
| `saveClient` UUID + empty strings | `serializeClient` | ✅ | |
| Jobs not rewritten on client edit | updateClient only | ✅ | |
| Projects list work cards | `WorkCard` | ✅ | |
| Project hub tiles Deadlines / Active users | — | ❌ | Section 16 |
| Daily overview grouping | `buildDailyOverview` | ✅ | |
| Payroll OT hours | estimated | ⚠️ | Section 17 |

**Deviations and why:** Daily overview hours/OT use 8h full-day estimates until PayrollHoursEngine. Book labour opens `/dashboard/schedule`. Create/edit project forms unchanged.

**Blocked / needs Farnie:** Q11 test org for write tests. No iOS screenshots in `docs/ios-parity/screenshots/` (Q12).

**Questions:**
Q12. Please drop iOS screenshots for Clients, Projects list/hub, and Daily overview into `docs/ios-parity/screenshots/` (or attach in chat) so we can match light/dark pixels.
Q13. Next section after this trio: Manage Users (default Phase 3 #1) or continue Projects create/edit?

**Suggestions (not built):** Projects table/grid toggle (optional desktop extra).

**Next step:** Farnie’s go-ahead and screenshots; then either verify on a test org or the next section.
