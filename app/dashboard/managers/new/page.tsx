import { redirect } from 'next/navigation'

/** iOS ManagersView has no create-manager action — staff are invited from Manage users. */
export default function NewManagerRedirectPage() {
  redirect('/dashboard/managers')
}
