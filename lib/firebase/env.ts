/** Client-safe check that Firebase public env vars are present. */
export function isFirebaseConfigured(): boolean {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim()
  return Boolean(apiKey && apiKey !== 'undefined' && apiKey.length > 10)
}

export function getFirebaseConfigError(): string | null {
  if (isFirebaseConfigured()) return null

  return (
    'Firebase is not configured. Create a plain-text .env.local file in the project folder ' +
    '(not .env.local.rtf from TextEdit). Copy .env.example, add the Firebase values from ' +
    'QUICK_START.md, then restart npm run dev.'
  )
}
