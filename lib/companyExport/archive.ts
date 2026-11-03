/**
 * Company data export (launch checklist 2.1): the files of the zip, from the documents read.
 *
 * Pure apart from fflate (zip in the browser, no server): `companyExportEntries` gives every file's text,
 * `companyExportZip` packs them. The reader (`runCompanyExport.ts`) hands over raw Firestore data; every value goes
 * through `exportDocument` (organisation-zone ISO instants) and `sanitizeDocument` (no tokens, Stripe ids or tax
 * ids) before it reaches any file, files.csv included.
 */
import { strToU8, zipSync, type Zippable } from 'fflate'
import { organizationTimeZone } from '../canonical/organizationTimeZone'
import { resolveOrganizationCurrency } from '../canonical/money'
import { parseOrganizationName } from '../canonical/organizationSettings'
import { CSV_BOM, escapeCsvCell, toCsv } from './csv'
import { fileReferencesInDocument, type FileReference } from './files'
import {
  EXCLUSION_NOTES,
  EXPORT_FILES,
  fileForDocument,
  sanitizeDocument,
  type ExportFileKey,
} from './sources'
import { exportDocument, isoInZone, type ExportValue } from './values'

/** One document as read. `collection` is the organisation subcollection name, 'users', 'organization' or, for a
 * job's nested health & safety documents, 'healthSafety'. */
export type CollectedDocument = {
  collectionPath: string
  collection: string
  id: string
  data: Record<string, unknown>
}

export type CollectionProblem = { collectionPath: string; message: string }

export type CompanyExportInput = {
  organizationId: string
  organization: Record<string, unknown>
  documents: readonly CollectedDocument[]
  problems: readonly CollectionProblem[]
  includeNotifications: boolean
  exportedAt: Date
  rulebookVersion: string
}

export const FILES_CSV = 'files.csv'
export const EXPORT_JSON = 'export.json'
export const README_TXT = 'README.txt'
export const CSV_META_COLUMNS = ['documentId', 'collectionPath', 'organisationCurrency'] as const

function fileKeyFor(document: CollectedDocument): ExportFileKey {
  if (document.collection === 'organization') return 'organisation'
  if (document.collection === 'users') return 'people'
  if (document.collection === 'healthSafety') return 'healthSafety'
  return fileForDocument(document.collection, document.id)
}

