export function feedbackWriteError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Could not save'
  if (/permission|insufficient/i.test(message)) {
    return 'Missing or insufficient permissions. The shared Ideas board needs the latest firestore.rules published so every organisation can read and submit.'
  }
  return message
}
