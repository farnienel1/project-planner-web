/**
 * Owner console test-data rule (PLAN A8, owner decision D12): only the `isInternal` / `isTest` flags count — never a
 * guess from a name or an email. A console display rule, not a business rule, so it lives in lib/owner.
 */

export type TestFlagged = { isInternal?: unknown; isTest?: unknown }

/** An organisation is test data when it is flagged `isInternal` or `isTest` (Mark test in the console). */
export function isTestOrganisation(org: TestFlagged | null | undefined): boolean {
  return Boolean(org && (org.isInternal === true || org.isTest === true))
}

export type TestPersonInput = {
  isInternal?: unknown
  /** The users document's own organisation (an id; read with `documentOrganizationId` before calling). */
  organizationId?: string | null
  /** Any further organisations the person belongs to (memberships). */
  organizationIds?: readonly (string | null | undefined)[]
}

/** The organisations a person belongs to, trimmed and once each. */
export function personOrganisationIds(person: TestPersonInput): string[] {
  const ids = [person.organizationId, ...(person.organizationIds || [])]
    .map((id) => (typeof id === 'string' ? id.trim() : ''))
    .filter(Boolean)
  return [...new Set(ids)]
}

/**
 * A person is test data when their own `isInternal` is true, or when every organisation they belong to is a test
 * organisation. A person with no organisation is real (never hidden by a guess).
 */
export function isTestPerson(person: TestPersonInput | null | undefined, testOrganisationIds: ReadonlySet<string>): boolean {
  if (!person) return false
  if (person.isInternal === true) return true
  const orgs = personOrganisationIds(person)
  return orgs.length > 0 && orgs.every((id) => testOrganisationIds.has(id))
}

/** The ids of the test organisations among `orgs`. */
export function testOrganisationIds(orgs: readonly ({ id: string } & TestFlagged)[]): Set<string> {
  return new Set(orgs.filter(isTestOrganisation).map((org) => org.id))
}
