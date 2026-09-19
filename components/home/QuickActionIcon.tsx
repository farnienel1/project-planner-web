/**
 * Heroicon stand-ins for Home quick-action SF Symbols.
 * Spec: docs/ios-parity/IOS_APP_BLUEPRINT.md §4.4, §6.18
 * Apple’s licence does not allow SF Symbols on the web; do not add Lucide.
 */

import type { ComponentType, SVGProps } from 'react'
import {
  AcademicCapIcon,
  AdjustmentsHorizontalIcon,
  BriefcaseIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  CalendarIcon,
  Cog6ToothIcon,
  CubeIcon,
  DocumentChartBarIcon,
  DocumentTextIcon,
  FolderIcon,
  MapIcon,
  PlusIcon,
  QuestionMarkCircleIcon,
  ShieldCheckIcon,
  Square2StackIcon,
  Squares2X2Icon,
  SquaresPlusIcon,
  SunIcon,
  UserGroupIcon,
  UserPlusIcon,
  UsersIcon,
  ViewfinderCircleIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/solid'
import {
  QUICK_ACTION_ICON_NAMES,
  type QuickActionIconName,
} from '@/lib/home/quickActionIconNames'

type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>

/**
 * Closest Heroicons to the iOS SF Symbols (folder, hammer, sun, calendar, …).
 * There is no hammer or handshake glyph in Heroicons — screwdriver/users stand in.
 */
const QUICK_ACTION_ICON_MAP: Record<QuickActionIconName, HeroIcon> = {
  folder: FolderIcon,
  hammer: WrenchScrewdriverIcon,
  sun: SunIcon,
  scan: ViewfinderCircleIcon,
  calendar: CalendarIcon,
  cog: Cog6ToothIcon,
  chart: DocumentChartBarIcon,
  'clock-cal': CalendarDaysIcon,
  shield: ShieldCheckIcon,
  users: UserGroupIcon,
  handshake: UsersIcon,
  map: MapIcon,
  briefcase: BriefcaseIcon,
  'plus-square': SquaresPlusIcon,
  grad: AcademicCapIcon,
  grid: Squares2X2Icon,
  building: BuildingOffice2Icon,
  box: CubeIcon,
  'user-plus': UserPlusIcon,
  help: QuestionMarkCircleIcon,
  sliders: AdjustmentsHorizontalIcon,
  tasks: Square2StackIcon,
  doc: DocumentTextIcon,
}

export function knownQuickActionIconNames(): string[] {
  return [...QUICK_ACTION_ICON_NAMES]
}

export function QuickActionIcon({
  name,
  className = 'h-6 w-6',
}: {
  name: string
  className?: string
}) {
  const Icon = (QUICK_ACTION_ICON_MAP as Record<string, HeroIcon>)[name] ?? PlusIcon
  return <Icon className={className} aria-hidden />
}
