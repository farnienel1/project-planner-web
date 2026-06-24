// Core Types - Mirrored from iOS App

export interface Project {
  id: string;
  jobNumber: string;
  siteName: string;
  addressLine1: string;
  addressLine2?: string;
  townCity: string;
  postcode: string;
  client: Client;
  startDate: Date;
  endDate: Date;
  jobType: string;
  customJobType?: string;
  manager: ManagerLegacy;
  managerId?: string;
  managerIds?: string[];
  usesMapPinForLocation?: boolean;
  hiddenManagerUserIds?: string[];
  hiddenOperativeUserIds?: string[];
  isLive: boolean;
  description?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  /** Legacy single-line address from Firestore when structured fields are missing. */
  siteAddress?: string;
  status?: 'active' | 'upcoming' | 'completed' | string;
  createdAt: Date;
  updatedAt: Date;
  organizationId?: string;
}

export interface Client {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
  organizationId?: string;
}

export interface Operative {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  startDate: Date;
  hourlyRate: number;
  skills: (Skill | string)[];
  qualifications: Qualification[];
  qualificationExpiryDates?: Record<string, Date>;
  qualificationCertificateURLs?: Record<string, string>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  organizationId?: string;
}

export interface Manager {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  mobile?: string;
  department?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  organizationId?: string;
}

export interface ManagerLegacy {
  name: string;
  email: string;
  phone?: string;
}

export interface Booking {
  id: string;
  operativeId: string;
  projectId: string;
  date: Date;
  timeSlot: TimeSlot | string;
  bookedBy: string;
  notes?: string;
  status: BookingStatus | string;
  workStartTime?: string;
  workEndTime?: string;
  createdAt: Date;
  updatedAt: Date;
  organizationId?: string;
  /** Card title for manager site / office bookings (iOS managerSiteBookings). */
  displayTitle?: string;
  /** `manager` = organizations/{orgId}/managerSiteBookings; default operative bookings. */
  source?: 'operative' | 'manager';
}

