import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { parseTalk } from '@/lib/healthSafety/parseHealthSafety'
import type { HSToolboxTalk } from '@/types'

const PLATFORM_DOC_IDS = ['toolboxTalkLibrary', 'toolboxLibrary', 'healthSafetyLibrary'] as const

function parseTalkList(raw: unknown): HSToolboxTalk[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => parseTalk(row as Record<string, unknown>))
    .filter((talk): talk is HSToolboxTalk => talk !== null)
}

/** Master toolbox talks shipped in platformConfig — shared by iOS and web. */
export async function loadPlatformToolboxLibrary(): Promise<HSToolboxTalk[]> {
  for (const docId of PLATFORM_DOC_IDS) {
    try {
      const snap = await getDoc(doc(db, 'platformConfig', docId))
      if (!snap.exists()) continue
      const data = snap.data()
      const talks = parseTalkList(data.talks ?? data.toolboxTalks ?? data.items)
      if (talks.length > 0) {
        return talks.map((talk) => ({
          ...talk,
          source: talk.source || 'library',
          status: talk.status || 'approved',
        }))
      }
    } catch {
      // Try next doc id.
    }
  }
  return []
}

export function mergeToolboxTalkLibraries(
  platformTalks: HSToolboxTalk[],
  projectTalks: HSToolboxTalk[]
): HSToolboxTalk[] {
  const merged = new Map<string, HSToolboxTalk>()
  for (const talk of platformTalks) {
    merged.set(talk.referenceCode || talk.id, talk)
  }
  for (const talk of projectTalks) {
    merged.set(talk.referenceCode || talk.id, talk)
  }
  return Array.from(merged.values()).sort((a, b) => a.title.localeCompare(b.title))
}
