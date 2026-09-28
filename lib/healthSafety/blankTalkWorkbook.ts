/**
 * Blank toolbox-talk workbook. Excel opens this SpreadsheetML file, the user edits it,
 * and the job library upload accepts the saved .xls or .xlsx file.
 */

const XML_NS = 'urn:schemas-microsoft-com:office:spreadsheet'

function cell(value: string): string {
  const text = value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<Cell><Data ss:Type="String">${text}</Data></Cell>`
}

function row(values: string[]): string {
  return `<Row>${values.map(cell).join('')}</Row>`
}

export function blankTalkWorkbookXml(): string {
  const rows = [
    row(['Field', 'Value']),
    row(['Title', '']),
    row(['Category', 'General']),
    row(['Trades', '']),
    row(['Purpose', '']),
    row(['Key point 1', '']),
    row(['Key point 2', '']),
    row(['Key point 3', '']),
  ]
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="${XML_NS}" xmlns:ss="${XML_NS}">
  <Worksheet ss:Name="Toolbox talk">
    <Table>
      ${rows.join('\n      ')}
    </Table>
  </Worksheet>
</Workbook>`
}

export function downloadBlankTalkExcel(): void {
  const blob = new Blob([blankTalkWorkbookXml()], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'toolbox-talk-blank.xls'
  link.click()
  URL.revokeObjectURL(url)
}
