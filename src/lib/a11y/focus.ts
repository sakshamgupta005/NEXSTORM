/**
 * Keyboard focus management utilities for modals, drawers, and menus.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]',
  '[tabindex]:not([tabindex^="-"])',
].join(', ')

/**
 * Returns all focusable elements within a container element.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  if (!container) return []

  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  )

  return elements.filter((el) => {
    // Filter out hidden elements
    return (
      el.offsetWidth > 0 ||
      el.offsetHeight > 0 ||
      el.getClientRects().length > 0 ||
      window.getComputedStyle(el).visibility !== 'hidden'
    )
  })
}

/**
 * Traps Tab and Shift+Tab key events within a dialog or modal container.
 */
export function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return

  const focusables = getFocusableElements(container)
  if (focusables.length === 0) {
    event.preventDefault()
    return
  }

  const firstFocusable = focusables[0]
  const lastFocusable = focusables[focusables.length - 1]

  if (event.shiftKey) {
    // Shift + Tab moving backwards
    if (document.activeElement === firstFocusable) {
      lastFocusable.focus()
      event.preventDefault()
    }
  } else {
    // Tab moving forwards
    if (document.activeElement === lastFocusable) {
      firstFocusable.focus()
      event.preventDefault()
    }
  }
}
