/**
 * Simple UUID generator for request IDs and message IDs
 * In a production app, you might want to use a more robust library like 'uuid'
 */
export function generateUUID(): string {
  // Simple UUID v4-like generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Alternative: If you prefer a shorter ID for demo purposes
 */
export function generateShortId(): string {
  return Math.random().toString(36).substr(2, 9)
}