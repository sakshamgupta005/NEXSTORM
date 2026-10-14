'use client'

import React from 'react'
import { PageHeader, BreadcrumbItem } from '@/components/layout/page-header'
import { SearchInput } from '@/components/ui/search-input'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState, ErrorState, PageSkeletonState } from '@/components/ui/state-views'
import { Button } from '@/components/ui/button'

export interface ListPageTemplateProps {
  title: React.ReactNode
  description?: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  primaryAction?: {
    label: string
    onClick?: () => void
    href?: string
    icon?: React.ComponentType<{ className?: string }>
  }
  searchQuery?: string
  onSearchChange?: (query: string) => void
  searchPlaceholder?: string
  filterSlot?: React.ReactNode
  actionsSlot?: React.ReactNode
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  isEmpty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyActionLabel?: string
  onEmptyAction?: () => void
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

export function ListPageTemplate({
  title,
  description,
  breadcrumbs,
  primaryAction,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  filterSlot,
  actionsSlot,
  isLoading = false,
  error = null,
  onRetry,
  isEmpty = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items matching your criteria.',
  emptyActionLabel,
  onEmptyAction,
  pagination,
  children,
  className = '',
}: ListPageTemplateProps) {
  const PrimaryActionIcon = primaryAction?.icon

  const headerActions = (
    <div className="flex items-center gap-2">
      {primaryAction && (
        <Button
          onClick={primaryAction.onClick}
          className="flex items-center gap-2"
        >
          {PrimaryActionIcon && <PrimaryActionIcon className="h-4 w-4" />}
          <span>{primaryAction.label}</span>
        </Button>
      )}
      {actionsSlot}
    </div>
  )

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
        actions={headerActions}
      />

      {/* Toolbar: Search & Filters */}
      {(onSearchChange || filterSlot) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {onSearchChange && (
            <div className="w-full sm:w-72">
              <SearchInput
                value={searchQuery ?? ''}
                onChange={(val) => onSearchChange(val)}
                onClear={() => onSearchChange('')}
                placeholder={searchPlaceholder}
              />
            </div>
          )}
          {filterSlot && (
            <div className="flex items-center flex-wrap gap-2">
              {filterSlot}
            </div>
          )}
        </div>
      )}

      {/* Main State Views / Content */}
      {isLoading ? (
        <PageSkeletonState cardsCount={4} />
      ) : error ? (
        <ErrorState
          title="Failed to load items"
          description={error}
          actionLabel={onRetry ? 'Retry' : undefined}
          onAction={onRetry}
        />
      ) : isEmpty ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyActionLabel ?? primaryAction?.label}
          onAction={onEmptyAction ?? primaryAction?.onClick}
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
