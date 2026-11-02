import { redirect } from 'next/navigation'

/** Roles & permissions are set on each person's profile in Manage users. */
export default function RolesSettingsRedirect() {
  redirect('/dashboard/settings/users')
}
