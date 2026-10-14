import { initializedAppCheck } from '@/lib/firebase/appCheck'
import { ensureFirebaseApp } from '@/lib/firebase/ensureFirebase'

export async function appCheckRequestHeaders(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {}
  try {
    ensureFirebaseApp()
    const appCheck = initializedAppCheck()
    if (!appCheck) return {}
    const { getToken } = await import('firebase/app-check')
    const { token } = await getToken(appCheck, false)
    return token ? { 'X-Firebase-AppCheck': token } : {}
  } catch {
    return {}
  }
}

export async function postPublicForm(
  url: string,
  body: Record<string, unknown>
): Promise<{ ok: true; proceed: boolean; id?: string } | { ok: false; error: string }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await appCheckRequestHeaders()),
    },
    body: JSON.stringify(body),
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string; proceed?: boolean; id?: string; ok?: boolean }
  if (response.status === 429) {
    return { ok: false, error: data.error || 'Too many attempts. Try again shortly.' }
  }
  if (!response.ok) {
    return { ok: false, error: data.error || 'Check the form and try again.' }
  }
  return { ok: true, proceed: data.proceed !== false, id: data.id }
}
