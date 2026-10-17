/** Signed in to Auth, but users/{uid} is missing — typical after an org delete left the login. */
export const MISSING_USER_PROFILE_MESSAGE =
  'Your account was created but the user profile is not in Firestore yet. Set up an organisation, or ask an admin to invite you again.'

export const MISSING_USER_PROFILE_SETUP_HREF = '/setup'
