'use client'

import React from 'react'
import { PageHeader, BreadcrumbItem } from '@/components/layout/page-header'
import { SearchInput } from '@/components/ui/search-input'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState, ErrorState, PageSkeletonState } from '@/components/ui/state-views'
import { Select } from '@/components/ui/form-controls'

export interface SearchResultsTemplateProps {
  title?: React.ReactNode
  description?: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  query: string
  onQueryChange: (query: string) => void
  searchPlaceholder?: string
  totalResults?: number
  filters?: React.ReactNode
  sortOptions?: Array<{ label: string; value: string }>
  activeSort?: string
  onSortChange?: (sort: string) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  pagination?: {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
    totalItems?: number
    pageSize?: number
  }
  children: React.ReactNode
  className?: string
}

export function SearchResultsTemplate({
  title = 'Search',
  description,
  breadcrumbs,
  query,
  onQueryChange,
  searchPlaceholder = 'Search records, items, or documents...',
  totalResults,
  filters,
  sortOptions,
  activeSort,
  onSortChange,
  isLoading = false,
  error = null,
  onRetry,
  pagination,
  children,
  className = '',
}: SearchResultsTemplateProps) {
  const resultSummary = totalResults !== undefined
    ? `${totalResults} ${totalResults === 1 ? 'result' : 'results'}${query ? ` for "${query}"` : ''}`
    : query ? `Results for "${query}"` : null

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <PageHeader
        title={title}
        description={description ?? resultSummary ?? 'Find items across the workspace.'}
        breadcrumbs={breadcrumbs}
      />

      {/* Search Bar & Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchInput
              value={query}
              onChange={(val) => onQueryChange(val)}
              onClear={() => onQueryChange('')}
              placeholder={searchPlaceholder}
            />
          </div>
          {sortOptions && sortOptions.length > 0 && onSortChange && (
            <div className="w-full sm:w-48">
              <Select
                value={activeSort}
                onChange={(e) => onSortChange(e.target.value)}
                options={sortOptions}
                aria-label="Sort search results"
              />
            </div>
          )}
        </div>

        {filters && (
          <div className="flex items-center flex-wrap gap-2 pt-1">
            {filters}
          </div>
        )}
      </div>

      {/* Main Results / State Views */}
      {isLoading ? (
        <PageSkeletonState cardsCount={4} />
      ) : error ? (
        <ErrorState
          title="Search Failed"
          description={error}
          actionLabel={onRetry ? 'Retry search' : undefined}
          onAction={onRetry}
        />
      ) : totalResults === 0 ? (
        <EmptyState
          title="No search results"
          description={
            query
              ? `We couldn't find anything matching "${query}". Try adjusting your keywords or filters.`
              : 'Type a keyword above to begin searching.'
          }
          actionLabel={query ? 'Clear search' : undefined}
          onAction={query ? () => onQueryChange('') : undefined}
        />
      ) : (
        <div className="space-y-4">
          {children}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center sm:justify-end pt-4">
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                onPageChange={pagination.onPageChange}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
