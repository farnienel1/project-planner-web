'use client'

import { Modal } from '@/components/ui/overlays'
import { Button } from '@/components/ui/Button'
import { BOOKING_DELETED_NOTICE_TITLE, useBookingDeleteNoticeStore } from '@/lib/bookings/signedTimesheetDeleteNotice'

/**
 * Rulebook 1.33.0 §2: shown once after a booking delete that went through on a day of a signed or exported timesheet
 * (`bookingDeleteSignedTimesheetWarning`). Mounted once in the app shell, so every way a booking is deleted shows it,
 * as the iOS `OfflineStatusBanner` alert does ("Booking deleted", the warning, OK).
 */
export function BookingDeleteNotice() {
  const message = useBookingDeleteNoticeStore((s) => s.message)
  const clear = useBookingDeleteNoticeStore((s) => s.clear)
  return (
    <Modal
      open={message != null}
      title={BOOKING_DELETED_NOTICE_TITLE}
      onClose={clear}
      footer={
        <Button variant="primary" onClick={clear}>
          OK
        </Button>
      }
    >
      <p className="pb-2 text-sm" role="status">
        {message}
      </p>
    </Modal>
  )
}
