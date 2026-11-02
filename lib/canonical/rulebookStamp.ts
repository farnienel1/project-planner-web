/**
 * The rulebook version this packed script was built from.
 * `scripts/build-canonical-bundle.mjs` replaces the two constants at pack time from docs/RULEBOOK.md,
 * so the packed hash changes whenever the rulebook text changes. iOS asserts that its
 * docs/RULEBOOK.md mirror has this version and sha256 (RulebookParityTests).
 */
declare const __RULEBOOK_VERSION__: string
declare const __RULEBOOK_SHA256__: string

export function rulebookStamp(): { version: string; sha256: string } {
  return {
    version: typeof __RULEBOOK_VERSION__ === 'string' ? __RULEBOOK_VERSION__ : '',
    sha256: typeof __RULEBOOK_SHA256__ === 'string' ? __RULEBOOK_SHA256__ : '',
  }
}
