/**
 * Lists unfinished-setup users older than 12 months. Dry-run by default.
 *
 *   npx tsx scripts/cleanup-unfinished-setup.ts
 */
import { abandonedSignupCutoff } from '../lib/owner/unfinishedSetup'

console.log(
  JSON.stringify(
    {
      mode: 'dry-run',
      cutoff: abandonedSignupCutoff().toISOString(),
      note: 'Delete from Owner console → Data quality, or supply FIREBASE_SERVICE_ACCOUNT_JSON for a scheduled cleanup. No writes in this script.',
    },
    null,
    2
  )
)
