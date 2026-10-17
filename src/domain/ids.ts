/**
 * A unique id for every meso, week, day, exercise and set.
 *
 * crypto.randomUUID() only exists on "secure" pages (https, or localhost). If you
 * open a self-hosted copy over plain http on your home Wi-Fi (http://192.168.x.x)
 * the browser hides it, so fall back to building one from random bytes.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
