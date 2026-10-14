/**
 * Persistent In-App Notifications Store
 * 
 * Capabilities:
 * - In-app notification creation and user inbox querying
 * - Unread filtering and pagination (limit/offset)
 * - Individual and batch mark-as-read operations
 * - Fast unread count aggregation
 * - In-memory implementation for local development, easily backing to PostgreSQL/Supabase
 */

import type { IInAppStore, InAppNotification } from './types'

export class InMemoryInAppStore implements IInAppStore {
  private notifications = new Map<string, InAppNotification>()

  public create(notification: InAppNotification): InAppNotification {
    const copy = JSON.parse(JSON.stringify(notification))
    this.notifications.set(notification.id, copy)
    return copy
  }

  public listForUser(
    userId: string,
    options: { unreadOnly?: boolean; limit?: number; offset?: number } = {}
  ): InAppNotification[] {
    const limit = Math.max(1, options.limit ?? 50)
    const offset = Math.max(0, options.offset ?? 0)

    const userItems = Array.from(this.notifications.values())
      .filter((n) => n.userId === userId)
      .filter((n) => (options.unreadOnly ? !n.read : true))
      .sort((a, b) => b.createdAt - a.createdAt)

    return userItems.slice(offset, offset + limit)
  }

  public markAsRead(id: string, userId: string): boolean {
    const item = this.notifications.get(id)
    if (!item || item.userId !== userId) {
      return false
    }

    item.read = true
    item.readAt = Date.now()
    return true
  }

  public markAllAsRead(userId: string): number {
    let count = 0
    const now = Date.now()

    for (const item of this.notifications.values()) {
      if (item.userId === userId && !item.read) {
        item.read = true
        item.readAt = now
        count++
      }
    }

    return count
  }

  public getUnreadCount(userId: string): number {
    let unread = 0
    for (const item of this.notifications.values()) {
      if (item.userId === userId && !item.read) {
        unread++
      }
    }
    return unread
  }

  public delete(id: string, userId: string): boolean {
    const item = this.notifications.get(id)
    if (!item || item.userId !== userId) {
      return false
    }
    return this.notifications.delete(id)
  }

  public clear(): void {
    this.notifications.clear()
  }
}

export const sharedInAppStore = new InMemoryInAppStore()
