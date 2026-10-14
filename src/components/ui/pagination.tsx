'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

export interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  siblingCount?: number
  className?: string
  disabled?: boolean
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  className,
  disabled = false,
}: PaginationProps) {
  // Generate page numbers with ellipsis
  const paginationRange = React.useMemo(() => {
    const totalPageNumbers = siblingCount * 2 + 5 // siblings + first + last + current + 2*dots

    if (totalPageNumbers >= totalPages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1)
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages)

    const shouldShowLeftDots = leftSiblingIndex > 2
    const shouldShowRightDots = rightSiblingIndex < totalPages - 2

    const firstPageIndex = 1
    const lastPageIndex = totalPages

    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItemCount = 3 + 2 * siblingCount
      const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1)
      return [...leftRange, '...', totalPages]
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * siblingCount
      const rightRange = Array.from(
        { length: rightItemCount },
        (_, i) => totalPages - rightItemCount + i + 1
      )
      return [firstPageIndex, '...', ...rightRange]
    }

    const middleRange = Array.from(
      { length: rightSiblingIndex - leftSiblingIndex + 1 },
      (_, i) => leftSiblingIndex + i
    )
    return [firstPageIndex, '...', ...middleRange, '...', lastPageIndex]
  }, [totalPages, siblingCount, currentPage])

  if (totalPages <= 1) return null

  return (
    <nav
      role="navigation"
      aria-label="Pagination Navigation"
      className={cn('flex items-center justify-center space-x-1.5', className)}
    >
      <Button
        variant="outline"
        size="sm"
        aria-label="Go to previous page"
        disabled={disabled || currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="h-8 px-2.5"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        <span>Previous</span>
      </Button>

      <div className="flex items-center space-x-1">
        {paginationRange.map((pageNumber, idx) => {
          if (pageNumber === '...') {
            return (
              <span
                key={`dots-${idx}`}
                className="px-2 text-slate-400 select-none text-sm"
              >
                &#8230;
              </span>
            )
          }

          const page = pageNumber as number
          const isCurrent = page === currentPage

          return (
            <button
              key={page}
              type="button"
              disabled={disabled}
              aria-label={`Page ${page}`}
              aria-current={isCurrent ? 'page' : undefined}
              onClick={() => onPageChange(page)}
              className={cn(
                'h-8 min-w-[32px] px-2 text-xs font-medium rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                isCurrent
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              {page}
            </button>
          )
        })}
      </div>

      <Button
        variant="outline"
        size="sm"
        aria-label="Go to next page"
        disabled={disabled || currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="h-8 px-2.5"
      >
        <span>Next</span>
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </nav>
  )
}
