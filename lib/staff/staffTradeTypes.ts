export const STAFF_TRADE_TYPES = [
  'Electrician',
  'Plumber',
  'AC Engineer',
  'Ventilation',
  'Gas Engineer',
  'Carpenter',
  'Roofer',
  'Bricklayer',
  'Groundworker',
  'Finance',
  'Contract Manager',
  'Project Manager',
  'Site Manager',
  'Supervisor',
  'Installer',
  'Commissioning Engineer',
  'Programmer',
  'Scaffolder',
  'Brick & Block',
  'Dryliner',
  'Painter & Decorator',
  'Demolition Operative',
  'Steel Fixer',
  'Plant Operator',
  'Other',
] as const

/** Preset trades shown in user setup / manage users (excludes the "Other" meta-option). */
export const STAFF_TRADE_PRESETS = STAFF_TRADE_TYPES.filter((trade) => trade !== 'Other')

export function displayTradeType(preset?: string, custom?: string): string {
  const trimmedCustom = custom?.trim() || ''
  const presetTrimmed = preset?.trim() || ''
  if (!presetTrimmed) return trimmedCustom || '—'
  if (presetTrimmed === 'Other') return trimmedCustom || 'Other'
  return presetTrimmed
}
