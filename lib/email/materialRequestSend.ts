import {
  EmailBatchUnsupportedError,
  EmailUnconfirmedError,
  sendProjectPlannerEmail,
  sendProjectPlannerEmailBatch,
} from './resendClient'

/**
 * How the material quote / order route hands its rendered emails to the email function (transport only — who may
 * send, to whom and what the email says are decided before this, by the rulebook: `canSendMaterialOrders`,
 * `materialRequestJobCheck`, `materialOrderRecipientCheck`, `materialRequestEmailEnvelope`).
 *
 * One call carries every recipient (`web_rendered_batch`): one cold start, one rate-limit count and one Resend batch.
 * Before, the route made one function call per recipient at the same time, so a send to three wholesalers started up
 * to three instances and three rate-limit transactions on the same document fought each other.
 *
 * If the deployed function does not know `web_rendered_batch` yet (the web deploys before the function), the route
 * falls back to one call per recipient, all at once as before, each with the same request id as before.
 */

export type MaterialRequestMessage = { to: string; subject: string; html: string }

export type MaterialRequestSendOutcome = {
  sent: number
  copies: number
  failed: string[]
  failures: Array<{ email: string; reason: string }>
  messageIds: string[]
  /** 'batch' when one call carried every recipient; 'single' when the older one-call-per-recipient path ran. */
  mode: 'batch' | 'single'
  /** The function could not confirm the send: it may have gone. Say "check your sent items", never "not sent". */
  unconfirmed?: boolean
}

export type MaterialRequestSendDeps = {
  sendBatch: typeof sendProjectPlannerEmailBatch
  sendOne: typeof sendProjectPlannerEmail
  /** Turns a raw failure into the text shown to the user (`clientSafeMessage`). */
  reason: (message: string) => string
  log?: (event: string, details: Record<string, unknown>) => void
}

export const defaultMaterialRequestSendDeps: Omit<MaterialRequestSendDeps, 'reason'> = {
  sendBatch: sendProjectPlannerEmailBatch,
  sendOne: sendProjectPlannerEmail,
}

export async function sendMaterialRequestMessages(
  input: {
    messages: MaterialRequestMessage[]
    senderEmail: string
    replyTo: string
    orgId: string
    idToken: string | null
    requestId: string
  },
  deps: MaterialRequestSendDeps
): Promise<MaterialRequestSendOutcome> {
  const log = deps.log || (() => {})
  const sender = input.senderEmail.trim().toLowerCase()
  try {
    const batch = await deps.sendBatch({
      messages: input.messages,
      replyTo: input.replyTo,
      orgId: input.orgId,
      idToken: input.idToken,
      fromCaller: true,
      ccCaller: true,
      requestId: input.requestId,
    })
    const failedSet = new Set(batch.failed.map((row) => row.toLowerCase()))
    const outcome: MaterialRequestSendOutcome = {
      sent: 0,
      copies: 0,
      failed: [],
      failures: [],
      messageIds: [],
      mode: 'batch',
    }
    for (const message of input.messages) {
      const to = message.to.trim().toLowerCase()
      const result = batch.results.find((row) => row.to === to)
      if (failedSet.has(to) || !result) {
        outcome.failed.push(to)
        outcome.failures.push({ email: to, reason: deps.reason(batch.error || 'The email was not sent') })
        continue
      }
      outcome.sent += 1
      if (result.id) outcome.messageIds.push(result.id)
      // The function CCs the sender on every message (`ccCaller`), so each sent message is also their copy.
      if (result.cc.length > 0) outcome.copies += 1
    }
    log('batch', { sent: outcome.sent, failed: outcome.failed.length })
    return outcome
  } catch (error) {
    if (error instanceof EmailUnconfirmedError) {
      return {
        sent: 0,
        copies: 0,
        failed: [],
        failures: [],
        messageIds: [],
        mode: 'batch',
        unconfirmed: true,
      }
    }
    if (!(error instanceof EmailBatchUnsupportedError)) {
      const message = error instanceof Error ? error.message : String(error)
      // Refused before sending: report every recipient as failed.
      return {
        sent: 0,
        copies: 0,
        failed: input.messages.map((row) => row.to.trim().toLowerCase()),
        failures: input.messages.map((row) => ({ email: row.to.trim().toLowerCase(), reason: deps.reason(message) })),
        messageIds: [],
        mode: 'batch',
      }
    }
    log('batch unsupported, sending one by one', {})
  }

  // Older function deploy: one call per recipient, all at once as before (sequential calls of up to 20 s each could
  // outlast the host's request limit after some had gone). The function should be deployed before the website.
  const outcome: MaterialRequestSendOutcome = { sent: 0, copies: 0, failed: [], failures: [], messageIds: [], mode: 'single' }
  const results = await Promise.all(
    input.messages.map(async (message) => {
      const to = message.to.trim().toLowerCase()
      try {
        const result = await deps.sendOne({
          to,
          subject: message.subject,
          html: message.html,
          replyTo: input.replyTo,
          orgId: input.orgId,
          idToken: input.idToken,
          fromCaller: true,
          ccCaller: true,
          requestId: input.requestId,
        })
        return { message, to, result, error: null as string | null }
      } catch (error) {
        return { message, to, result: null, error: error instanceof Error ? error.message : String(error) }
      }
    })
  )
  for (const { message, to, result, error } of results) {
    if (!result) {
      outcome.failed.push(to)
      outcome.failures.push({ email: to, reason: deps.reason(error || '') })
      continue
    }
    outcome.sent += 1
    outcome.messageIds.push(...result.ids)
    if (result.cc.length > 0) {
      outcome.copies += 1
      continue
    }
    // A function deploy without CC support: the sender's separate copy, as before.
    try {
      await deps.sendOne({
        to: sender,
        subject: `Copy: ${message.subject}`,
        html: message.html,
        replyTo: input.replyTo,
        orgId: input.orgId,
        idToken: input.idToken,
      })
      outcome.copies += 1
    } catch (error) {
      log('sender copy failed', { error: error instanceof Error ? error.message : String(error) })
    }
  }
  return outcome
}
