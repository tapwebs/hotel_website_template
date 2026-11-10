interface BrandFooterProps {
  variant?: 'customer' | 'admin' | 'minimal' | string
  showCta?: boolean
  className?: string
}

/**
 * Shared footer component reused across all customer-facing pages and admin login.
 * Renders the official brand copyright statement with accessible, semantic links.
 */
export function BrandFooter({ className = '' }: BrandFooterProps) {
  const currentYear = new Date().getFullYear()

  return (
    <footer className={`py-6 text-center select-none ${className}`}>
      <p className="max-w-md mx-auto px-4 text-center text-2xs text-neutral-400 dark:text-neutral-500 leading-relaxed">
        © {currentYear}{' '}
        <a
          href="https://tapmenu.tapwebs.in"
          target="_blank"
          rel="noopener noreferrer"
          className="text-inherit no-underline hover:underline hover:text-[var(--customer-accent,#2563eb)] focus-visible:underline focus-visible:text-[var(--customer-accent,#2563eb)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--customer-accent,#2563eb)] transition-colors rounded-xs"
        >
          TapMenu
        </a>{' '}
        by{' '}
        <a
          href="https://tapwebs.in"
          target="_blank"
          rel="noopener noreferrer"
          className="text-inherit no-underline hover:underline hover:text-[var(--customer-accent,#2563eb)] focus-visible:underline focus-visible:text-[var(--customer-accent,#2563eb)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--customer-accent,#2563eb)] transition-colors rounded-xs"
        >
          TapWebs
        </a>
        . All rights reserved.
      </p>
    </footer>
  )
}
