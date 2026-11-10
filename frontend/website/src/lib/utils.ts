import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Page gutter + max width used by every section. */
export const container = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8'
/** Inline text link style. */
export const inlineLink = 'font-semibold text-burgundy underline underline-offset-4'
