export function settingsDraftIsDirty(baseline: unknown, draft: unknown): boolean {
  return JSON.stringify(baseline) !== JSON.stringify(draft)
}
