/** "Project Planner · v1.2.3" from the package.json version (`NEXT_PUBLIC_APP_VERSION`, set in next.config.js). */
export function appVersionLabel(version: string | null | undefined): string {
  const trimmed = typeof version === 'string' ? version.trim() : ''
  return trimmed ? `Project Planner · v${trimmed}` : 'Project Planner'
}
