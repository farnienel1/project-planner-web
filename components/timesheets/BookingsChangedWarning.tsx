'use client'

/**
 * Rulebook 1.47.0 §8 (owner UI, 15 Nov): the small yellow warning triangle shown next to "My timesheets" and next to a
 * changed timesheet's row. Clicking (or Enter / Space) opens a small popup with the owner's exact words
 * (`SIGNED_TIMESHEET_CHANGED_MESSAGE`). The label and the text come from the rulebook.
 */
import { useState } from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import { Modal } from '@/components/ui/overlays'
import { Button } from '@/components/ui/Button'
import { SIGNED_TIMESHEET_CHANGED_LABEL, SIGNED_TIMESHEET_CHANGED_MESSAGE } from '@/lib/canonical'

export function BookingsChangedWarning({ message = SIGNED_TIMESHEET_CHANGED_MESSAGE }: { message?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label={SIGNED_TIMESHEET_CHANGED_LABEL}
        title={SIGNED_TIMESHEET_CHANGED_LABEL}
        aria-haspopup="dialog"
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
        onKeyDown={(event) => event.stopPropagation()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          padding: 0,
          border: 0,
          borderRadius: 8,
          background: 'transparent',
          color: 'var(--pu-amber, var(--warn))',
          cursor: 'pointer',
          verticalAlign: 'middle',
        }}
      >
        <ExclamationTriangleIcon aria-hidden width={20} height={20} />
      </button>
      <Modal
        open={open}
        title={SIGNED_TIMESHEET_CHANGED_LABEL}
        hue="warn"
        icon={<ExclamationTriangleIcon aria-hidden />}
        onClose={() => setOpen(false)}
        footer={
          <Button variant="primary" onClick={() => setOpen(false)}>
            OK
          </Button>
        }
      >
        <p style={{ margin: '4px 0 8px' }}>{message}</p>
      </Modal>
    </>
  )
}
