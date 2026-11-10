/** A random key for one basket. Sent as clientRequestId so a retried or double-tapped submit returns the original order. */
export function newRequestId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
