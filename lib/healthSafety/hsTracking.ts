import type { HSToolboxIssue, HSToolboxSignature, HSToolboxTalk } from '@/types'

export function issueSignatures(signatures: HSToolboxSignature[], issueId: string): HSToolboxSignature[] {
  return signatures.filter((signature) => signature.issueId === issueId)
}

export function signedPercent(signatures: HSToolboxSignature[], recipientCount = 0): {
  signed: number
  total: number
  percent: number
} {
  const signed = signatures.filter((signature) => signature.status === 'signed').length
  const total = Math.max(signatures.length, recipientCount, 0)
  const percent = total === 0 ? 0 : Math.round((signed / total) * 100)
  return { signed, total, percent }
}

function talkMatchesId(talk: HSToolboxTalk, talkId: string): boolean {
  const id = talkId.trim().toLowerCase()
  if (!id) return false
  return talk.id.toLowerCase() === id || (talk.referenceCode || '').trim().toLowerCase() === id
}

export function findTalkForIssue(
  issue: Pick<HSToolboxIssue, 'talkId'>,
  libraryTalks: HSToolboxTalk[],
  projectTalks: HSToolboxTalk[]
): HSToolboxTalk | undefined {
  return (
    libraryTalks.find((talk) => talkMatchesId(talk, issue.talkId)) ||
    projectTalks.find((talk) => talkMatchesId(talk, issue.talkId))
  )
}

/** Pending signatures for issued (not scheduled) talks on this job — shared tracking count for iOS + web. */
export function trackingAwaitingCount(
  issues: HSToolboxIssue[],
  signatures: HSToolboxSignature[],
  now = Date.now()
): number {
  const activeIds = new Set(
    issues
      .filter((issue) => !issue.publishAt || issue.publishAt.getTime() <= now)
      .map((issue) => issue.id)
  )
  return signatures.filter((signature) => activeIds.has(signature.issueId) && signature.status !== 'signed').length
}

export function pendingSignatureForUser(
  signatures: HSToolboxSignature[],
  userId: string | undefined
): HSToolboxSignature | undefined {
  if (!userId) return undefined
  return signatures.find((signature) => signature.userId === userId && signature.status !== 'signed')
}

export function signedSignatureForUser(
  signatures: HSToolboxSignature[],
  userId: string | undefined
): HSToolboxSignature | undefined {
  if (!userId) return undefined
  return signatures.find((signature) => signature.userId === userId && signature.status === 'signed')
}

export function talkDownloadName(talk: Pick<HSToolboxTalk, 'id' | 'referenceCode' | 'title'>): string {
  const ref = talk.referenceCode || talk.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || talk.id
  return `ToolboxTalk-${ref}`
}
