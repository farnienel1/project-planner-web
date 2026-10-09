export {
  paymentRunModeChange,
  validateInvoicingSettings,
  validatePaymentDates,
  validatePaymentRunDateRanges,
} from '@/lib/canonical/organizationSettings'

export const DAY_OF_MONTH_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1)
