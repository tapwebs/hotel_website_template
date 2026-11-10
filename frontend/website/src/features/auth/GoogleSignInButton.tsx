import type { SessionUser } from './authService'

export interface GoogleSignInButtonProps {
  mode?: 'signin' | 'signup'
  onSuccess: (user: SessionUser) => void
  onError?: (message: string) => void
  className?: string
}

/** Google Sign-In is completely disabled in the open-source release. */
export function GoogleSignInButton(_props: GoogleSignInButtonProps) {
  return null
}
