'use client'

import { useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { EmptyState, LoadingSpinner, PageHeader } from '@/components/dashboard/PageShell'

export default function MyQualificationsPage() {
  const { organization, user } = useAuthStore()
  const { operatives, qualifications, loading, loadOperatives, loadQualifications } = useOperativeStore()

  useEffect(() => {
    if (organization?.id) {
      loadOperatives(organization.id)
      loadQualifications(organization.id)
    }
  }, [organization, loadOperatives, loadQualifications])

  const myOperative = useMemo(
    () => operatives.find((op) => op.email.toLowerCase() === user?.email.toLowerCase()),
    [operatives, user]
  )

  const myQualifications = useMemo(() => {
    if (!myOperative) return []
    return myOperative.qualifications.map((qual) => {
      const id = typeof qual === 'string' ? qual : qual.id
      const orgQual = qualifications.find((q) => q.id === id)
      const expiry = myOperative.qualificationExpiryDates?.[id]
      const certificateURL = myOperative.qualificationCertificateURLs?.[id]
      return {
        id,
        name: orgQual?.name || (typeof qual === 'object' ? qual.name : id),
        expiry,
        certificateURL,
      }
    })
  }, [myOperative, qualifications])

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <PageHeader
        title="My qualifications"
        description="Read-only view of your assigned qualifications — matches iOS operative My qualifications surface."
        meta={myOperative ? `Profile linked to ${myOperative.firstName} ${myOperative.lastName}` : 'No operative profile linked to your email yet'}
      />

      {!myOperative ? (
        <EmptyState
          title="No operative profile found"
          description="Your login email must match an operative record in Firebase to show qualifications here."
        />
      ) : myQualifications.length === 0 ? (
        <EmptyState title="No qualifications assigned" description="Qualifications assigned in Manage Users or on iOS will appear here." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {myQualifications.map((qual) => {
            const expiringSoon =
              qual.expiry &&
              qual.expiry.getTime() >= Date.now() &&
              qual.expiry.getTime() <= Date.now() + 30 * 24 * 60 * 60 * 1000
            const expired = qual.expiry && qual.expiry.getTime() < Date.now()
            return (
              <div key={qual.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900">{qual.name}</h3>
                {qual.expiry ? (
                  <p className={`mt-2 text-sm ${expired ? 'text-red-600' : expiringSoon ? 'text-amber-600' : 'text-slate-600'}`}>
                    Expires {format(qual.expiry, 'd MMM yyyy')}
                    {expired && ' · Expired'}
                    {expiringSoon && !expired && ' · Expiring soon'}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No expiry date</p>
                )}
                {qual.certificateURL && (
                  <a href={qual.certificateURL} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
                    View certificate
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
