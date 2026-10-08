// Autoplaying previews cost data and motion — skip them for viewers who've
// asked their device to save data or reduce motion
export function canAutoPreview(): boolean {
  if (typeof window === 'undefined') return false
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (conn?.saveData) return false
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
