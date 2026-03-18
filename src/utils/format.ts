import { format, parseISO } from 'date-fns'
import type { RangePreset } from '../types'

const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
})

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

export function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

export function formatCompactNumber(value: number) {
  return compactFormatter.format(value)
}

export function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`
}

export function formatTimestamp(value: string) {
  return format(parseISO(value), 'yyyy-MM-dd HH:mm')
}

export function formatRangeLabel(range: RangePreset) {
  switch (range) {
    case '7d':
      return '7 天'
    case '30d':
      return '30 天'
    case '90d':
      return '90 天'
    case '1y':
      return '1 年'
    case 'max':
      return '全部'
  }
}

export function formatCoverage(start: string | null, end: string | null) {
  if (!start || !end) {
    return '后台正在准备数据'
  }

  return `${formatTimestamp(start)} -> ${formatTimestamp(end)}`
}
