import { NextRequest } from 'next/server'
import { isFirebaseUser } from '@/lib/security/apiGuard'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { ownerJson, ownerReadGuard } from '@/lib/owner/ownerReadRoute'
import { CONSOLE_NAV } from '@/lib/owner/consoleNav'
import { STATUS_REPO_URL, STATUS_WINDOW_DAYS, STATUS_RULES_WORKFLOW_URL, buildInfo, firestoreConsoleDocUrl, logsExplorerUrl } from '@/lib/owner/platformStatus'
import { readEmailLog, readFunctionErrors, readLiveRules, readPlatformConfig } from '@/lib/owner/statusServer'
import { PLATFORM_CONFIG_APP_PATH } from '@/lib/canonical/platformConfig'

export const runtime = 'nodejs'

/**
 * GET /api/owner/status — the owner console Status page (owner request 24 Nov): the running web deploy, the rulebook
 * it runs, the live rules against the files it was built from, Cloud Functions errors, email failures and
 * platformConfig/app. Read-only, owner only. Each source is read on its own; one that cannot be read with the
 * credentials the server already has is "Not connected" with the reason.
 */
export async function GET(request: NextRequest) {
  const owner = await ownerReadGuard(request, 'owner-status', 30)
  if (!isFirebaseUser(owner)) return owner
  const token = bearerToken(request)
  const now = new Date()
  const since = new Date(now.getTime() - STATUS_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''
  const [platformConfig, rules, emails, functionErrors] = await Promise.all([
    readPlatformConfig(token),
    readLiveRules({
      firestoreBuildSha: process.env.OWNER_FIRESTORE_RULES_SHA256 || null,
      storageBuildSha: process.env.OWNER_STORAGE_RULES_SHA256 || null,
      bucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || null,
    }),
    readEmailLog(since, now),
    readFunctionErrors(since),
  ])
  const build = buildInfo(
    { COMMIT_REF: process.env.COMMIT_REF, DEPLOY_ID: process.env.DEPLOY_ID, CONTEXT: process.env.CONTEXT, BRANCH: process.env.BRANCH },
    {
      OWNER_BUILD_COMMIT: process.env.OWNER_BUILD_COMMIT,
      OWNER_BUILD_DEPLOY_ID: process.env.OWNER_BUILD_DEPLOY_ID,
      OWNER_BUILD_CONTEXT: process.env.OWNER_BUILD_CONTEXT,
      OWNER_BUILD_BRANCH: process.env.OWNER_BUILD_BRANCH,
      OWNER_BUILD_TIME: process.env.OWNER_BUILD_TIME,
      NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
    }
  )
  const errorsItem = CONSOLE_NAV.flatMap((group) => group.items).find((item) => item.label === 'Errors')
  return ownerJson({
    checkedAt: now.toISOString(),
    windowDays: STATUS_WINDOW_DAYS,
    build,
    rulebookVersion: process.env.NEXT_PUBLIC_RULEBOOK_VERSION || null,
    rulebookUrl: `${STATUS_REPO_URL}/blob/${build.commit || 'main'}/docs/RULEBOOK.md`,
    rules,
    rulesWorkflowUrl: STATUS_RULES_WORKFLOW_URL,
    functionErrors,
    logsUrl: projectId ? logsExplorerUrl(projectId, since) : null,
    emails,
    emailLogUrl: projectId ? firestoreConsoleDocUrl(projectId, 'emailLog') : null,
    platformConfig,
    platformConfigUrl: projectId ? firestoreConsoleDocUrl(projectId, PLATFORM_CONFIG_APP_PATH) : null,
    // Client errors (D7): the Errors page arrives with rulebook 1.84; the tile links to it once its menu item is shown.
    clientErrors: errorsItem?.shown && errorsItem.href
      ? { connected: true as const, href: errorsItem.href }
      : { connected: false as const, reason: 'No client error source yet: the Errors page arrives with 1.84.' },
  })
}
