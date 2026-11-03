'use strict'

/**
 * Rulebook 1.12.0 (§13, §16, H4): a row is pushed only to a member of the row's organisation whom that organisation
 * has not deactivated — the packed rulebook's `organizationMemberActive`, the same test the security rules apply when
 * the row is written. A row addressed to anyone else (a uid from another company, a deactivated person) is not pushed.
 */
function recipientMayReceivePush(canonical, input) {
  if (!canonical || typeof canonical.organizationMemberActive !== 'function') return false
  const result = canonical.organizationMemberActive({
    organizationId: input.orgId,
    userId: input.userId,
    organization: input.organization || null,
    user: input.user || null,
    membership: input.membership || null,
  })
  return Boolean(result && result.member && result.active)
}

module.exports = { recipientMayReceivePush }
