import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'gold';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none rounded-md cursor-pointer';

  const variantStyles = {
    primary: 'bg-burgundy text-ivory hover:bg-burgundy-deep active:bg-burgundy-deep focus-visible:ring-burgundy shadow-sm',
    secondary: 'bg-gold-soft text-ink hover:bg-gold-soft/80 active:bg-gold-soft focus-visible:ring-gold',
    outline: 'border border-input bg-ivory text-walnut hover:bg-gold-soft/30 active:bg-gold-soft/50 focus-visible:ring-burgundy shadow-xs',
    ghost: 'text-walnut hover:bg-gold-soft/40 hover:text-burgundy-deep active:bg-gold-soft/60 focus-visible:ring-burgundy',
    destructive: 'bg-rose-600 text-ivory hover:bg-rose-700 active:bg-rose-700 focus-visible:ring-rose-500 shadow-sm',
    gold: 'bg-burgundy text-ivory hover:bg-burgundy-deep active:bg-burgundy-deep focus-visible:ring-gold shadow-[0_6px_16px_-10px_rgb(74_17_27/0.8)] font-semibold tracking-wide'
  };


  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5 h-8 pointer-coarse:h-10',
    md: 'text-sm px-4 py-2 gap-2 h-10',
    lg: 'text-base px-6 py-2.5 gap-2.5 h-12',
    icon: 'h-9 w-9 p-0 pointer-coarse:h-10 pointer-coarse:w-10'
  };

  return (
    <button
      className={twMerge(clsx(baseStyles, variantStyles[variant], sizeStyles[size], className))}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
};
