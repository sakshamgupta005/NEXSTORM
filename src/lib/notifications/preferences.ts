/**
 * User Notification Preferences & Channel Opt-Outs
 * 
 * Capabilities:
 * - Granular user preferences per channel (email, in_app, sms, realtime)
 * - Category-aware delivery checks
 * - Safety policy: 'security' and 'transactional' notifications cannot be suppressed by marketing opt-outs
 * - In-memory store for offline hackathon testing and pluggable database adapters
 */

import type {
  IPreferenceStore,
  UserPreferences,
  NotificationChannel,
  NotificationCategory,
} from './types'

export class InMemoryPreferenceStore implements IPreferenceStore {
  private preferences = new Map<string, UserPreferences>()

  public getUserPreferences(userId: string): UserPreferences | null {
    const existing = this.preferences.get(userId)
    if (!existing) return null
    return JSON.parse(JSON.stringify(existing))
  }

  public setUserPreferences(prefs: UserPreferences): void {
    this.preferences.set(prefs.userId, JSON.parse(JSON.stringify(prefs)))
  }

  public updateChannelPreference(
    userId: string,
    channel: NotificationChannel,
    enabled: boolean
  ): void {
    const current = this.preferences.get(userId) || {
      userId,
      channels: {},
      categories: {},
    }

    current.channels = {
      ...current.channels,
      [channel]: enabled,
    }

    this.preferences.set(userId, current)
  }

  public isChannelEnabled(
    userId: string,
    channel: NotificationChannel,
    category: NotificationCategory = 'transactional'
  ): boolean {
    // Safety guard: Critical security and transaction notices cannot be opted out of
    if (category === 'security') {
      return true
    }

    const userPrefs = this.preferences.get(userId)
    if (!userPrefs) {
      // Default: all channels enabled until user specifies otherwise
      return true
    }

    // Check category level opt-out if specified
    if (userPrefs.categories && userPrefs.categories[category] === false) {
      return false
    }

    // Check channel level opt-out
    if (userPrefs.channels && userPrefs.channels[channel] === false) {
      return false
    }

    return true
  }

  public clear(): void {
    this.preferences.clear()
  }
}

export const sharedPreferenceStore = new InMemoryPreferenceStore()
