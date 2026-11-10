import { useEffect, useState } from 'react'
import { Link } from 'react-router'

const STORAGE_KEY = 'dh_cookie_consent'

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Only show if user has not made a choice yet
    try {
      const consent = localStorage.getItem(STORAGE_KEY)
      if (!consent) {
        setVisible(true)
      }
    } catch {
      // LocalStorage inaccessible (e.g. strict sandbox)
    }
  }, [])

  const handleChoice = (accepted: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, accepted ? 'accepted' : 'declined')
      if (accepted) {
        window.dispatchEvent(new CustomEvent('cookie_consent_accepted'))
      }
    } catch {
      // Ignore
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Cookie consent banner"
      className="fixed bottom-0 inset-x-0 z-50 p-4 bg-slate-900/95 backdrop-blur border-t border-gold-primary/30 text-slate-100 shadow-2xl transition-all duration-300"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-sm leading-relaxed text-slate-300 max-w-4xl">
          <p>
            We use essential cookies to ensure secure reservations and authentication. With your permission, we also use anonymized analytics to improve your experience in compliance with India’s Digital Personal Data Protection (DPDP) Act, 2023. Review our{' '}
            <Link
              to="/privacy-policy"
              className="text-gold-light underline underline-offset-4 hover:text-white"
            >
              Privacy Policy
            </Link>{' '}
            for complete details.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={() => handleChoice(false)}
            className="px-4 py-2 text-xs font-medium tracking-wide uppercase rounded border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white transition-colors"
          >
            Essential Only
          </button>
          <button
            type="button"
            onClick={() => handleChoice(true)}
            className="px-5 py-2 text-xs font-semibold tracking-wide uppercase rounded bg-gold-primary hover:bg-gold-light text-slate-950 shadow-md transition-colors"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  )
}
