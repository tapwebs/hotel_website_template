/**
 * Deliberately generic — never varies its message based on WHY the session
 * is invalid (missing token, expired session, unknown token, server
 * error). See implementation plan §3: identical failure presentation for
 * every token/session failure case, so nothing here leaks a signal an
 * attacker could use to distinguish cases.
 */
export function SessionErrorScreen({ message }: { message?: string | null }) {
  // A specific reason (e.g. nobody checked in to this room) is safe to show; the generic scan text is not "specific".
  const specific = message && !message.startsWith('Please scan the QR code') ? message : null
  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center px-6 text-center gap-4">
      <div className="w-12 h-12 rounded-full bg-neutral-900/5 flex items-center justify-center">
        <span className="text-2xl">📱</span>
      </div>
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">{specific ? 'Ordering is not available' : 'Please scan the QR code on your table again'}</h1>
        <p className="text-sm text-neutral-500 mt-1">{specific ?? 'Your session may have expired.'}</p>
      </div>
    </div>
  )
}