/** `Tuesday 3 November 2026, 14:05:09` in the organisation zone (built from parts, so every ICU prints the same). */
function longStamp(date: Date, timeZone: string): string {
  const parts: Record<string, string> = {}
  for (const part of new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value
  }
  return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}:${parts.second}`
}

function rowsLabel(count: number): string {
  return `${count} ${count === 1 ? 'row' : 'rows'}`
}

/** A file-name-safe slug of the organisation name. */
export function organizationSlug(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug || 'company'
}

export function companyExportFileName(organizationName: string, exportedAt: Date, timeZone: string): string {
  return `company-data-${organizationSlug(organizationName)}-${isoInZone(exportedAt, timeZone).slice(0, 10)}.zip`
}

/** Every file of the export as text, keyed by its name in the zip. */
export function companyExportEntries(input: CompanyExportInput): Record<string, string> {
  const timeZone = organizationTimeZone(
    typeof input.organization.countryCode === 'string' ? input.organization.countryCode : null
  )
  const currency = resolveOrganizationCurrency(input.organization)
  const organizationName = parseOrganizationName(input.organization) || 'Unnamed organisation'

  const rowsByFile = new Map<ExportFileKey, Record<string, ExportValue>[]>()
  const json: Record<string, Record<string, Record<string, ExportValue>>> = {}
  const fileRefs: FileReference[] = []
  const all: CollectedDocument[] = [
    {
      collectionPath: 'organizations',
      collection: 'organization',
      id: input.organizationId,
      data: input.organization,
    },
    ...input.documents,
  ]
  for (const document of all) {
    const key = fileKeyFor(document)
    if (key === 'notifications' && !input.includeNotifications) continue
    const data = sanitizeDocument(
      exportDocument(document.data, timeZone),
      document.collection === 'organization' ? 'organization' : 'other'
    )
    ;(json[document.collectionPath] ??= {})[document.id] = data
    fileRefs.push(...fileReferencesInDocument(document.collectionPath, document.id, data))
    const row: Record<string, ExportValue> = {
      ...data,
      documentId: document.id,
      collectionPath: document.collectionPath,
      organisationCurrency: currency,
    }
    if (key === 'jobs') row.jobCollection = document.collection
    const rows = rowsByFile.get(key) ?? []
    rows.push(row)
    rowsByFile.set(key, rows)
  }

  const entries: Record<string, string> = {}
  const counts: { file: string; title: string; description: string; rows: number }[] = []
  for (const key of Object.keys(EXPORT_FILES) as ExportFileKey[]) {
    if (key === 'notifications' && !input.includeNotifications) continue
    const spec = EXPORT_FILES[key]
    const rows = rowsByFile.get(key) ?? []
    entries[spec.file] = toCsv(rows, {
      leading: [...CSV_META_COLUMNS, ...(key === 'jobs' ? ['jobCollection'] : [])],
    })
    counts.push({ ...spec, rows: rows.length })
  }

  const fileColumns = ['collectionPath', 'documentId', 'field', 'storagePath', 'url'] as const
  entries[FILES_CSV] =
    CSV_BOM +
    [
      fileColumns.join(','),
      ...fileRefs.map((ref) => fileColumns.map((column) => escapeCsvCell(ref[column])).join(',')),
    ].join('\r\n') +
    '\r\n'

  const exportedAtIso = isoInZone(input.exportedAt, timeZone)
  entries[EXPORT_JSON] = JSON.stringify(
    {
      exportedAt: exportedAtIso,
      timeZone,
      organizationId: input.organizationId,
      organizationName,
      organisationCurrency: currency,
      rulebookVersion: input.rulebookVersion,
      collections: json,
      unreadable: input.problems,
    },
    null,
    2
  )

  entries[README_TXT] = readmeText({
    organizationName,
    organizationId: input.organizationId,
    exportedAt: input.exportedAt,
    exportedAtIso,
    timeZone,
    currency,
    rulebookVersion: input.rulebookVersion,
    counts,
    fileCount: fileRefs.length,
    problems: input.problems,
    includeNotifications: input.includeNotifications,
  })
  return entries
}

function readmeText(args: {
  organizationName: string
  organizationId: string
  exportedAt: Date
  exportedAtIso: string
  timeZone: string
  currency: string
  rulebookVersion: string
  counts: { file: string; title: string; description: string; rows: number }[]
  fileCount: number
  problems: readonly CollectionProblem[]
  includeNotifications: boolean
}): string {
  const lines: string[] = [
    'Project Planner — company data export',
    '=====================================',
    '',
    `Organisation: ${args.organizationName} (${args.organizationId})`,
    `Exported: ${longStamp(args.exportedAt, args.timeZone)} (${args.timeZone}) — ${args.exportedAtIso}`,
    `Rulebook version: ${args.rulebookVersion || 'unknown'}`,
    `Organisation currency: ${args.currency}`,
    '',
    'How to read the files',
    '---------------------',
    '- CSV files are UTF-8 with a byte-order mark, so Excel opens them with the right characters.',
    `- Dates and times are in the organisation time zone (${args.timeZone}) as ISO 8601 with the offset, e.g. ${args.exportedAtIso}. Day keys stored as YYYY-MM-DD are kept as stored.`,
    '- Nested values are flattened into dotted columns (address.city). Lists are joined with "; "; a list of records shows each record as JSON.',
    '- Very wide maps (for example reviews keyed by entry id) are kept as one JSON column so a file stays under 400 columns; export.json has every value in full.',
    `- Money is a plain number. The organisationCurrency column (${args.currency}) is its currency.`,
    '- Every row starts with documentId and collectionPath, the Firestore document it came from.',
    '- A cell that would start a spreadsheet formula (=, @, or +/- followed by text) begins with an apostrophe.',
    '',
    'Files',
    '-----',
    ...args.counts.map((entry) => `${entry.file} (${rowsLabel(entry.rows)}) — ${entry.description}`),
    `${FILES_CSV} (${rowsLabel(args.fileCount)}) — Every uploaded file the records point to (photos, certificates, RAMS, logos, evidence): where it is referenced, its Cloud Storage path and its download URL. The files themselves are NOT in this zip; open each URL to download it.`,
    `${EXPORT_JSON} — A full JSON copy of the same documents, keyed by collection path and then document id.`,
    `${README_TXT} — This file.`,
    '',
    'Not included',
    '------------',
    ...EXCLUSION_NOTES.map((note) => `- ${note}`),
    ...(args.includeNotifications ? [] : ['- Notifications (inbox rows): not chosen for this export.']),
    '',
    'Keep this file safe',
    '-------------------',
    'It holds personal data (names, contact details, pay) and download links that open the company\'s files without signing in. Store it as you would payroll records.',
  ]
  if (args.problems.length > 0) {
    lines.push(
      '',
      'Could not be read',
      '-----------------',
      'These were refused or failed while exporting; their files are empty or incomplete:',
      ...args.problems.map((problem) => `- ${problem.collectionPath}: ${problem.message}`)
    )
  }
  return `${lines.join('\r\n')}\r\n`
}

/** The zip bytes for the export. */
export function companyExportZip(entries: Record<string, string>, exportedAt: Date): Uint8Array {
  const files: Zippable = {}
  for (const [name, text] of Object.entries(entries)) {
    files[name] = [strToU8(text), { mtime: exportedAt }]
  }
  return zipSync(files, { level: 6 })
}
