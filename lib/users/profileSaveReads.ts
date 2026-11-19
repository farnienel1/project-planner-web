/**
 * Edit user Save reads first (the stored pay history, the same-email documents, the linked Operatives / Managers rows,
 * the pay profile, the account type plan) and only then hands its batches to Firestore (review of #371). The reads are
 * bounded: when they do not answer in time nothing is written and the screen says so, with Save back.
 */
export const PROFILE_SAVE_READ_TIMEOUT_MS = 20_000

export const PROFILE_SAVE_READ_TIMEOUT_MESSAGE =
  'Could not reach the server to prepare this save, so nothing was saved. Check your connection and try again.'
