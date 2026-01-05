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
  jobType: JobType;
  customJobType?: string;
  manager: ManagerLegacy;
  managerId?: string;
  isLive: boolean;
  description?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  organizationId?: string;
}

export interface Client {
  id: string;
  name: string;
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
  createdAt: Date;
  updatedAt: Date;
  organizationId?: string;
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
  permissions: UserPermissions;
  policyAccepted: boolean;
  policyAcceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPermissions {
  adminAccess: boolean;
  operatives: boolean;
  skills: boolean;
  qualifications: boolean;
  projects: boolean;
  smallWorks: boolean;
}

export interface Organization {
  id: string;
  name: string;
  members: Record<string, string>;
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export enum JobType {
  PROJECT = 'project',
  SMALL_WORK = 'smallWork',
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
