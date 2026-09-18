'use client'

import { useMemo, useState } from 'react'
import { buildConfirmAccountEmailHtml, confirmAccountEmailSubject } from '@/lib/email/confirmAccountEmail'
import { buildInviteSetupEmailHtml, inviteSetupEmailSubject } from '@/lib/email/inviteSetupEmail'

type Kind = 'confirm' | 'invite'

export default function EmailPreviewPage() {
  const [kind, setKind] = useState<Kind>('confirm')

  const preview = useMemo(() => {
    if (kind === 'confirm') {
      return {
        subject: confirmAccountEmailSubject('Acme Construction Ltd'),
        html: buildConfirmAccountEmailHtml({
          to: 'ada@acme.test',
          firstName: 'Ada',
          organizationName: 'Acme Construction Ltd',
          confirmationToken: '00000000-0000-4000-8000-000000000001',
        }),
      }
    }
    return {
      subject: inviteSetupEmailSubject('Acme Construction Ltd'),
      html: buildInviteSetupEmailHtml({
        to: 'morgan@acme.test',
        firstName: 'Morgan',
        organizationName: 'Acme Construction Ltd',
        invitationId: '00000000-0000-4000-8000-000000000002',
        role: 'manager',
      }),
    }
  }, [kind])

  return (
    <div className="min-h-screen bg-[#f4f6f9] px-5 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Project Planner</p>
          <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Email preview</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sample HTML for the founder confirm-account email and the invited-user set-password email. This uses
            dummy names and tokens — it does not send anything.
          </p>
        </header>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setKind('confirm')}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              kind === 'confirm' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Super admin confirm
          </button>
          <button
            type="button"
            onClick={() => setKind('invite')}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              kind === 'invite' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Invited user set password
          </button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</p>
          <p className="mt-1 font-medium text-slate-900">{preview.subject}</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6">
          <div dangerouslySetInnerHTML={{ __html: preview.html }} />
        </div>
      </div>
    </div>
  )
}
