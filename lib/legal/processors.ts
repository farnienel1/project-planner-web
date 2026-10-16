/** Named processors published at /processors. Inventory only — do not invent extras. */

export const LEGAL_PUBLIC_ORIGIN = 'https://www.projectplanner.us'
export const PRIVACY_PATH = '/privacy'
export const TERMS_PATH = '/terms'
export const PROCESSORS_PATH = '/processors'
export const PROCESSORS_PUBLIC_URL = `${LEGAL_PUBLIC_ORIGIN}${PROCESSORS_PATH}`

export type ProcessorRegionConfidence = 'Certain' | 'Likely'

export type ProcessorRow = {
  id: string
  name: string
  purpose: string
  surfaces: string
  region: { label: string; confidence: ProcessorRegionConfidence } | null
}

export const PROCESSOR_INVENTORY: readonly ProcessorRow[] = [
  {
    id: 'firebase',
    name: 'Google Firebase Auth, Firestore, Storage',
    purpose: 'Authentication, customer database, and file storage.',
    surfaces: 'Web and iOS',
    region: { label: 'United States', confidence: 'Likely' },
  },
  {
    id: 'functions',
    name: 'Google Cloud Functions (us-central1)',
    purpose: 'Transactional email and device-push fan-out.',
    surfaces: 'Shared backend',
    region: { label: 'United States (us-central1)', confidence: 'Certain' },
  },
  {
    id: 'push',
    name: 'Google FCM and Apple APNs',
    purpose: 'Device push delivery.',
    surfaces: 'iOS only',
    region: null,
  },
  {
    id: 'app-check',
    name: 'Google App Check and reCAPTCHA Enterprise',
    purpose: 'Bot and abuse protection for public forms and Auth.',
    surfaces: 'Web',
    region: null,
  },
  {
    id: 'maps-google',
    name: 'Google Maps / Geocoding',
    purpose: 'Address lookup and map geocoding.',
    surfaces: 'Web',
    region: null,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    purpose: 'Subscription billing and checkout.',
    surfaces: 'Web billing only',
    region: null,
  },
  {
    id: 'netlify',
    name: 'Netlify',
    purpose: 'Website hosting and register-interest Blobs.',
    surfaces: 'Web',
    region: null,
  },
  {
    id: 'resend',
    name: 'Resend',
    purpose:
      'iOS DEBUG fallback for email. Production email is the Cloud Function above. The function source is not in this repo, so this page does not claim production Resend.',
    surfaces: 'iOS DEBUG only',
    region: null,
  },
  {
    id: 'apple-on-device',
    name: 'Apple MapKit and EventKit',
    purpose: 'On-device maps and calendar.',
    surfaces: 'iOS',
    region: null,
  },
  {
    id: 'osm',
    name: 'OpenStreetMap tiles, Nominatim, Photon, and postcodes.io',
    purpose: 'Web map tiles and geocoding fallbacks.',
    surfaces: 'Web',
    region: null,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp (wa.me)',
    purpose: 'User-initiated material lists. Project Planner does not send WhatsApp messages itself.',
    surfaces: 'Web and iOS',
    region: null,
  },
]

export const PROCESSORS_NOT_USED =
  'This list does not include analytics SDKs, Crashlytics, Sentry, or AI APIs — those are not wired as processors in this product.'
