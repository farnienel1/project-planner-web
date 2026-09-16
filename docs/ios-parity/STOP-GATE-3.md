## ⏸ STOP GATE: Phase 3 — lists (Clients → Weekly Report)
**Done:**
- Specs for Clients, Projects (list+hub), Daily overview, Small works, Operatives, Managers, Weekly Report from Swift.
- Clients master–detail with UUID `setDoc`, `client_created` notification, admin-only delete.
- Projects list: stats, search, chips, iOS work cards, `visibleWorks`.
- **Daily overview fix:** job cards now list people (operatives, managers on-site, subcontractors) from Firebase; date matching covers London/UTC/local; getDocs seed + live `onSnapshot` for bookings; missing `bookedBy` / `Full Day` aliases parse; loading and Firestore errors shown.
- Small works list matches Projects (Active default, `visibleWorks` `.smallWorks`, `WorkCard`).
- Operatives: `operativeMode` users, token search, Create Operative writes `operatives/{UUID}`.
- Managers: manager users excluding admins; Create Manager writes `managers/{UUID}` with `mobileNumber`.
- Weekly Report: This Week / Last Week / invoicing / custom range; Generate Report from the same Firebase collections iOS uses.

**Files created/changed:** `docs/ios-parity/sections/{09,10,11,12,13,22,23}-*.md`; Daily overview builder/screen; SmallWorks/Operatives/Managers list screens; serializeOperative/serializeManager; subscribeOrgCollection getDocs seed.

**Evidence coverage:** DailyOverviewView people rows + grouping. SmallWorksView + CreateSmallWorksView write path. OperativesView + CreateOperativeView. ManagersView + CreateManagerView. WeeklyReportView period + export sections (HTML instead of xlsx/pdf).

**Parity table:**
| iOS element | Web | Status | Note |
| Client cards / create / edit | `ClientsScreen` | ✅ | |
| Projects list work cards | `WorkCard` | ✅ | |
| Daily overview people on jobs | `buildDailyOverview` + screen | ✅ | Hours estimated until s17 |
| Small works list | `SmallWorksListScreen` | ✅ | |
| Operatives roster | `OperativesListScreen` | ✅ | |
| Managers roster | `ManagersListScreen` | ✅ | Admins excluded from this list |
| Weekly report generate | `WeeklyReportScreen` | ✅ | HTML export |

**Deviations and why:** Daily overview OT uses 8h estimates until PayrollHoursEngine. Book labour opens `/dashboard/schedule`. Weekly report HTML rather than xlsx/pdf binaries. Create/edit project hub tiles later (s16).

**Blocked / needs Farnie:** Q11 test org for write tests. No iOS screenshots in `docs/ios-parity/screenshots/` (Q12).

**Questions:** none new.

**Next step:** Farnie’s check of Daily overview + these four screens on the live org; then Manage Users / Add User or project tiles.
