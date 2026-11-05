/**
 * Signed in to Auth, but users/{uid} is missing — typical after an org delete left the login, or an invitee who signed in
 * before finishing setup (rulebook 1.31.1, F5: an account is created only from the emailed invitation link).
 */
export const MISSING_USER_PROFILE_MESSAGE =
  'Your sign-in exists but your Project Planner profile does not. If you were invited, open the invitation email and finish setting up your account from its link. Otherwise set up an organisation, or ask an admin to invite you again.'

export const MISSING_USER_PROFILE_SETUP_HREF = '/setup'
