import type { HSToolboxTalk } from '@/types'

const PLACEHOLDER_TITLES = new Set([
  'tbt',
  'custom',
  'toolbox talk',
  'untitled talk',
  'untitled',
  'uploaded toolbox talk',
  'custom toolbox talk',
  'uploaded talk',
])

/** iOS ToolboxTalkLibrary.isPlaceholderTitle — bare codes and filler titles are not talks. */
export function isPlaceholderTalkTitle(title: string): boolean {
  const trimmed = title.trim()
  if (!trimmed) return true
  const lower = trimmed.toLowerCase()
  if (PLACEHOLDER_TITLES.has(lower)) return true
  return lower.startsWith('tbt-') && !lower.includes(' ')
}

/** Last path segment of an uploaded file, without the extension. */
export function talkFileNameHint(fileURL?: string): string | null {
  const raw = (fileURL || '').trim()
  if (!raw) return null
  let path = raw.split('?')[0].split('#')[0]
  try {
    path = new URL(raw).pathname
  } catch {
    // Keep the raw path when it is not an absolute URL.
  }
  let decoded = path
  try {
    decoded = decodeURIComponent(path)
  } catch {
    decoded = path
  }
  const last = decoded.split('/').filter(Boolean).pop() || ''
  const name = last
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/\+/g, ' ')
    .replace(/_/g, ' ')
    .replace(/%20/g, ' ')
    .trim()
  return name || null
}

function repairedLibraryTalk(stored: HSToolboxTalk, catalog: HSToolboxTalk): HSToolboxTalk {
  const repaired: HSToolboxTalk = {
    ...stored,
    source: 'library',
    status: stored.status.trim().toLowerCase() === 'draft' ? 'draft' : 'approved',
    title: isPlaceholderTalkTitle(stored.title) ? catalog.title : stored.title,
  }
  const purpose = stored.purpose.trim()
  if (!purpose || isPlaceholderTalkTitle(purpose)) repaired.purpose = catalog.purpose
  if (stored.keyPoints.every((point) => !point.trim())) repaired.keyPoints = catalog.keyPoints
  if (stored.trades.length === 0 && catalog.trades.length > 0) {
    repaired.trades = catalog.trades
    repaired.isGeneral = catalog.isGeneral
    repaired.category = catalog.category
  }
  if (stored.category !== catalog.category && isPlaceholderTalkTitle(stored.title)) {
    repaired.category = catalog.category
    repaired.isGeneral = catalog.isGeneral
  }
  repaired.title = catalog.title
  return repaired
}

function withUploadTitle(talk: HSToolboxTalk): HSToolboxTalk {
  const uploaded: HSToolboxTalk = { ...talk, source: 'uploaded' }
  if (isPlaceholderTalkTitle(uploaded.title)) {
    const hint = talkFileNameHint(uploaded.fileURL)
    if (hint) uploaded.title = hint
  }
  if (isPlaceholderTalkTitle(uploaded.title)) uploaded.title = 'Toolbox talk'
  return uploaded
}

/**
 * iOS ToolboxTalkLibrary.merge. Catalogue ids keep the real talk.
 * Stored rows titled "TBT" or a bare TBT- code are dropped unless they are an upload with a file.
 */
export function mergeToolboxTalks(
  catalog: HSToolboxTalk[],
  platform: HSToolboxTalk[],
  stored: HSToolboxTalk[]
): HSToolboxTalk[] {
  const catalogById = new Map<string, HSToolboxTalk>()
  for (const talk of catalog) catalogById.set(talk.id, talk)

  const byId = new Map<string, HSToolboxTalk>(catalogById)
  for (const talk of platform) {
    if (isPlaceholderTalkTitle(talk.title)) continue
    if (catalogById.has(talk.id)) continue
    byId.set(talk.id, talk)
  }

  const merged: HSToolboxTalk[] = []
  const seen = new Set<string>()
  for (const talk of stored) {
    if (seen.has(talk.id)) continue
    seen.add(talk.id)
    const catalogTalk = catalogById.get(talk.id)
    if (catalogTalk) {
      merged.push(repairedLibraryTalk(talk, catalogTalk))
      byId.delete(talk.id)
      continue
    }
    const fileURL = (talk.fileURL || '').trim()
    if (talk.source === 'uploaded' || fileURL) {
      merged.push(withUploadTitle(talk))
      continue
    }
    if (isPlaceholderTalkTitle(talk.title)) continue
    merged.push(talk)
  }

  const leftovers = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id))
  for (const leftover of leftovers) {
    if (seen.has(leftover.id)) continue
    const catalogTalk = catalogById.get(leftover.id)
    merged.push(catalogTalk ? { ...leftover, title: catalogTalk.title } : leftover)
  }
  return merged
}

export function blankToolboxTalkTemplate(now = new Date()): HSToolboxTalk {
  return {
    id: 'TBT-BLANK',
    referenceCode: 'TBT-BLANK',
    title: 'Toolbox Talk — blank template',
    category: 'general',
    isGeneral: true,
    trades: [],
    purpose: 'Write the purpose of this talk here.',
    keyPoints: ['Key control point 1', 'Key control point 2', 'Key control point 3'],
    source: 'library',
    status: 'draft',
    version: 1,
    updatedAt: now,
  }
}
