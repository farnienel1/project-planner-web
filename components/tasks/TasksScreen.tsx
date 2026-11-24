'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import {
  getPendingHolidayApprovalsForUser,
  isCancellationRequest,
} from '@/lib/annualLeave/holidayApprovalUtils'
import { resolvePersonName } from '@/lib/annualLeave/annualLeavePerson'
import {
  holidayDecisionActorName,
  notifyHolidayRequestDecisionToUser,
} from '@/lib/annualLeave/notifyHolidayRequestDecision'
import { hasAdminAccess } from '@/lib/navigation/menuPermissions'
import type { HolidayBooking } from '@/types'
import { TaskList } from '@/components/tasks/upgrade/TaskList'
import { feedback } from '@/lib/feedbackSounds/feedback'
import { afterPrimaryWrite } from '@/lib/client/afterPrimaryWrite'

function formatDateRange(start: Date, end: Date, timeSlot: string): string {
  const sameDay = start.toDateString() === end.toDateString()
  const startLabel = format(start, 'd MMM yyyy')
  const endLabel = format(end, 'd MMM yyyy')
  const slot = timeSlot === 'FULL DAY' ? 'Full day' : timeSlot
  return sameDay ? `${startLabel} · ${slot}` : `${startLabel} – ${endLabel} · ${slot}`
}

function HolidayApprovalCard({
  request,
  requesterName,
  onApprove,
  onDecline,
  busy,
}: {
  request: HolidayBooking
  requesterName: string
  onApprove: () => void
  onDecline: () => void
  busy: boolean
}) {
  const isCancellation = isCancellationRequest(request)

  return (
    <div className="card pad" data-hue="leave">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            {isCancellation ? 'Annual leave cancellation request' : 'Annual leave request'}
          </p>
          <p className="mt-0.5 text-sm font-medium">{requesterName}</p>
          <p className="mt-0.5 muted small">{formatDateRange(request.startDate, request.endDate, request.timeSlot)}</p>
          <span className="pill" data-hue="warn" style={{ marginTop: 8 }}>
            {isCancellation ? 'Cancellation pending' : 'Pending approval'}
          </span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onApprove}
          className="btn hue"
          data-hue="green"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDecline}
          className="btn danger"
        >
          Decline
        </button>
      </div>
    </div>
  )
}

export function TasksScreen() {
  const { user, organization } = useAuthStore()
  const { bookings, saveBooking, deleteBooking, decideBooking } = useHolidayStore()
  const { operatives } = useOperativeStore()
  const { users } = useOrgUserStore()
  const [actionId, setActionId] = useState<string | null>(null)

  // The Approvals count on the old page was these leave approvals (rulebook §9 `leaveDecisionQueue` through
  // `getPendingHolidayApprovalsForUser`); kept exactly, now a tab shown only while it has items (owner pack F5).
  const pendingApprovals = useMemo(
    () => getPendingHolidayApprovalsForUser(bookings, user, users, operatives),
    [bookings, user, users, operatives]
  )

  const approveHoliday = async (request: HolidayBooking) => {
    if (!organization?.id || !user) return
    setActionId(request.id)
    let saved = false
    try {
      if (isCancellationRequest(request)) {
        await deleteBooking(organization.id, request.id)
        saved = true
        // The approver's decision: accepting a request or a cancellation request is leaveApproved, played once it is
        // saved (before the notice).
        feedback('leaveApproved')
        // Rulebook §9 / 1.9.0: the requester hears the cancellation was accepted (`holidayDecisionRecipients`).
        afterPrimaryWrite('notifyHolidayRequestDecisionToUser', notifyHolidayRequestDecisionToUser({
          organizationId: organization.id,
          booking: request,
          approved: true,
          cancellation: true,
          decidedByName: holidayDecisionActorName(user),
          decidedByUserId: user?.id ?? null,
          users,
          operatives,
        }))
      } else {
        await decideBooking(organization.id, request, { status: 'approved', approverUid: user.id })
        saved = true
        feedback('leaveApproved')
        afterPrimaryWrite('notifyHolidayRequestDecisionToUser', notifyHolidayRequestDecisionToUser({
          organizationId: organization.id,
          booking: request,
          approved: true,
          decidedByName: holidayDecisionActorName(user),
          decidedByUserId: user?.id ?? null,
          users,
          operatives,
        }))
      }
    } catch (error) {
      // Owner decision 8: the refusal sound, then the error goes where it went before. Once the decision is saved a
      // failed notice plays nothing more (one sound per action).
      if (!saved) feedback('actionRefused')
      throw error
    } finally {
      setActionId(null)
    }
  }

  const declineHoliday = async (request: HolidayBooking) => {
    if (!organization?.id || !user) return
    setActionId(request.id)
    let saved = false
    try {
      if (isCancellationRequest(request)) {
        await saveBooking(organization.id, {
          ...request,
          cancellationRequestedAt: undefined,
          cancellationRequestedByUserId: undefined,
          updatedAt: new Date(),
        })
        saved = true
        // The approver's decision: declining a request or a cancellation request is leaveDeclined, played once it is
        // saved (before the notice).
        feedback('leaveDeclined')
        afterPrimaryWrite('notifyHolidayRequestDecisionToUser', notifyHolidayRequestDecisionToUser({
          organizationId: organization.id,
          booking: request,
          approved: false,
          cancellation: true,
          decidedByName: holidayDecisionActorName(user),
          decidedByUserId: user?.id ?? null,
          users,
          operatives,
        }))
      } else {
        await decideBooking(organization.id, request, { status: 'rejected', approverUid: user.id })
        saved = true
        feedback('leaveDeclined')
        afterPrimaryWrite('notifyHolidayRequestDecisionToUser', notifyHolidayRequestDecisionToUser({
          organizationId: organization.id,
          booking: request,
          approved: false,
          decidedByName: holidayDecisionActorName(user),
          decidedByUserId: user?.id ?? null,
          users,
          operatives,
        }))
      }
    } catch (error) {
      // Owner decision 8: the refusal sound, then the error goes where it went before. Once the decision is saved a
      // failed notice plays nothing more (one sound per action).
      if (!saved) feedback('actionRefused')
      throw error
    } finally {
      setActionId(null)
    }
  }

  const approvalsContent = (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="h2">Annual leave approvals</h2>
        {(hasAdminAccess(user) || user?.permissions.manager) && (
          <Link href="/dashboard/annual-leave/operatives" className="link">
            Manage all leave
          </Link>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {pendingApprovals.map((request) => (
          <HolidayApprovalCard
            key={request.id}
            request={request}
            requesterName={resolvePersonName(request, users, operatives)}
            onApprove={() => approveHoliday(request)}
            onDecline={() => declineHoliday(request)}
            busy={actionId === request.id}
          />
        ))}
      </div>
    </section>
  )

  return <TaskList mode="main" approvals={{ count: pendingApprovals.length, content: approvalsContent }} />
}
