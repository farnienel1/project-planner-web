import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { parseTalk } from '@/lib/healthSafety/parseHealthSafety'
import { overlayToolboxLibraries } from '@/lib/healthSafety/hsTalks'
import { mergeToolboxTalks } from '@/lib/healthSafety/mergeToolboxTalks'
import seedTalks from '@/lib/healthSafety/toolboxTalkSeed.json'
import type { HSToolboxTalk } from '@/types'

const PLATFORM_DOC_IDS = ['toolboxTalkLibrary', 'toolboxLibrary', 'healthSafetyLibrary'] as const
const SEED_UPDATED_AT = new Date('2026-09-22T00:00:00.000Z')

function parseTalkList(raw: unknown): HSToolboxTalk[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => parseTalk(row as Record<string, unknown>))
    .filter((talk): talk is HSToolboxTalk => talk !== null)
}

function withLibraryDefaults(talk: HSToolboxTalk): HSToolboxTalk {
  return {
    ...talk,
    source: talk.source || 'library',
    status: talk.status || 'approved',
    updatedAt: talk.updatedAt || SEED_UPDATED_AT,
  }
}

/** Bundled iOS master library (568 talks). Firestore extras overlay on top. */
export function bundledToolboxTalks(): HSToolboxTalk[] {
  return parseTalkList(seedTalks).map(withLibraryDefaults)
}

let cachedLibrary: Promise<HSToolboxTalk[]> | null = null

/** Master toolbox talks — bundled seed first, then any extra talks from platformConfig. */
export async function loadPlatformToolboxLibrary(): Promise<HSToolboxTalk[]> {
  if (!cachedLibrary) cachedLibrary = loadPlatformToolboxLibraryUncached()
  return cachedLibrary
}

async function loadPlatformToolboxLibraryUncached(): Promise<HSToolboxTalk[]> {
  const seed = bundledToolboxTalks()
  if (!db) return seed
  for (const docId of PLATFORM_DOC_IDS) {
    try {
      const snap = await getDoc(doc(db, 'platformConfig', docId))
      if (!snap.exists()) continue
      const data = snap.data()
      const talks = parseTalkList(data.talks ?? data.toolboxTalks ?? data.items).map(withLibraryDefaults)
      if (talks.length > 0) return overlayToolboxLibraries(seed, talks)
    } catch {
      // Try next doc id.
    }
  }
  return seed
}

/** Catalogue titles win. Placeholder stored rows ("TBT", bare TBT- codes) are left out. */
export function mergeToolboxTalkLibraries(
  platformTalks: HSToolboxTalk[],
  projectTalks: HSToolboxTalk[]
): HSToolboxTalk[] {
  return mergeToolboxTalks(bundledToolboxTalks(), platformTalks, projectTalks)
}
