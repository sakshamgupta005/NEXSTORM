/**
 * Reusable JSON Serializer with Metadata Enveloping & Column Projections
 */

import type { ExportOptions } from './types'

export function recordsToJson<T = Record<string, unknown>>(
  records: T[],
  options: ExportOptions<T> = {}
): string {
  const maxRows = options.maxRows ?? 50000
  if (records.length > maxRows) {
    throw new Error(
      `Dataset exceeds maximum row limit of ${maxRows.toLocaleString()} rows (got ${records.length.toLocaleString()})`
    )
  }

  // Apply column projections if explicitly provided
  let projectedData: Array<Record<string, unknown>>
  if (options.columns && options.columns.length > 0) {
    const cols = options.columns
    projectedData = records.map((record) => {
      const obj: Record<string, unknown> = {}
      for (const col of cols) {
        const rawVal = (record as Record<string, unknown>)[col.key]
        obj[col.key] = col.formatter ? col.formatter(rawVal, record) : rawVal
      }
      return obj
    })
  } else {
    projectedData = records as Array<Record<string, unknown>>
  }

  // Envelope output if metadata or title is specified
  if (options.metadata || options.title) {
    const envelope = {
      title: options.title,
      metadata: options.metadata || {},
      totalRows: records.length,
      exportedAt: new Date().toISOString(),
      data: projectedData,
    }
    return JSON.stringify(envelope, null, 2)
  }

  return JSON.stringify(projectedData, null, 2)
}
