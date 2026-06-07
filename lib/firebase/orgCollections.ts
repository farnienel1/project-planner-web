/**
 * Firestore paths used by the iOS app (`FirebaseBackend.swift`).
 * Path prefix: organizations/{organizationId}/
 */
export const ORG_COLLECTIONS = {
  clients: 'clients',
  projects: 'projects',
  smallWorks: 'smallWorks',
  operatives: 'operatives',
  managers: 'managers',
  skills: 'skills',
  qualifications: 'qualifications',
  bookings: 'bookings',
  /** iOS menu: "Holiday" — not `annualLeave`. */
  holidayBookings: 'holidayBookings',
  siteAudits: 'siteAudits',
  wholesalers: 'wholesalers',
  /** Org material library (iOS Material catalogue). */
  materialCatalogue: 'materialCatalogue',
  /** Per-project material lines (ordering flow). */
  materials: 'materials',
  materialSendRecords: 'materialSendRecords',
  /** Lowercase — matches iOS. */
  subcontractors: 'subcontractors',
  subcontractorBookings: 'subcontractorBookings',
  tasks: 'tasks',
  invitations: 'invitations',
  operativeProfiles: 'operativeProfiles',
  userEmails: 'userEmails',
} as const

export type OrgCollectionKey = keyof typeof ORG_COLLECTIONS

/** iOS stores job types on a settings document, not a collection. */
export const ORG_SETTINGS_JOB_TYPES_DOC = 'jobTypes' as const
