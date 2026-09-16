/**
 * iOS parity source: FirebaseBackend.swift save/load dictionaries
 * Spec: docs/ios-parity/01-data-model.md
 */

import { z } from 'zod'
import {
  BOOKING_STATUSES,
  DEADLINE_STATUSES,
  EMPLOYMENT_TYPES,
  HOLIDAY_STATUSES,
  HOLIDAY_TIME_SLOTS,
  JOB_TYPES,
  MANAGER_LOCATION_TYPES,
  MANAGER_TIME_SLOTS,
  MATERIAL_LENGTH_UNITS,
  MATERIAL_REQUEST_TYPES,
  MATERIAL_STATUSES,
  MATERIAL_UNITS,
  SITE_AUDIT_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TIME_SLOTS,
  USER_ROLES,
} from './enums'

export const userRoleSchema = z.enum(USER_ROLES)
export const employmentTypeSchema = z.enum(EMPLOYMENT_TYPES)
export const bookingStatusSchema = z.enum(BOOKING_STATUSES)
export const timeSlotSchema = z.enum(TIME_SLOTS)
export const managerTimeSlotSchema = z.enum(MANAGER_TIME_SLOTS)
export const managerLocationTypeSchema = z.enum(MANAGER_LOCATION_TYPES)
export const holidayStatusSchema = z.enum(HOLIDAY_STATUSES)
export const holidayTimeSlotSchema = z.enum(HOLIDAY_TIME_SLOTS)
export const taskPrioritySchema = z.enum(TASK_PRIORITIES)
export const taskStatusSchema = z.enum(TASK_STATUSES)
export const jobTypeSchema = z.enum(JOB_TYPES)
export const materialUnitSchema = z.enum(MATERIAL_UNITS)
export const materialLengthUnitSchema = z.enum(MATERIAL_LENGTH_UNITS)
export const materialStatusSchema = z.enum(MATERIAL_STATUSES)
export const materialRequestTypeSchema = z.enum(MATERIAL_REQUEST_TYPES)
export const siteAuditTypeSchema = z.enum(SITE_AUDIT_TYPES)
export const deadlineStatusSchema = z.enum(DEADLINE_STATUSES)

export const userPermissionsSchema = z.object({
  adminAccess: z.boolean(),
  manager: z.boolean(),
  operatives: z.boolean(),
  skills: z.literal(false),
  qualifications: z.boolean(),
  materials: z.boolean(),
  projects: z.boolean(),
  smallWorks: z.boolean(),
  operativeMode: z.boolean(),
  annualLeaveSelfBook: z.boolean(),
  weeklyReports: z.boolean(),
  dailyOverview: z.boolean(),
  subContractors: z.boolean(),
  siteAudit: z.boolean(),
  wholesalersOrderHistory: z.boolean(),
})

export const bookingWriteSchema = z.object({
  id: z.string().min(1),
  operativeId: z.string().min(1),
  projectId: z.string().min(1),
  date: z.date(),
  timeSlot: timeSlotSchema,
  bookedBy: z.string().min(1),
  notes: z.string(),
  status: bookingStatusSchema,
  workStartTime: z.string().optional(),
  workEndTime: z.string().optional(),
  isBreakRemoved: z.boolean(),
  otMultiplierOverride: z.number().optional(),
  bookingGroupId: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const managerSiteBookingWriteSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  date: z.date(),
  organizationId: z.string().min(1),
  timeSlot: managerTimeSlotSchema,
  locationType: managerLocationTypeSchema,
  locationId: z.string().optional(),
  customLocationName: z.string().optional(),
  workStartTime: z.string().optional(),
  workEndTime: z.string().optional(),
  isBreakRemoved: z.boolean(),
  bookingGroupId: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const projectWriteSchema = z.object({
  id: z.string().min(1),
  jobNumber: z.string(),
  siteName: z.string().min(1),
  addressLine1: z.string(),
  addressLine2: z.string(),
  townCity: z.string(),
  postcode: z.string(),
  siteAddress: z.string(),
  client: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    phone: z.string(),
  }),
  startDate: z.date(),
  endDate: z.date(),
  jobType: z.string().min(1),
  customJobType: z.string().optional(),
  manager: z.string().min(1),
  managerId: z.string().optional(),
  managerIds: z.array(z.string()).optional(),
  isLive: z.boolean(),
  description: z.string(),
  hiddenManagerUserIds: z.array(z.string()),
  hiddenOperativeUserIds: z.array(z.string()),
  usesMapPinForLocation: z.boolean(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  organizationId: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const clientWriteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  contactPerson: z.string(),
  email: z.string(),
  phone: z.string(),
  address: z.string(),
  organizationId: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const operativeWriteSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  startDate: z.date(),
  skills: z.array(z.unknown()),
  qualifications: z.array(z.unknown()),
  isActive: z.boolean(),
  hourlyRate: z.number(),
  dayRate: z.number(),
  currencySymbol: z.string(),
  notes: z.string(),
  organizationId: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const taskWriteSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  details: z.string(),
  createdBy: z.string(),
  assignedOperativeId: z.string().optional(),
  assignedManagerId: z.string().optional(),
  assignedOperativeIds: z.array(z.string()).optional(),
  assignedManagerIds: z.array(z.string()).optional(),
  dueDate: z.date(),
  priority: taskPrioritySchema,
  status: taskStatusSchema,
  organizationId: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const holidayWriteSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  userId: z.string().optional(),
  operativeId: z.string().optional(),
  startDate: z.date(),
  endDate: z.date(),
  status: holidayStatusSchema,
  timeSlot: holidayTimeSlotSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const materialWriteSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  material: z.string().min(1),
  quantity: z.number().int(),
  unit: materialUnitSchema,
  addedBy: z.string(),
  addedByUserId: z.string(),
  addedAt: z.date(),
  date: z.date(),
  status: materialStatusSchema,
})

export const notificationWriteSchema = z.object({
  organizationId: z.string().min(1),
  type: z.string().min(1),
  title: z.string(),
  message: z.string(),
  userId: z.string().nullable(),
  relatedId: z.string().nullable(),
  isRead: z.boolean(),
  createdAt: z.date(),
  requiresPermission: z.string().nullable(),
  deepLinkUserId: z.string().nullable(),
  deepLinkWeekStart: z.unknown().nullable(),
})

export const userWriteSchema = z.object({
  email: z.string().min(1),
  organizationId: z.string().min(1),
  role: userRoleSchema,
  firstName: z.string(),
  surname: z.string(),
  isActive: z.boolean(),
  passwordSet: z.boolean(),
  isSuperAdmin: z.boolean(),
  policyAccepted: z.boolean(),
  employmentType: employmentTypeSchema,
  adminAccess: z.boolean(),
  manager: z.boolean(),
  operatives: z.boolean(),
  skills: z.literal(false),
  qualifications: z.boolean(),
  materials: z.boolean(),
  projects: z.boolean(),
  smallWorks: z.boolean(),
  operativeMode: z.boolean(),
  annualLeaveSelfBook: z.boolean(),
  weeklyReports: z.boolean(),
  dailyOverview: z.boolean(),
  subContractors: z.boolean(),
  siteAudit: z.boolean(),
  wholesalersOrderHistory: z.boolean(),
})
