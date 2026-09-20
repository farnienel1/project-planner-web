## ⏸ STOP GATE: Phase 3 job tiles + Switch organisation
**Done:**
- Switch organisation is on Settings → Personal (and account nav), with iOS copy, Trial/Locked/Active tags, and iOS membership queries.
- Job tiles Materials, View, My Tasks, H&S, Site Audit, Location rebuilt for projects and small works.
- Small-works Location now writes to `smallWorks`. Record loader no longer flashes “Record not found” while auth is still loading.
- Hub tiles are role-gated like iOS (no View/Scheduling for operatives).
- Materials send writes `Quote`/`Order` and updates line `status` / `lastSentAt`.

**Files created/changed:** specs `16-job-tiles.md`, `26-switch-organisation.md`; Settings + change-organisation page; six job-tile sections and routes; membership trial policy.

**Evidence coverage:** SwitchOrganisationView, SettingsView Personal row, FirebaseBackend+OrganizationMembership, OrganizationMembershipSupport, ProjectDetailView (View/Tasks/Location), MaterialsView + AdminManagerMaterialsView, ProjectHealthSafetyView hub, SiteAudit per-job list. H&S nested editors and material email HTML not fully ported.

**Parity table:**
| iOS element | Web | Status |
|---|---|---|
| Settings Personal “Switch organisation” | SettingsScreen | ✅ |
| Switch organisation list + tags | `/dashboard/change-organisation` | ✅ |
| Materials week/day + send status | ProjectMaterialsSection | ✅ (email HTML follow-up) |
| View hide lists | ProjectVisibilityPage | ✅ |
| Job My Tasks scopes | ProjectTasksSection | ✅ |
| H&S hub tabs | ProjectHealthSafetySection | ⚠️ nested issue/sign flows already existed |
| Site Audit per-job list | ProjectSiteAuditSection | ✅ |
| Site Location map + Apple/Google | ProjectLocationPage | ✅ |
| Deadlines / Active users | — | ❌ out of this round |

**Deviations and why:** Web-only “Set up a new organisation” kept below the iOS list. Material quote/order emails still not sent through the Cloud Function (status + history now persist). Home Tasks hub not rebuilt.

**Blocked / needs Farnie:** Q11 test org for live write tests. Material email send if you want wholesaler mail from web this round.

**Questions:**
Q12. Materials send on iOS emails wholesaler contacts via `sendProjectPlannerEmail`. Web now records the send and updates line status, but does not yet send that email. Should the next round wire the same Cloud Function + HTML builder?
Recommendation: yes.

**Suggestions (not built):** Deadlines and Active users tiles; Home Tasks hub; full H&S issue/sign polish.

**Next step:** Farnie verifies Switch organisation + the six job tiles on a project and a small work, then pick the next Phase 3 section.
