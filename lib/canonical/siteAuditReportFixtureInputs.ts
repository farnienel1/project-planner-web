/**
 * Inputs of the shared site audit report fixture (rulebook 1.61.0, §29). The expected pages are in
 * `site-audit-report-fixture.json`; both apps' tests lay these out (web directly, iOS through the packed script) and
 * check the same text lines and page breaks, and that the renderer draws every op.
 */
import type { SiteAuditReportInput } from './siteAuditReport'

const PORTRAIT = { width: 1170, height: 2532 }
const LANDSCAPE = { width: 4032, height: 3024 }
const SQUARE = { width: 1280, height: 1280 }
const PANORAMA = { width: 4000, height: 600 }
const AT = Date.UTC(2026, 10, 17, 9, 30)

const repeat = (text: string, length: number) => {
  let out = ''
  while (out.length < length) out += text
  return out.slice(0, length)
}

export const SITE_AUDIT_REPORT_FIXTURE_INPUTS: ReadonlyArray<{ name: string; input: SiteAuditReportInput }> = [
  {
    // The owner's report of 17 Nov: 6 items, phone screenshots, annotations on item 1 only.
    name: 'owner-c646',
    input: {
      timeZone: 'Europe/London',
      organizationName: 'Raccord MEP',
      clientName: 'RED Construction',
      siteAddress: '71 Broadwick Street, London, W1F 9QY',
      logo: { width: 400, height: 300 },
      audit: {
        id: 'AUD-1',
        projectJobNumber: 'C646',
        projectName: '1 Carnaby Street',
        type: 'General',
        customTitle: 'Test snags',
        authorName: 'Test Admin',
        dateMs: Date.UTC(2026, 10, 17),
        createdAtMs: 1794943857000,
        items: [
          { id: 'i1', title: 'Issue 1', annotations: 'Test notes 12/03/23', imageCapturedAtMs: AT, photo: PORTRAIT },
          ...[2, 3, 4, 5, 6].map((n) => ({ id: `i${n}`, title: n === 2 ? 'Photo item 2' : 'Photo item', createdAtMs: AT, photo: PORTRAIT })),
        ],
      },
    },
  },
  {
    // Every field at its limit, a long URL with no spaces, many photos of every shape, accents, emoji.
    name: 'limits-and-many-photos',
    input: {
      timeZone: 'Europe/London',
      organizationName: 'A Very Long Organisation Name Mechanical And Electrical Contractors Limited',
      clientName: repeat('Client name ', 400),
      siteAddress: repeat('Unit 4, Long Industrial Estate Road, ', 150),
      logo: null,
      audit: {
        projectJobNumber: 'J-1042',
        projectName: 'Café Zoë — Łódź refit',
        type: 'Snags',
        customTitle: repeat('Custom title ', 120),
        authorName: 'Zoë O’Neil-Smith',
        dateMs: Date.UTC(2026, 10, 16),
        createdAtMs: Date.UTC(2026, 10, 16, 8),
        items: Array.from({ length: 36 }, (_, index) => ({
          id: `p${index + 1}`,
          title: index === 0 ? repeat('W', 120) : `Item ${index + 1} 🚧 snag`,
          location: index === 0 ? repeat('Level 3 east riser ', 120) : 'Plant room',
          assignee: index === 0 ? repeat('A', 80) : '',
          comments:
            index === 0
              ? repeat('A long paragraph about the defect, with details of what to fix and why. ', 2000)
              : index === 1
                ? `See https://example.com/${repeat('very-long-path-segment-', 300)}?q=1 for the drawing.`
                : '',
          annotations: index === 0 ? repeat('Note ', 2000) : '',
          imageCapturedAtMs: AT + index * 60_000,
          photo: [PORTRAIT, LANDSCAPE, SQUARE, PANORAMA, null][index % 5],
        })),
      },
    },
  },
  {
    // Stored text longer than today's limits (written before them): printed whole, flowing over several pages.
    name: 'stored-text-over-limit',
    input: {
      timeZone: 'Europe/London',
      organizationName: 'Raccord MEP',
      audit: {
        projectJobNumber: 'C1',
        projectName: 'Old job',
        type: 'Pre-Start',
        authorName: 'Ann',
        dateMs: Date.UTC(2026, 0, 5),
        createdAtMs: Date.UTC(2026, 0, 5),
        items: [
          {
            id: 'x1',
            title: repeat('Old long title ', 450),
            comments: Array.from({ length: 12 }, (_, i) => `Paragraph ${i + 1}. ${repeat('Words that go on and on. ', 600)}`).join('\n\n'),
            annotations: repeat('Annotation text ', 4800),
            createdAtMs: Date.UTC(2026, 0, 5, 7),
            photo: PORTRAIT,
          },
        ],
      },
    },
  },
]
