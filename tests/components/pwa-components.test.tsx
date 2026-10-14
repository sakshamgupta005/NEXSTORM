import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OfflineBanner } from '@/components/pwa/offline-banner'
import { PwaInstaller } from '@/components/pwa/pwa-installer'
import { PwaDemo } from '@/components/pwa/pwa-demo'
import * as networkHook from '@/hooks/use-network-status'
import * as installHook from '@/hooks/use-pwa-install'
import * as queueHook from '@/hooks/use-offline-queue'

describe('PWA & Offline Support Toolkit - Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('OfflineBanner', () => {
    it('does not render when user is online and has no pending actions', () => {
      vi.spyOn(networkHook, 'useNetworkStatus').mockReturnValue({
        isOnline: true,
        wasOffline: false,
      })
      vi.spyOn(queueHook, 'useOfflineQueue').mockReturnValue({
        queue: [],
        pendingCount: 0,
        enqueue: vi.fn(),
        processQueue: vi.fn(),
        clearQueue: vi.fn(),
      })

      const { container } = render(<OfflineBanner />)
      expect(container.firstChild).toBeNull()
    })

    it('renders alert when user is offline', () => {
      vi.spyOn(networkHook, 'useNetworkStatus').mockReturnValue({
        isOnline: false,
        wasOffline: false,
      })
      vi.spyOn(queueHook, 'useOfflineQueue').mockReturnValue({
        queue: [],
        pendingCount: 0,
        enqueue: vi.fn(),
        processQueue: vi.fn(),
        clearQueue: vi.fn(),
      })

      render(<OfflineBanner />)
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByText(/You are currently offline/i)).toBeInTheDocument()
    })

    it('renders sync prompt button when online but actions are pending', () => {
      const mockProcessQueue = vi.fn()
      vi.spyOn(networkHook, 'useNetworkStatus').mockReturnValue({
        isOnline: true,
        wasOffline: true,
      })
      vi.spyOn(queueHook, 'useOfflineQueue').mockReturnValue({
        queue: [],
        pendingCount: 2,
        enqueue: vi.fn(),
        processQueue: mockProcessQueue,
        clearQueue: vi.fn(),
      })

      render(<OfflineBanner />)
      expect(screen.getByText(/2 actions queued for sync/i)).toBeInTheDocument()
      const syncBtn = screen.getByRole('button', { name: /Sync Now/i })
      expect(syncBtn).toBeInTheDocument()

      fireEvent.click(syncBtn)
      expect(mockProcessQueue).toHaveBeenCalled()
    })
  })

  describe('PwaInstaller', () => {
    it('does not render when app is already installed or not installable', () => {
      vi.spyOn(installHook, 'usePwaInstall').mockReturnValue({
        isInstallable: false,
        isInstalled: true,
        promptInstall: vi.fn(),
      })

      const { container } = render(<PwaInstaller />)
      expect(container.firstChild).toBeNull()
    })

    it('renders install prompt and triggers promptInstall on button click', async () => {
      const mockPrompt = vi.fn().mockResolvedValue(true)
      vi.spyOn(installHook, 'usePwaInstall').mockReturnValue({
        isInstallable: true,
        isInstalled: false,
        promptInstall: mockPrompt,
      })

      render(<PwaInstaller />)
      expect(screen.getByRole('region', { name: /Install App/i })).toBeInTheDocument()

      const installBtn = screen.getByRole('button', { name: 'Install' })
      fireEvent.click(installBtn)

      await waitFor(() => {
        expect(mockPrompt).toHaveBeenCalled()
      })
    })

    it('dismisses install prompt when Later is clicked', () => {
      vi.spyOn(installHook, 'usePwaInstall').mockReturnValue({
        isInstallable: true,
        isInstalled: false,
        promptInstall: vi.fn(),
      })

      render(<PwaInstaller />)
      const laterBtn = screen.getByRole('button', { name: 'Later' })
      fireEvent.click(laterBtn)

      expect(screen.queryByRole('region', { name: /Install App/i })).toBeNull()
    })
  })

  describe('PwaDemo Component', () => {
    it('renders PwaDemo and all sub-sections', async () => {
      vi.spyOn(networkHook, 'useNetworkStatus').mockReturnValue({
        isOnline: true,
        wasOffline: false,
      })
      vi.spyOn(installHook, 'usePwaInstall').mockReturnValue({
        isInstallable: false,
        isInstalled: false,
        promptInstall: vi.fn(),
      })
      vi.spyOn(queueHook, 'useOfflineQueue').mockReturnValue({
        queue: [],
        pendingCount: 0,
        enqueue: vi.fn(),
        processQueue: vi.fn(),
        clearQueue: vi.fn(),
      })

      render(<PwaDemo />)

      await waitFor(() => {
        expect(screen.getByText('PWA & Offline Support Toolkit')).toBeInTheDocument()
        expect(screen.getByText('IndexedDB Offline Storage')).toBeInTheDocument()
        expect(screen.getByText(/Offline Action Queue/i)).toBeInTheDocument()
        expect(screen.getByText('Security & Cache Exclusion')).toBeInTheDocument()
      })
    })
  })
})
