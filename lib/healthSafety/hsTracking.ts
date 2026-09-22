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

export function findTalkForIssue(
  issue: Pick<HSToolboxIssue, 'talkId'>,
  libraryTalks: HSToolboxTalk[],
  projectTalks: HSToolboxTalk[]
): HSToolboxTalk | undefined {
  return libraryTalks.find((talk) => talk.id === issue.talkId) || projectTalks.find((talk) => talk.id === issue.talkId)
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
