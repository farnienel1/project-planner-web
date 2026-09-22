export function feedbackWriteError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Could not save'
  if (/permission|insufficient/i.test(message)) {
    return 'Could not save this feedback. Stay signed in and try again.'
  }
  return message
}
