/**
 * Escape a user-controlled string for safe interpolation into HTML.
 * Handles the five characters that matter: & < > " '
 * Use this for ANY string that comes from user input, IPFS metadata,
 * or any source the app does not fully control.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Escape an image URL and reject schemes other than HTTP(S), IPFS, or data:image. */
export function safeImageSrc(url: unknown): string {
  if (typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed)) return escapeHtml(trimmed)
  if (/^ipfs:\/\//i.test(trimmed)) return escapeHtml(trimmed)
  if (/^data:image\//i.test(trimmed)) return escapeHtml(trimmed)
  return ''
}
