/**
 * Clipboard utilities with fallback for HTTP/non-secure contexts.
 *
 * `navigator.clipboard` is only available in secure contexts (HTTPS or localhost).
 * This module provides a robust `copyToClipboard` that falls back to
 * `document.execCommand('copy')` when the modern API is unavailable.
 */

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    // Fallback for HTTP/non-secure contexts
    const el = document.createElement('textarea')
    el.value = text
    el.style.cssText = 'position:fixed;opacity:0;pointer-events:none;'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

export function isClipboardSupported(): boolean {
  return 'clipboard' in navigator
}
