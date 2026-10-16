'use client'

import React from 'react'
import { PageHeader, BreadcrumbItem } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'

export interface SettingsSectionItem {
  id: string
  label: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
}

export interface SettingsPageTemplateProps {
  title?: React.ReactNode
  description?: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  sections: SettingsSectionItem[]
  activeSection: string
  onSectionChange: (id: string) => void
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function SettingsPageTemplate({
  title = 'Settings',
  description = 'Manage your account settings, workspace options, and preferences.',
  breadcrumbs,
  sections,
  activeSection,
  onSectionChange,
  actions,
  children,
  className = '',
}: SettingsPageTemplateProps) {
  const currentSection = sections.find((s) => s.id === activeSection)

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
        actions={actions}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Navigation Column */}
        <nav aria-label="Settings navigation" className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon
            const isActive = activeSection === section.id
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionChange(section.id)}
                aria-current={isActive ? 'true' : undefined}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                <div className="min-w-0 flex-1 truncate">
                  <div className="truncate">{section.label}</div>
                  {section.description && (
                    <div className="text-xs text-slate-400 font-normal truncate">
                      {section.description}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </nav>

        {/* Section Content Column */}
        <div className="md:col-span-3 min-w-0">
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <CardContent className="p-6 sm:p-8 space-y-6">
              {currentSection && (
                <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {currentSection.label}
                  </h2>
                  {currentSection.description && (
                    <p className="text-xs text-slate-500 mt-1">
                      {currentSection.description}
                    </p>
                  )}
                </div>
              )}
              {children}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
