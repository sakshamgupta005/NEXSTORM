'use client'

import * as React from 'react'
import { Globe, Check, ChevronDown } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface LanguageSwitcherProps {
  variant?: 'dropdown' | 'pills'
  className?: string
  'data-testid'?: string
}

export function LanguageSwitcher({
  variant = 'dropdown',
  className,
  'data-testid': testId,
}: LanguageSwitcherProps) {
  const { locale, setLocale, locales, currentLocaleMeta } = useI18n()
  const [isOpen, setIsOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close dropdown on Escape
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  if (variant === 'pills') {
    return (
      <div
        role="group"
        aria-label="Language options"
        className={cn('inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs', className)}
        data-testid={testId || 'language-switcher-pills'}
      >
        {locales.map((l) => {
          const isActive = locale === l.code
          return (
            <button
              key={l.code}
              type="button"
              aria-pressed={isActive}
              onClick={() => setLocale(l.code)}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1',
                isActive
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              )}
            >
              <span>{l.flag}</span>
              <span>{l.nativeName}</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      ref={menuRef}
      className={cn('relative inline-block text-left', className)}
      onKeyDown={handleKeyDown}
      data-testid={testId || 'language-switcher'}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Current language: ${currentLocaleMeta.name}. Select language`}
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-8 gap-2 text-xs font-medium"
      >
        <Globe className="h-3.5 w-3.5 text-slate-500" />
        <span className="flex items-center gap-1.5">
          <span>{currentLocaleMeta.flag}</span>
          <span>{currentLocaleMeta.nativeName}</span>
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 transition-transform duration-150', isOpen && 'rotate-180')} />
      </Button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Available languages"
          className="absolute right-0 mt-1.5 w-44 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg z-50 py-1"
        >
          {locales.map((l) => {
            const isSelected = locale === l.code
            return (
              <button
                key={l.code}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  setLocale(l.code)
                  setIsOpen(false)
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 text-xs text-left cursor-pointer transition-colors',
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                <span className="flex items-center gap-2">
                  <span>{l.flag}</span>
                  <span>{l.nativeName}</span>
                  <span className="text-slate-400 text-[10px]">({l.name})</span>
                </span>
                {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
