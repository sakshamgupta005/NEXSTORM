'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { DataTable, ColumnDef } from '@/components/ui/table'
import { Pagination } from '@/components/ui/pagination'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface PaginatedDataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  keyExtractor: (item: T, index: number) => string
  title?: string
  description?: string
  pageSize?: number
  searchPlaceholder?: string
  searchable?: boolean
  searchFn?: (item: T, query: string) => boolean
  isLoading?: boolean
  error?: string
  onRetry?: () => void
  emptyMessage?: string
  className?: string
  'data-testid'?: string
}

export function PaginatedDataTable<T>({
  data,
  columns,
  keyExtractor,
  title,
  description,
  pageSize = 10,
  searchPlaceholder = 'Filter records...',
  searchable = true,
  searchFn,
  isLoading = false,
  error,
  onRetry,
  emptyMessage = 'No matching records found.',
  className,
  'data-testid': testId,
}: PaginatedDataTableProps<T>) {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [currentPage, setCurrentPage] = React.useState(1)
  const [perPage, setPerPage] = React.useState(pageSize)

  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    setCurrentPage(1)
  }

  const handlePerPageChange = (size: number) => {
    setPerPage(size)
    setCurrentPage(1)
  }

  // Filter items
  const filteredData = React.useMemo(() => {
    if (!searchQuery.trim()) return data
    const query = searchQuery.toLowerCase().trim()
    if (searchFn) {
      return data.filter((item) => searchFn(item, query))
    }
    return data.filter((item) =>
      JSON.stringify(item).toLowerCase().includes(query)
    )
  }, [data, searchQuery, searchFn])

  const totalItems = filteredData.length
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage))

  const paginatedData = React.useMemo(() => {
    const start = (currentPage - 1) * perPage
    return filteredData.slice(start, start + perPage)
  }, [filteredData, currentPage, perPage])

  return (
    <Card className={cn('overflow-hidden', className)} data-testid={testId || 'paginated-data-table'}>
      {(title || searchable) && (
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div>
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </div>

          {searchable && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label="Filter records"
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>
          )}
        </CardHeader>
      )}

      <CardContent className="p-0">
        <DataTable
          data={paginatedData}
          columns={columns}
          keyExtractor={keyExtractor}
          isLoading={isLoading}
          error={error}
          onRetry={onRetry}
          emptyMessage={emptyMessage}
          className="border-0 rounded-none shadow-none"
        />
      </CardContent>

      {!isLoading && !error && totalItems > 0 && (
        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center space-x-2">
            <span>
              Showing {Math.min((currentPage - 1) * perPage + 1, totalItems)} to{' '}
              {Math.min(currentPage * perPage, totalItems)} of {totalItems} entries
            </span>

            <div className="flex items-center space-x-1 pl-3 border-l border-slate-200 dark:border-slate-800">
              <span>Show</span>
              <select
                value={perPage}
                onChange={(e) => handlePerPageChange(Number(e.target.value))}
                className="bg-transparent border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 text-xs focus:outline-none cursor-pointer"
                aria-label="Select rows per page"
              >
                {[5, 10, 25, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </CardFooter>
      )}
    </Card>
  )
}
