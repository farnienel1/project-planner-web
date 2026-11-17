'use client'

import { Component, type ReactNode } from 'react'
import { Card, Note, PuButton } from '@/components/ui/page'

/** Shown when one timesheet screen throws (17 Nov): the rest of Timesheets keeps working. */
export const TIMESHEET_SCREEN_ERROR_MESSAGE =
  "This timesheet screen couldn't be shown. Nothing you saved has been lost — try again, or go back to Timesheets."

/**
 * 17 Nov (live bug): a fault in one timesheet screen — the User Timesheets list or one person's sheet — shows a clear
 * message with Try again inside the Timesheets page, instead of taking the whole screen into the dashboard's
 * "Something went wrong on this screen". `resetKey` (the URL's search) clears it when the person opens another list or
 * sheet. Display only: nothing is read or written.
 */
export class TimesheetScreenBoundary extends Component<
  { children: ReactNode; resetKey?: string; onBack?: () => void; backLabel?: string },
  { error: Error | null; key: string | undefined }
> {
  state: { error: Error | null; key: string | undefined } = { error: null, key: this.props.resetKey }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  static getDerivedStateFromProps(
    props: { resetKey?: string },
    state: { error: Error | null; key: string | undefined }
  ) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null
  }

  componentDidCatch(error: Error) {
    console.error('[timesheets] screen failed', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <Card>
        <Note tone="red" role="alert">
          {TIMESHEET_SCREEN_ERROR_MESSAGE}
        </Note>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <PuButton variant="primary" onClick={() => this.setState({ error: null })}>
            Try again
          </PuButton>
          {this.props.onBack ? (
            <PuButton variant="white" onClick={this.props.onBack}>
              {this.props.backLabel || 'Back'}
            </PuButton>
          ) : null}
        </div>
      </Card>
    )
  }
}
