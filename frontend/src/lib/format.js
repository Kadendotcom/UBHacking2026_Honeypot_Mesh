export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// "s007" → "EH-0007", like a star catalogue number
export function catalogueId(id) {
  const digits = String(id).replace(/\D/g, '')
  return digits ? `EH-${digits.padStart(4, '0')}` : `EH-${id}`
}

// How long ago a time was: "3m ago", "2h ago"
export function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString)) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
