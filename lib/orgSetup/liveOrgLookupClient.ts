import { appCheckRequestHeaders } from '@/lib/security/publicFormClient'
import { parseLiveOrgLookupResponse, type LiveOrgLookupResult } from '@/lib/orgSetup/liveOrgLookup'

export async function requestLiveOrgLookup(
  email: string,
  website = ''
): Promise<{ ok: true; result: LiveOrgLookupResult } | { ok: false; error: string }> {
  try {
    const response = await fetch('/api/org-setup/live-org-lookup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await appCheckRequestHeaders()),
      },
      body: JSON.stringify({ email: email.trim(), website }),
    })
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    if (response.status === 429) {
      return { ok: false, error: data.error || 'Too many attempts. Try again shortly.' }
    }
    if (!response.ok) return { ok: true, result: { hasLiveOrg: false, hasLogin: false } }
    return { ok: true, result: parseLiveOrgLookupResponse(data) }
  } catch {
    return { ok: true, result: { hasLiveOrg: false, hasLogin: false } }
  }
}
