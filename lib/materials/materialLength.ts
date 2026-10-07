/**
 * iOS parity source: Models/MaterialsModels.swift MaterialLengthSpecification.format
 * Spec: docs/ios-parity/sections/07-material-catalogue.md
 *
 * Lists and emails show `3 m` or `150 mm`, not a glued `3M`.
 */

export function lengthUnitSuffix(unit?: string | null): string {
  switch ((unit || '').trim().toUpperCase()) {
    case 'M':
    case 'METRE':
    case 'METRES':
    case 'METER':
    case 'METERS':
      return 'm'
    case 'MM':
    case 'MILLIMETRE':
    case 'MILLIMETRES':
    case 'MILLIMETER':
    case 'MILLIMETERS':
      return 'mm'
    default:
      return ''
  }
}

export function formatLengthSpecification(value?: string | null, unit?: string | null): string {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''
  const suffix = lengthUnitSuffix(unit)
  if (!suffix) return trimmed
  return `${trimmed} ${suffix}`
}
