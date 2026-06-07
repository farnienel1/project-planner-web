'use client'

import { PageHeader } from '@/components/dashboard/PageShell'
import { FormBackLink } from '@/components/forms/FormShell'
import { InviteUserForm } from '@/components/users/InviteUserForm'

export default function AddUserPage() {
  return (
    <div className="space-y-6">
      <FormBackLink href="/dashboard/settings/users" label="Back to manage users" />
      <PageHeader
        title="Add user"
        description="Invite users with role and permissions."
        meta="Creates invitations, users, and userEmails documents in Firebase (iOS-compatible)."
      />
      <InviteUserForm />
    </div>
  )
}
