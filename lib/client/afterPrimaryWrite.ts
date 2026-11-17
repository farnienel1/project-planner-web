/**
 * A secondary write (an inbox notice, a clean-up) that runs after a save's main write and must never hold the screen
 * (owner bug 17 Nov: saves stuck on "Saving…"). A Firestore write's promise settles only when the server answers, so
 * awaiting a best-effort notice left the busy flag on whenever that answer was slow or never came. The work is started
 * and not awaited; a failure is logged (the notice is best-effort, as on iOS) and never thrown.
 */
export function afterPrimaryWrite(label: string, work: Promise<unknown>, onError?: (error: unknown) => void): void {
  void Promise.resolve(work).catch((error: unknown) => {
    if (onError) {
      try {
        onError(error)
      } catch {
        // A failing handler never surfaces as an unhandled rejection.
      }
    } else if (process.env.NODE_ENV !== 'production') {
      console.warn(`[afterPrimaryWrite] ${label} failed`, error)
    }
  })
}
