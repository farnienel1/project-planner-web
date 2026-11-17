import type { BookingHoursBreakdownDays } from '@/lib/canonical'
import { HoursBreakdownBox } from '@/components/scheduling/HoursBreakdownBox'

/**
 * The hours breakdown of one booking. Rulebook 1.62.0 §4.3 (`bookingHoursBreakdownDays`): Normal hours, Overtime and
 * Total paid hours for every slot — custom hours, a full day, a stored AM / PM, a weekend day — read under the working
 * hours in effect on the booking's day. Replaces the 1.18.0 / 1.39.0 per-day rows and the long explanation.
 */
export function HoursBreakdownCard({ breakdown }: { breakdown: BookingHoursBreakdownDays | null }) {
  return <HoursBreakdownBox breakdown={breakdown} />
}
