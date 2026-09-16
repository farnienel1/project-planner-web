/**
 * iOS parity source: Views/ProjectSmallWorksRevampTokens.swift icon chips
 * Spec: docs/ios-parity/03-design-system.md §2
 */

import type { ReactNode } from 'react'

export type ChipTint = 'blue' | 'green' | 'amber' | 'purple' | 'rose' | 'coral' | 'red' | 'grey'

const CHIP: Record<ChipTint, string> = {
  blue: 'bg-ios-chip-blue text-ios-icon-blue',
  green: 'bg-ios-chip-green text-ios-icon-green',
  amber: 'bg-ios-chip-amber text-ios-icon-amber',
  purple: 'bg-ios-chip-purple text-ios-icon-purple',
  rose: 'bg-ios-chip-rose text-ios-icon-rose',
  coral: 'bg-ios-chip-coral text-ios-icon-coral',
  red: 'bg-ios-chip-red text-ios-icon-red',
  grey: 'bg-ios-chip-grey text-ios-icon-grey',
}

export function IconChip({
  tint,
  children,
  size = 'md',
}: {
  tint: ChipTint
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const box = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-[12px] ${box} ${CHIP[tint]}`}>
      {children}
    </span>
  )
}
