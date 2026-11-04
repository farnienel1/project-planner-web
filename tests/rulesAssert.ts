/**
 * Rules-test assertions that tell a logical denial from the expression budget.
 *
 * Firestore stops evaluating a request after 1,000 expressions and denies it with "Unable to evaluate the expression
 * as the maximum of 1000 expressions to evaluate has been reached". That is a refusal for the wrong reason: the rule
 * never reached its decision, and the same request can flip to allowed when unrelated rules get cheaper (rulebook
 * 1.31.1). `assertFails` here fails the test when the denial came from the budget, so every denial a suite asserts is
 * one the rule logic made.
 */
import { assertFails as rawAssertFails, assertSucceeds } from '@firebase/rules-unit-testing'

export const EXPRESSION_LIMIT_TEXT = 'maximum of 1000 expressions'

export function isExpressionLimitDenial(error: unknown): boolean {
  const message = String((error as { message?: unknown } | null)?.message ?? error ?? '')
  return message.includes(EXPRESSION_LIMIT_TEXT)
}

/** Expects a permission denial made by the rule logic; a denial caused by the 1,000-expression limit fails the test. */
export async function assertLogicalDeny(pr: Promise<unknown>): Promise<unknown> {
  const error = await rawAssertFails(pr)
  if (isExpressionLimitDenial(error)) {
    throw new Error(`Denied by the 1,000-expression limit, not by the rules' logic: ${String((error as Error).message)}`)
  }
  return error
}

/**
 * The suites' `assertFails`. With RULES_STRICT_BUDGET=1 it is `assertLogicalDeny`; otherwise any denial passes, as
 * before 1.31.1. 1.31.1 measured 74 of the 185 older firestore tests with at least one denial that comes from the
 * limit (108 on 1.31.0); see docs/firestore-rules-notes.md "Expression budget". Run `RULES_STRICT_BUDGET=1 npm run test:rules`
 * to list them.
 */
export async function assertFails(pr: Promise<unknown>): Promise<unknown> {
  return process.env.RULES_STRICT_BUDGET === '1' ? assertLogicalDeny(pr) : rawAssertFails(pr)
}

/** Expects success; a 1,000-expression denial is reported as such. */
export async function assertSucceedsWithinBudget(pr: Promise<unknown>): Promise<unknown> {
  try {
    return await assertSucceeds(pr)
  } catch (error) {
    if (isExpressionLimitDenial(error)) {
      throw new Error(`Hit the 1,000-expression limit: ${String((error as Error).message)}`)
    }
    throw error
  }
}

export { assertSucceeds }
