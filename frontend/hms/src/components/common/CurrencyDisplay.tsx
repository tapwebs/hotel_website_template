import React from 'react';

interface CurrencyDisplayProps {
  amountPaise: number;
  currency?: string;
  className?: string;
  showDecimals?: boolean;
}

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  amountPaise,
  currency = 'INR',
  className = '',
  showDecimals = true
}) => {
  const rupees = showDecimals ? amountPaise / 100 : Math.round(amountPaise / 100);
  
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0
  }).format(rupees);

  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {formatted}
    </span>
  );
};
