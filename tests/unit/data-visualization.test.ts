import { describe, it, expect } from 'vitest'
import {
  formatNumber,
  formatCurrency,
  formatPercent,
  formatDate,
  validateChartData,
  sortBy,
  aggregateBy,
  calculateDomain,
  generateSparklinePath,
} from '@/lib/visualization/formatters'

describe('Data Visualization Utilities (Unit Tests)', () => {
  describe('formatNumber', () => {
    it('formats standard integers and decimals', () => {
      expect(formatNumber(1250)).toBe('1,250')
      expect(formatNumber(1250.456, { decimals: 2 })).toBe('1,250.46')
    })

    it('formats compact notation', () => {
      expect(formatNumber(1500000, { notation: 'compact' })).toMatch(/1\.5M/)
      expect(formatNumber(25000, { notation: 'compact' })).toMatch(/25K/)
    })

    it('handles edge cases safely', () => {
      expect(formatNumber(0)).toBe('0')
      // @ts-expect-error test invalid input
      expect(formatNumber(null)).toBe('0')
      // @ts-expect-error test invalid input
      expect(formatNumber(undefined)).toBe('0')
      expect(formatNumber(NaN)).toBe('0')
    })
  })

  describe('formatCurrency', () => {
    it('formats USD currency amounts', () => {
      expect(formatCurrency(1250)).toBe('$1,250')
      expect(formatCurrency(99.95, { decimals: 2 })).toBe('$99.95')
    })

    it('supports custom currency and compact notation', () => {
      expect(formatCurrency(2500000, { notation: 'compact' })).toMatch(/\$2\.5M/)
      expect(formatCurrency(500, { currency: 'EUR' })).toMatch(/€500/)
    })

    it('handles zero and missing currency values safely', () => {
      expect(formatCurrency(0)).toBe('$0')
      expect(formatCurrency(NaN)).toBe('$0')
    })
  })

  describe('formatPercent', () => {
    it('formats percentages correctly', () => {
      expect(formatPercent(24.5)).toBe('24.5%')
      expect(formatPercent(0.245, { multiplyBy100: true })).toBe('24.5%')
    })

    it('supports sign prefix for deltas', () => {
      expect(formatPercent(12.4, { showSign: true })).toBe('+12.4%')
      expect(formatPercent(-5.2, { showSign: true })).toBe('-5.2%')
      expect(formatPercent(0, { showSign: true })).toBe('0.0%')
    })

    it('handles invalid percent values', () => {
      expect(formatPercent(NaN)).toBe('0%')
    })
  })

  describe('formatDate', () => {
    it('formats dates in various modes', () => {
      const d = new Date('2026-10-12T12:00:00Z')
      expect(formatDate(d, 'iso')).toBe('2026-10-12')
      expect(formatDate(d, 'short')).toMatch(/Oct 12/)
      expect(formatDate(d, 'medium')).toMatch(/Oct 12, 2026/)
    })

    it('handles string timestamps and invalid dates gracefully', () => {
      expect(formatDate('2026-05-15', 'iso')).toBe('2026-05-15')
      expect(formatDate('not-a-date')).toBe('not-a-date')
      expect(formatDate('')).toBe('')
    })
  })

  describe('validateChartData', () => {
    it('validates and accepts proper chart records', () => {
      const input = [
        { label: 'A', value: 10 },
        { label: 'B', value: 20 },
      ]
      const result = validateChartData(input)
      expect(result.valid).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.data[0].value).toBe(10)
    })

    it('coerces string numbers and handles fallback for NaN', () => {
      const input = [
        { label: 'A', value: '42' },
        { label: 'B', value: 'invalid' },
      ]
      const result = validateChartData(input, 0)
      expect(result.valid).toBe(false)
      expect(result.data[0].value).toBe(42)
      expect(result.data[1].value).toBe(0)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('handles non-array inputs cleanly', () => {
      const result = validateChartData(null)
      expect(result.valid).toBe(false)
      expect(result.data).toEqual([])
    })
  })

  describe('sortBy', () => {
    it('sorts records ascending and descending', () => {
      const items = [{ v: 3 }, { v: 1 }, { v: 2 }]
      const asc = sortBy(items, (i) => i.v, 'asc')
      expect(asc.map((i) => i.v)).toEqual([1, 2, 3])

      const desc = sortBy(items, (i) => i.v, 'desc')
      expect(desc.map((i) => i.v)).toEqual([3, 2, 1])
    })
  })

  describe('aggregateBy', () => {
    const raw = [
      { category: 'Fruit', sales: 10 },
      { category: 'Fruit', sales: 20 },
      { category: 'Veg', sales: 15 },
    ]

    it('computes sum aggregation', () => {
      const res = aggregateBy(raw, (i) => i.category, (i) => i.sales, 'sum')
      expect(res).toEqual([
        { label: 'Fruit', value: 30 },
        { label: 'Veg', value: 15 },
      ])
    })

    it('computes average aggregation', () => {
      const res = aggregateBy(raw, (i) => i.category, (i) => i.sales, 'avg')
      expect(res).toEqual([
        { label: 'Fruit', value: 15 },
        { label: 'Veg', value: 15 },
      ])
    })

    it('computes count aggregation', () => {
      const res = aggregateBy(raw, (i) => i.category, (i) => i.sales, 'count')
      expect(res).toEqual([
        { label: 'Fruit', value: 2 },
        { label: 'Veg', value: 1 },
      ])
    })

    it('computes min and max aggregations', () => {
      const minRes = aggregateBy(raw, (i) => i.category, (i) => i.sales, 'min')
      expect(minRes.find((r) => r.label === 'Fruit')?.value).toBe(10)

      const maxRes = aggregateBy(raw, (i) => i.category, (i) => i.sales, 'max')
      expect(maxRes.find((r) => r.label === 'Fruit')?.value).toBe(20)
    })

    it('handles empty inputs', () => {
      expect(
        aggregateBy(
          [] as { k: string; v: number }[],
          (i) => i.k,
          (i) => i.v
        )
      ).toEqual([])
    })
  })

  describe('calculateDomain', () => {
    it('computes domain min, max, and range with padding', () => {
      const data = [{ label: 'A', value: 50 }, { label: 'B', value: 100 }]
      const domain = calculateDomain(data, true)
      expect(domain.min).toBe(0)
      expect(domain.max).toBeGreaterThanOrEqual(100)
      expect(domain.range).toBeGreaterThan(0)
    })

    it('handles empty data', () => {
      const domain = calculateDomain([])
      expect(domain.min).toBe(0)
      expect(domain.max).toBe(100)
    })

    it('handles single value where min equals max', () => {
      const domain = calculateDomain([{ label: 'A', value: 50 }])
      expect(domain.range).toBeGreaterThan(0)
    })
  })

  describe('generateSparklinePath', () => {
    it('generates valid SVG path for sparkline series', () => {
      const { path, isUp } = generateSparklinePath([10, 20, 15, 30])
      expect(path).toMatch(/^M \d+(\.\d+)?,/)
      expect(isUp).toBe(true)
    })

    it('detects downward trend', () => {
      const { isUp } = generateSparklinePath([50, 40, 20])
      expect(isUp).toBe(false)
    })

    it('handles short or empty sparkline series safely', () => {
      const { path } = generateSparklinePath([10])
      expect(path).toContain('M 0,')
    })
  })
})
