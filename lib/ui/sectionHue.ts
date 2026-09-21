/** Section hues from the v2 prototype. Live nav keeps every destination; this is colour only. */

export type SectionHue =
  | 'proj'
  | 'sw'
  | 'sched'
  | 'daily'
  | 'warn'
  | 'task'
  | 'ts'
  | 'ops'
  | 'rep'
  | 'user'
  | 'leave'
  | 'lib'
  | 'hs'
  | 'red'
  | 'blue'
  | 'green'

export function hueForNavId(id: string): SectionHue {
  switch (id) {
    case 'dashboard_projects':
      return 'proj'
    case 'dashboard_small_works':
      return 'sw'
    case 'dashboard_schedule':
    case 'dashboard_sub_contractors':
      return 'sched'
    case 'dashboard_daily_overview':
    case 'dashboard_job_types':
      return 'daily'
    case 'dashboard_warnings':
      return 'warn'
    case 'dashboard_tasks':
      return 'task'
    case 'dashboard_timesheets':
    case 'dashboard_materials':
      return 'ts'
    case 'dashboard_operatives':
      return 'ops'
    case 'dashboard_weekly_report':
    case 'dashboard_qualifications':
    case 'dashboard_my_qualifications':
      return 'rep'
    case 'dashboard_managers':
    case 'dashboard_add_user':
    case 'dashboard_manage_users':
      return 'user'
    case 'dashboard_annual_leave':
      return 'leave'
    case 'dashboard_site_audit':
    case 'dashboard_site_map':
      return 'hs'
    case 'dashboard_clients':
    case 'dashboard_wholesalers':
    case 'dashboard_settings':
    case 'dashboard_help':
    case 'dashboard_privacy':
    case 'dashboard_reset_password':
    case 'dashboard_change_organisation':
      return 'lib'
    default:
      return 'blue'
  }
}

export function hueForJobType(jobType?: string): SectionHue {
  const value = (jobType || '').toLowerCase()
  if (value.includes('small')) return 'sw'
  if (value.includes('cat a')) return 'task'
  if (value.includes('cat b')) return 'daily'
  if (value.includes('new build')) return 'proj'
  if (value.includes('maintenance')) return 'sw'
  if (value.includes('decarbon')) return 'hs'
  return 'proj'
}

export function hueForCreateId(id: string): SectionHue {
  switch (id) {
    case 'project':
      return 'proj'
    case 'small-works':
      return 'sw'
    case 'user':
      return 'user'
    case 'client':
      return 'blue'
    case 'qualification':
      return 'rep'
    case 'job-type':
      return 'daily'
    case 'sub-contractor':
      return 'sched'
    case 'wholesaler':
      return 'sw'
    case 'material':
      return 'ts'
    default:
      return 'blue'
  }
}

