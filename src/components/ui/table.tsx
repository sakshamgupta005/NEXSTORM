'use client'

import * as React from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingState, EmptyState, ErrorState } from './state-views'

// --- Table HTML Primitives ---

export const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
    <table
      ref={ref}
      className={cn('w-full caption-bottom text-sm text-left', className)}
      {...props}
    />
  </div>
))
Table.displayName = 'Table'

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn('border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50', className)}
    {...props}
  />
))
TableHeader.displayName = 'TableHeader'

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
))
TableBody.displayName = 'TableBody'

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-slate-200 dark:border-slate-800 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50 data-[state=selected]:bg-slate-100',
      className
    )}
    {...props}
  />
))
TableRow.displayName = 'TableRow'

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-10 px-4 text-left align-middle font-medium text-slate-500 dark:text-slate-400 [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
))
TableHead.displayName = 'TableHead'

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0 text-slate-900 dark:text-slate-100', className)}
    {...props}
  />
))
TableCell.displayName = 'TableCell'

// --- Sortable & Filterable DataTable ---

export interface ColumnDef<T> {
  key: string
  header: string
  accessor: (item: T) => React.ReactNode
  sortValue?: (item: T) => string | number
  sortable?: boolean
  className?: string
}

export interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  keyExtractor: (item: T, index: number) => string
  isLoading?: boolean
  error?: string
  onRetry?: () => void
  emptyMessage?: string
  filterText?: string
  filterFn?: (item: T, query: string) => boolean
  className?: string
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  error,
  onRetry,
  emptyMessage = 'No records found matching your criteria.',
  filterText = '',
  filterFn,
  className,
}: DataTableProps<T>) {
  const [sortConfig, setSortConfig] = React.useState<{
    key: string
    direction: 'asc' | 'desc'
  } | null>(null)

  // 1. Filter
  const filteredData = React.useMemo(() => {
    if (!filterText.trim()) return data
    if (filterFn) return data.filter((item) => filterFn(item, filterText.toLowerCase()))
    return data.filter((item) =>
      JSON.stringify(item).toLowerCase().includes(filterText.toLowerCase())
    )
  }, [data, filterText, filterFn])

  // 2. Sort
  const sortedData = React.useMemo(() => {
    if (!sortConfig) return filteredData
    const column = columns.find((c) => c.key === sortConfig.key)
    if (!column || !column.sortValue) return filteredData

    return [...filteredData].sort((a, b) => {
      const valA = column.sortValue!(a)
      const valB = column.sortValue!(b)

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredData, sortConfig, columns])

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        }
      }
      return { key, direction: 'asc' }
    })
  }

  if (isLoading) {
    return <LoadingState title="Loading table data..." className={className} />
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load data"
        description={error}
        actionLabel={onRetry ? 'Retry' : undefined}
        onAction={onRetry}
        className={className}
      />
    )
  }

  if (sortedData.length === 0) {
    return (
      <EmptyState
        title="No items found"
        description={emptyMessage}
        className={className}
      />
    )
  }

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          {columns.map((col) => {
            const isSorted = sortConfig?.key === col.key
            const ariaSort = isSorted
              ? sortConfig.direction === 'asc'
                ? 'ascending'
                : 'descending'
              : undefined

            return (
              <TableHead key={col.key} className={col.className} aria-sort={ariaSort}>
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className="inline-flex items-center space-x-1 font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none"
                  >
                    <span>{col.header}</span>
                    {isSorted ? (
                      sortConfig.direction === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 opacity-60" />
                    )}
                  </button>
                ) : (
                  <span>{col.header}</span>
                )}
              </TableHead>
            )
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedData.map((item, idx) => (
          <TableRow key={keyExtractor(item, idx)}>
            {columns.map((col) => (
              <TableCell key={col.key} className={col.className}>
                {col.accessor(item)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
