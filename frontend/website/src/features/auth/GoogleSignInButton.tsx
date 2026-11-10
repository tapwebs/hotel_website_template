import { useEffect, useRef, useState } from 'react'
import { googleClientId, signInWithGoogle, authErrorMessage, type SessionUser } from './authService'

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential?: string }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon'
              theme?: 'outline' | 'filled_blue' | 'filled_black'
              size?: 'large' | 'medium' | 'small'
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
              shape?: 'rectangular' | 'pill' | 'circle' | 'square'
              logo_alignment?: 'left' | 'center'
              width?: number | string
            },
          ) => void
          prompt?: () => void
        }
      }
    }
  }
}

interface GoogleSignInButtonProps {
  mode?: 'signin' | 'signup'
  onSuccess: (user: SessionUser) => void
  onError?: (message: string) => void
  className?: string
}

let globalGsiClientId: string | null = null
let activeGsiCallback: ((response: { credential?: string }) => void) | null = null

export function GoogleSignInButton({ mode = 'signin', onSuccess, onError, className }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const clientId = googleClientId()

  const successRef = useRef(onSuccess)
  const errorRef = useRef(onError)
  const inFlightRef = useRef(false)

  useEffect(() => {
    successRef.current = onSuccess
    errorRef.current = onError
  })

  activeGsiCallback = async (response: { credential?: string }) => {
    if (inFlightRef.current) return
    if (!response.credential) {
      const msg = 'Google sign-in did not return a credential.'
      setError(msg)
      errorRef.current?.(msg)
      return
    }
    inFlightRef.current = true
    setLoading(true)
    setError(null)
    try {
      const res = await signInWithGoogle(response.credential)
      if (res.ok && res.user) {
        successRef.current(res.user)
      } else if (!res.ok) {
        const msg =
          res.code === 'AUTH_NOT_CONFIGURED'
            ? 'Authentication service is not configured.'
            : authErrorMessage[res.code] ?? 'Google sign-in failed. Please try again.'
        setError(msg)
        errorRef.current?.(msg)
      }
    } catch {
      const msg = 'Unable to reach the server. Please try again.'
      setError(msg)
      errorRef.current?.(msg)
    } finally {
      inFlightRef.current = false
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!clientId) return

    let cancelled = false

    const renderBtn = () => {
      if (cancelled || !containerRef.current || !window.google?.accounts?.id) return
      try {
        if (globalGsiClientId !== clientId) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (res) => {
              activeGsiCallback?.(res)
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          })
          globalGsiClientId = clientId
        }

        containerRef.current.innerHTML = ''
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: mode === 'signup' ? 'signup_with' : 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: containerRef.current.offsetWidth || 320,
        })
      } catch {
        // Fall back gracefully
      }
    }

    if (window.google?.accounts?.id) {
      renderBtn()
    } else {
      const script =
        document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]') ??
        document.createElement('script')
      if (!script.src) {
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.defer = true
        document.head.appendChild(script)
      }
      script.addEventListener('load', renderBtn)
      return () => {
        cancelled = true
        script.removeEventListener('load', renderBtn)
      }
    }

    return () => {
      cancelled = true
    }
  }, [clientId, mode])

  if (!clientId) {
    return null
  }

  return (
    <div className={className ?? 'flex flex-col items-center gap-2'}>
      <div
        ref={containerRef}
        className="flex min-h-[44px] w-full items-center justify-center overflow-hidden rounded-md [&>iframe]:!w-full [&>iframe]:!max-w-full"
        aria-label={mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}
      />
      {loading && (
        <p className="text-center text-xs text-muted-foreground animate-pulse" aria-live="polite">
          Signing in with Google…
        </p>
      )}
      {error && (
        <p role="alert" className="text-center text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
