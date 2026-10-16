import { InterestAdminUnavailable } from '@/lib/interest/adminStore'
import { markInterestRegistrationsUnsubscribed } from '@/lib/interest/repository'
import { writeEmailSuppression } from '@/lib/interest/suppressionStore'
import type { InterestUnsubscribeClaims } from '@/lib/interest/unsubscribeToken'

export async function applyInterestUnsubscribe(claims: InterestUnsubscribeClaims): Promise<void> {
  await writeEmailSuppression({
    email: claims.email,
    source: 'interest',
    tokenId: claims.tokenId,
  })
  try {
    await markInterestRegistrationsUnsubscribed(claims.email)
  } catch (error) {
    if (!(error instanceof InterestAdminUnavailable)) throw error
  }
}