export interface Qualification {
  id: string;
  name: string;
  hasEndDate: boolean;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Skill {
  id: string;
  name: string;
  /** Trade grouping; matches iOS `organizations/{orgId}/skills.trade`. */
  trade?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  surname: string;
  organizationId: string;
  role: UserRole;
  isActive: boolean;
  passwordSet: boolean;
  isSuperAdmin: boolean;
  mobileNumber?: string;
  permissions: UserPermissions;
  assignedManagerUserId?: string;
  assignedManagerUserIds?: string[];
  dayRate?: number;
  hourlyRate?: number;
  tradeTypePreset?: string;
  tradeTypeCustom?: string;
  employmentType?: string;
  employmentTypeTransitionFrom?: string;
  employmentTypeEffectiveAt?: Date;
  lastSeenAt?: Date;
  profilePhotoURL?: string;
  annualLeaveEnabled?: boolean;
  annualLeaveDaysPerYear?: number;
  annualLeaveYearStartMonth?: number;
  annualLeaveYearEndMonth?: number;
  annualLeaveCarriesOver?: boolean;
  timesheetsEnabled?: boolean;
  vatNumber?: string;
  utrNumber?: string;
  policyAccepted: boolean;
  policyAcceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPermissions {
  adminAccess: boolean;
  manager: boolean;
  operatives: boolean;
  skills: boolean;
  qualifications: boolean;
  materials: boolean;
  projects: boolean;
  smallWorks: boolean;
  operativeMode: boolean;
  siteAudit: boolean;
  subContractors: boolean;
  wholesalersOrderHistory: boolean;
  annualLeaveSelfBook?: boolean;
  weeklyReports?: boolean;
  dailyOverview?: boolean;
}

export type MaterialUnit = 'Number' | 'Box' | 'Length' | 'Drum' | 'Pallet';
export type MaterialLengthUnit = 'M' | 'MM';

export interface MaterialCatalogItem {
  id: string;
  name: string;
  brand: string;
  productCode?: string;
  defaultUnit: MaterialUnit;
  size?: string;
  length?: string;
  lengthUnit?: MaterialLengthUnit;
  category: string;
  createdAt: Date;
  createdByUserId: string;
  createdByName: string;
}

export interface WholesalerContact {
  id: string;
  name: string;
  email: string;
  isPrimary: boolean;
  createdAt: Date;
}

export interface Wholesaler {
  id: string;
  name: string;
  address?: string;
  trade?: string;
  accountNumber?: string;
  primaryContactId?: string;
  contacts: WholesalerContact[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SubcontractorContact {
  id: string;
  name: string;
  email: string;
  contactNumber: string;
  position: string;
  createdAt: Date;
}

export interface Subcontractor {
  id: string;
  name: string;
  subcontractorType: string;
  website?: string;
  address?: string;
  contacts: SubcontractorContact[];
  createdAt: Date;
  updatedAt: Date;
}

export type HolidayStatus = 'pending' | 'approved' | 'rejected';
export type HolidayTimeSlot = 'FULL DAY' | 'AM' | 'PM';

export interface HolidayBooking {
  id: string;
  organizationId: string;
  userId?: string;
  operativeId?: string;
  startDate: Date;
  endDate: Date;
  status: HolidayStatus;
  timeSlot: HolidayTimeSlot;
  approvedByUserId?: string;
  approvedAt?: Date;
  cancellationRequestedAt?: Date;
  cancellationRequestedByUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SiteAuditItem {
  id: string;
  title: string;
  location: string;
  assignee: string;
  comments: string;
  annotations?: string;
  imageURL?: string;
  createdAt: Date;
}

export interface SiteAudit {
  id: string;
  projectId: string;
  projectJobNumber: string;
  projectName: string;
  type: string;
  customTitle?: string;
  authorName: string;
  date: Date;
  createdByUserId: string;
  visibleToOperatives: boolean;
  items: SiteAuditItem[];
  createdAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  companyLogoURL?: string;
  members: Record<string, string>;
  settings: Record<string, any>;
  teamOnboarding?: import('@/lib/orgSetup/teamOnboarding').TeamOnboardingState;
  createdAt: Date;
  updatedAt: Date;
}

/** Common iOS job type raw values from Firestore */
export const DEFAULT_JOB_TYPES = ['CAT A', 'CAT B', 'Small Works', 'Maintenance'] as const

export enum JobType {
  PROJECT = 'CAT A',
  SMALL_WORK = 'Small Works',
}

export type ProjectTaskStatus = 'To Do' | 'In Progress' | 'Completed'
export type ProjectTaskPriority = 'Low' | 'Normal' | 'High' | 'Urgent'

export interface ProjectTask {
  id: string
  organizationId: string
  projectId: string
  title: string
  details?: string
  createdBy: string
  status: ProjectTaskStatus
  priority: ProjectTaskPriority
  assignedOperativeId?: string
  assignedManagerId?: string
  dueDate?: Date
  completedBy?: string
  completedAt?: Date
  completionNotes?: string
  attachedImageURLs?: string[]
  createdAt: Date
  updatedAt: Date
}

export interface MaterialSendRecord {
  id: string
  projectId: string
  requestType: 'quote' | 'order'
  sentAt: Date
  materialsDate?: Date
  sentBy: string
  recipients: { name: string; email: string; wholesalerName?: string }[]
  lines: {
    materialId: string
    name: string
    quantity: number
    unit: string
    brand?: string
    productCode?: string
    lengthDisplay?: string
  }[]
}

export interface ProjectMaterialLine {
  id: string
  quantity: number
  unit: string
  material: string
  addedBy: string
  projectId: string
  date: Date
  status: string
  brand?: string
  productCode?: string
  category?: string
  catalogueItemId?: string
  notes?: string
}

export interface HSToolboxTalk {
  id: string
  title: string
  category: string
  isGeneral: boolean
  trades: string[]
  purpose: string
  keyPoints: string[]
  source: string
  status: string
  version: number
  updatedAt: Date
  fileURL?: string
}

export interface HSToolboxIssue {
  id: string
  projectId: string
  talkId: string
  weekCommencing: Date
  issuedByUserId: string
  issuedAt: Date
  publishAt?: Date
  recipientUserIds: string[]
  status: string
}

export interface HSToolboxSignature {
  id: string
  issueId: string
  userId: string
  status: string
  readConfirmed: boolean
  signatureImageBase64?: string
  signedAt?: Date
  reminderSentAt?: Date
}

export interface HSProjectSafetyData {
  talks: HSToolboxTalk[]
  issues: HSToolboxIssue[]
  signatures: HSToolboxSignature[]
  ramsDocuments: HSRamsDocument[]
  otherDocuments: HSOtherDocument[]
  updatedAt?: Date
}

export interface HSRamsDocument {
  id: string
  title: string
  trade: string
  version: number
  status: string
  uploadedAt: Date
  fileURL?: string
  fileName?: string
}

export interface HSOtherDocument {
  id: string
  title: string
  trade?: string
  category: string
  uploadedAt: Date
  fileURL?: string
  fileName?: string
}

export enum TimeSlot {
  MORNING = 'AM',
  AFTERNOON = 'PM',
  FULL_DAY = 'FULL DAY',
  EVENING = 'Evening',
  OVERTIME = 'Overtime',
}

export enum BookingStatus {
  CONFIRMED = 'confirmed',
  PENDING = 'pending',
  CANCELLED = 'cancelled',
}

export enum UserRole {
  BASIC = 'basic',
  ADMIN = 'admin',
  MANAGER = 'manager',
  OPERATIVE = 'operative',
  VIEWER = 'viewer',
}




