/**
 * Owner console headline counts (PLAN §3.2, metric contracts in metricContracts.ts): Firestore `count()` aggregations
 * run with the owner's token on the server, never a download of the collections. Test data (D12: the `isInternal` /
 * `isTest` flags) is counted separately and taken off when "Include test data" is off.
 * Pending invitations are not counted here: the rules let the owner list invitations one organisation at a time
 * only, so that count comes with the Needs you queue (PR 3).
 */
import { PLATFORM_OWNER_SENTINEL_ORG } from '@/lib/platform/owner'
import {
  firestoreCount,
  firestoreGet,
  firestoreRunQuery,
  restAnd,
  restEqual,
  restIn,
  structuredQuery,
} from '@/lib/owner/firestoreRest'

/** The raw aggregation results. Every field is a count of documents. */
export type OwnerCountParts = {
  organisations: number
  /** 1 when `organizations/platform-owner` exists (the owner's own profile, never a customer). */
  sentinelOrganisation: number
  testInternal: number
  testFlag: number
  testBoth: number
  scheduled: number
  /** Every `users` document. */
  accounts: number
  /** `users` documents naming the platform-owner sentinel organisation. */
  ownerAccounts: number
  inactiveAccounts: number
  internalAccounts: number
  accountsInTestOrgs: number
  internalAccountsInTestOrgs: number
}

export type OwnerCounts = {
  includeTestData: boolean
  organisations: number
  testOrganisations: number
  scheduledForDeletion: number
  /** `users` documents (accounts), not folded people: one person with two documents counts twice here. */
  accounts: number
  testAccounts: number
  /** `isActive == false` accounts, test data included. */
  inactiveAccounts: number
}

export function ownerCountsFromParts(parts: OwnerCountParts, includeTestData: boolean): OwnerCounts {
  const organisationsAll = Math.max(0, parts.organisations - parts.sentinelOrganisation)
  const testOrganisations = Math.max(0, parts.testInternal + parts.testFlag - parts.testBoth)
  const accountsAll = Math.max(0, parts.accounts - parts.ownerAccounts)
  const testAccounts = Math.max(0, parts.internalAccounts + parts.accountsInTestOrgs - parts.internalAccountsInTestOrgs)
  return {
    includeTestData,
    organisations: includeTestData ? organisationsAll : Math.max(0, organisationsAll - testOrganisations),
    testOrganisations,
    scheduledForDeletion: parts.scheduled,
    accounts: includeTestData ? accountsAll : Math.max(0, accountsAll - testAccounts),
    testAccounts,
    inactiveAccounts: parts.inactiveAccounts,
  }
}

/** The values a users document may store for an organisation: the id and the `organizations/{id}` path. */
export function organisationIdForms(ids: readonly string[]): string[] {
  return [...new Set(ids.flatMap((id) => [id, `organizations/${id}`]))]
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size))
  return out
}

/** Runs the aggregations with the owner's ID token. The test organisations are few, so they are listed by flag. */
export async function readOwnerCountParts(token: string): Promise<OwnerCountParts> {
  const count = (collectionId: string, where?: Record<string, unknown>) => firestoreCount(token, structuredQuery(collectionId, where))
  const [internalOrgs, flaggedOrgs] = await Promise.all([
    firestoreRunQuery(token, structuredQuery('organizations', restEqual('isInternal', true), { select: { fields: [] } })),
    firestoreRunQuery(token, structuredQuery('organizations', restEqual('isTest', true), { select: { fields: [] } })),
  ])
  const testOrgIds = [...new Set([...internalOrgs, ...flaggedOrgs].map((doc) => doc.id))]
  const testForms = organisationIdForms(testOrgIds)
  const sumOverChunks = async (build: (values: string[]) => Record<string, unknown>) => {
    let total = 0
    for (const values of chunks(testForms, 30)) total += await count('users', build(values))
    return total
  }
  const [organisations, sentinel, testBoth, scheduled, accounts, ownerAccounts, inactiveAccounts, internalAccounts] =
    await Promise.all([
      count('organizations'),
      firestoreGet(token, `organizations/${PLATFORM_OWNER_SENTINEL_ORG}`).then((doc) => (doc ? 1 : 0)),
      count('organizations', restAnd([restEqual('isInternal', true), restEqual('isTest', true)])),
      count('organizations', restEqual('deletion.status', 'scheduled')),
      count('users'),
      count('users', restEqual('organizationId', PLATFORM_OWNER_SENTINEL_ORG)),
      count('users', restEqual('isActive', false)),
      count('users', restEqual('isInternal', true)),
    ])
  const accountsInTestOrgs = testForms.length ? await sumOverChunks((values) => restIn('organizationId', values)) : 0
  const internalAccountsInTestOrgs = testForms.length
    ? await sumOverChunks((values) => restAnd([restIn('organizationId', values), restEqual('isInternal', true)]) as Record<string, unknown>)
    : 0
  return {
    organisations,
    sentinelOrganisation: sentinel,
    testInternal: internalOrgs.length,
    testFlag: flaggedOrgs.length,
    testBoth,
    scheduled,
    accounts,
    ownerAccounts,
    inactiveAccounts,
    internalAccounts,
    accountsInTestOrgs,
    internalAccountsInTestOrgs,
  }
}
