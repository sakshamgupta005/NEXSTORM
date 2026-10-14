'use client'

import React, { useState } from 'react'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { Button } from '@/components/ui/button'

interface PwaInstallerProps {
  className?: string
}

export function PwaInstaller({ className = '' }: PwaInstallerProps) {
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall()
  const [isPrompting, setIsPrompting] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (isInstalled || !isInstallable || dismissed) {
    return null
  }

  const handleInstall = async () => {
    setIsPrompting(true)
    try {
      await promptInstall()
    } finally {
      setIsPrompting(false)
    }
  }

  return (
    <div
      role="region"
      aria-label="Install App"
      className={`p-4 bg-card rounded-lg border border-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </div>
        <div>
          <h4 className="font-semibold text-sm text-foreground">Install App</h4>
          <p className="text-xs text-muted-foreground">
            Install this application to your device home screen for offline access and quick launching.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissed(true)}
          className="text-xs text-muted-foreground"
        >
          Later
        </Button>
        <Button
          size="sm"
          onClick={handleInstall}
          disabled={isPrompting}
          className="text-xs"
        >
          {isPrompting ? 'Installing...' : 'Install'}
        </Button>
      </div>
    </div>
  )
}
