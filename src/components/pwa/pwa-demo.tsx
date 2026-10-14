'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { OfflineBanner } from './offline-banner'
import { PwaInstaller } from './pwa-installer'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { useOfflineQueue } from '@/hooks/use-offline-queue'
import { isPwaEnabled } from '@/lib/pwa/config'
import { offlineStorage } from '@/lib/pwa/indexed-db'
import { registerServiceWorker } from '@/lib/pwa/service-worker'

interface StorageItem {
  key: string
  value: string
}

export function PwaDemo() {
  const { isOnline } = useNetworkStatus()
  const { isInstallable, isInstalled } = usePwaInstall()
  const { queue, pendingCount, enqueue, processQueue, clearQueue } = useOfflineQueue()

  const pwaConfigEnabled = isPwaEnabled()
  const [swStatus, setSwStatus] = useState<string>(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return 'Not supported by this browser'
    }
    return 'Checking...'
  })

  // IndexedDB demo state
  const [dbKey, setDbKey] = useState('')
  const [dbVal, setDbVal] = useState('')
  const [storedItems, setStoredItems] = useState<StorageItem[]>([])

  // Queue demo state
  const [actionTitle, setActionTitle] = useState('')
  const [syncStatusMsg, setSyncStatusMsg] = useState('')

  const refreshStorageItems = React.useCallback(async () => {
    try {
      const keys = ['demo_user_draft', 'demo_cached_profile', 'demo_theme_setting']
      const items: StorageItem[] = []
      for (const k of keys) {
        const val = await offlineStorage.get<string>(k)
        if (val !== undefined) {
          items.push({ key: k, value: String(val) })
        }
      }
      setStoredItems(items)
    } catch {
      // fallback
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          setSwStatus(`Active (Scope: ${reg.scope})`)
        } else {
          setSwStatus('Not registered (PWA toggle is off or uninstalled)')
        }
      })
    }

    const timer = setTimeout(() => {
      refreshStorageItems()
    }, 0)

    return () => clearTimeout(timer)
  }, [refreshStorageItems])

  const handleSaveToDb = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dbKey.trim() || !dbVal.trim()) return
    await offlineStorage.set(dbKey.trim(), dbVal.trim())
    setDbKey('')
    setDbVal('')
    await refreshStorageItems()
  }

  const handleDeleteDbItem = async (key: string) => {
    await offlineStorage.delete(key)
    await refreshStorageItems()
  }

  const handleQueueAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!actionTitle.trim()) return

    await enqueue({
      url: '/api/v1/mock-sync',
      method: 'POST',
      body: { title: actionTitle.trim(), timestamp: Date.now() },
    })

    setActionTitle('')
    setSyncStatusMsg('Action queued in local storage.')
    setTimeout(() => setSyncStatusMsg(''), 4000)
  }

  const handleManualSync = async () => {
    setSyncStatusMsg('Syncing queued actions...')
    const result = await processQueue()
    setSyncStatusMsg(
      `Sync completed: ${result.succeeded} succeeded, ${result.failed} failed of ${result.processed} processed.`
    )
    setTimeout(() => setSyncStatusMsg(''), 5000)
  }

  const handleRegisterSw = async () => {
    const res = await registerServiceWorker()
    if (res.registered) {
      setSwStatus('Registered successfully')
    } else {
      setSwStatus(`Unregistered / Inactive: ${res.reason || 'Disabled'}`)
    }
  }

  return (
    <div className="space-y-6">
      <OfflineBanner />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            PWA &amp; Offline Support Toolkit
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Modular Progressive Web App foundation with Service Worker caching, IndexedDB local persistence, and offline action synchronization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={isOnline ? 'default' : 'danger'} className="text-xs">
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
          <Badge variant={pwaConfigEnabled ? 'secondary' : 'outline'} className="text-xs">
            {pwaConfigEnabled ? 'PWA Flag Enabled' : 'PWA Flag Default (Off)'}
          </Badge>
        </div>
      </div>

      <PwaInstaller />

      {/* Grid: Status & SW Lifecycle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PWA &amp; Service Worker Lifecycle</CardTitle>
            <CardDescription>
              Service worker registration is strictly controlled by environment variables.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-2">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">PWA Feature Toggle:</span>
                <span className="font-mono text-xs">{pwaConfigEnabled ? 'true' : 'false (default)'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Service Worker State:</span>
                <span className="font-mono text-xs text-primary">{swStatus}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">App Install State:</span>
                <span className="text-xs">
                  {isInstalled ? 'Installed / Standalone' : isInstallable ? 'Install Available' : 'Browser Mode'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Web App Manifest:</span>
                <a
                  href="/manifest.webmanifest"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  /manifest.webmanifest &rarr;
                </a>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRegisterSw}
              className="w-full text-xs"
            >
              Check / Trigger Service Worker Registration
            </Button>
          </CardContent>
        </Card>

        {/* Security & Route Isolation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Security &amp; Cache Exclusion</CardTitle>
            <CardDescription>
              Sensitive authenticated traffic is strictly excluded from service worker caches.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="p-3 bg-muted/50 rounded-md border border-border/50 space-y-2 text-xs">
              <div className="font-semibold text-foreground">Excluded URL Prefixes (NetworkOnly):</div>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground font-mono">
                <li>/api/* &mdash; Dynamic backend endpoints</li>
                <li>/auth/* &mdash; Authentication flows &amp; cookies</li>
                <li>*.supabase.co &mdash; Database sessions &amp; tokens</li>
                <li>/dashboard/admin &mdash; Sensitive administrative views</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              Service workers will never intercept or cache private JWT tokens or user identities.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grid: IndexedDB Client Storage & Offline Action Queue */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* IndexedDB Client Storage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">IndexedDB Offline Storage</CardTitle>
            <CardDescription>
              Structured, client-side storage for local offline states and drafts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSaveToDb} className="flex gap-2">
              <Input
                placeholder="Key (e.g. demo_user_draft)"
                value={dbKey}
                onChange={(e) => setDbKey(e.target.value)}
                className="text-xs h-8"
              />
              <Input
                placeholder="Value..."
                value={dbVal}
                onChange={(e) => setDbVal(e.target.value)}
                className="text-xs h-8"
              />
              <Button type="submit" size="sm" className="text-xs h-8 shrink-0">
                Save
              </Button>
            </form>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">Stored Items:</div>
              {storedItems.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No demo entries in IndexedDB yet.</p>
              ) : (
                <div className="divide-y divide-border border rounded-md">
                  {storedItems.map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-2 text-xs">
                      <div>
                        <span className="font-semibold font-mono">{item.key}:</span>{' '}
                        <span className="text-muted-foreground">{item.value}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDbItem(item.key)}
                        className="h-6 px-2 text-[10px] text-destructive hover:bg-destructive/10"
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Offline Action Queue */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Offline Action Queue &amp; Auto-Sync</CardTitle>
            <CardDescription>
              Queue mutations with idempotency keys when offline, auto-retry on reconnect.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleQueueAction} className="flex gap-2">
              <Input
                placeholder="Simulate offline action (e.g. Create Note)"
                value={actionTitle}
                onChange={(e) => setActionTitle(e.target.value)}
                className="text-xs h-8"
              />
              <Button type="submit" size="sm" className="text-xs h-8 shrink-0">
                Queue
              </Button>
            </form>

            {syncStatusMsg && (
              <p className="text-xs text-primary font-medium animate-fadeIn">{syncStatusMsg}</p>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Queued Actions ({queue.length}):
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualSync}
                    disabled={queue.length === 0}
                    className="h-6 px-2 text-[10px]"
                  >
                    Sync Now ({pendingCount})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearQueue}
                    disabled={queue.length === 0}
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                  >
                    Clear All
                  </Button>
                </div>
              </div>

              {queue.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Queue is empty.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 border rounded-md p-2">
                  {queue.map((act) => (
                    <div
                      key={act.id}
                      className="p-2 rounded bg-muted/40 text-xs flex items-center justify-between gap-2 border border-border/50"
                    >
                      <div className="truncate">
                        <span className="font-semibold">{act.method}</span>{' '}
                        <span className="text-muted-foreground font-mono">{act.url}</span>
                        <div className="text-[10px] text-muted-foreground truncate">
                          Idemp: {act.idempotencyKey.slice(0, 16)}...
                        </div>
                      </div>
                      <Badge
                        variant={
                          act.status === 'synced'
                            ? 'default'
                            : act.status === 'syncing'
                            ? 'secondary'
                            : act.status === 'failed'
                            ? 'danger'
                            : 'outline'
                        }
                        className="text-[10px] uppercase h-5"
                      >
                        {act.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
