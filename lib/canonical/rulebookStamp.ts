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

/**
 * 1.32.0 (owner decision 4 Nov): the line shown to everyone at the bottom of Settings on web and iOS, "Rules 1.32.0".
 * `version` is the app's rulebook version (iOS: `rulebookStamp().version`; web: the version it was built with); with
 * none given, the packed stamp. '' when unknown (the line is then hidden).
 */
export function rulebookVersionLabel(version?: string | null): string {
  const value = (typeof version === 'string' ? version.trim() : '') || rulebookStamp().version
  return /^\d+\.\d+\.\d+$/.test(value) ? `Rules ${value}` : ''
}
