/**
 * The order of an Edit user save's batches (second review of #371).
 *
 * Every read has already run (`prepareChangeAccountType`, `prepareSaveUser`). Each `commit` hands one batch to Firestore
 * and settles when the server confirms or refuses it. The batches are queued one after another, each only once the
 * one before it is confirmed — the same order as before the split:
 *  1. the account type batch (`accountTypeChangeWrites`), when the type changes or a half-applied type is repaired;
 *  2. the profile batch — never queued unless the type is confirmed, so the profile's own fields are never written
 *     without the type they belong with (a refused type can never leave a half-applied type);
 *  3. the tax ids — never written unless the profile is confirmed.
 * A later batch is not queued when an earlier one is refused.
 */
export type ProfileSaveStage = 'type' | 'profile' | 'tax'

/** Why the save stopped. `partial` is true when an earlier batch was already confirmed (some changes saved). */
export class ProfileSaveStageError extends Error {
  readonly stage: ProfileSaveStage
  readonly partial: boolean
  readonly reason: string

  constructor(stage: ProfileSaveStage, partial: boolean, reason: string) {
    super(partial ? profileSavePartialMessage(reason) : reason)
    this.name = 'ProfileSaveStageError'
    this.stage = stage
    this.partial = partial
    this.reason = reason
  }
}

/** The wording when part of a save was confirmed and a later part was refused. */
export function profileSavePartialMessage(reason: string): string {
  return `Some changes may have saved, but part of the save was refused: ${reason} Reload and check this person.`
}

export type ProfileSaveSteps = {
  type?: (() => Promise<unknown>) | null
  profile: () => Promise<unknown>
  tax?: (() => Promise<unknown>) | null
}

export type ProfileSaveSequence = {
  /** The profile batch's own confirmation (the type batch first, when there is one). */
  profile: Promise<void>
  /** Every batch confirmed; rejects with a `ProfileSaveStageError`. */
  all: Promise<void>
  /** The batches queued so far, in order (for tests and diagnostics). */
  queued: () => ProfileSaveStage[]
}

function reasonOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'The server refused it.'
}

function silence(promise: Promise<unknown>): void {
  promise.catch(() => undefined)
}

export function sequenceProfileSave(steps: ProfileSaveSteps): ProfileSaveSequence {
  const queued: ProfileSaveStage[] = []
  const run = (stage: ProfileSaveStage, step: () => Promise<unknown>, partial: boolean): Promise<void> => {
    queued.push(stage)
    let started: Promise<unknown>
    try {
      started = Promise.resolve(step())
    } catch (error) {
      started = Promise.reject(error)
    }
    return started.then(
      () => undefined,
      (error: unknown) => {
        throw error instanceof ProfileSaveStageError ? error : new ProfileSaveStageError(stage, partial, reasonOf(error))
      }
    )
  }
  const typeStep = steps.type
  const type: Promise<void> = typeStep ? run('type', typeStep, false) : Promise.resolve()
  const profile = type.then(() => run('profile', steps.profile, Boolean(typeStep)))
  const taxStep = steps.tax
  const all = taxStep ? profile.then(() => run('tax', taxStep, true)) : profile
  // Every promise here is awaited by the caller through `all` or `profile`; none may surface as an unhandled rejection.
  silence(type)
  silence(profile)
  silence(all)
  return { profile, all, queued: () => [...queued] }
}
