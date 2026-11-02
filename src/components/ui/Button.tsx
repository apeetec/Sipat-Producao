import React, { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'default'
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'destructive'
    | 'danger'
    | 'ghost'
    | 'link'
    | 'action';
  size?: 'default' | 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'default',
  size = 'default',
  loading = false,
  disabled,
  icon,
  className,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none active:scale-[0.98]';

  const sizeStyles = {
    default: 'h-9 px-4 py-2 text-sm max-sm:h-11',
    sm: 'h-8 rounded-md px-3 text-xs gap-1.5 max-sm:h-11',
    md: 'h-9 px-4 py-2 text-sm max-sm:h-11',
    lg: 'h-11 rounded-lg px-6 text-base gap-2.5',
    icon: 'size-9 p-0 max-sm:size-11',
  };

  const variantStyles = {
    default: 'bg-[var(--brand-primary)] text-white shadow-xs hover:bg-[var(--brand-primary-dark)] focus-visible:ring-[var(--brand-primary)]',
    primary: 'bg-[var(--brand-primary)] text-white shadow-xs hover:bg-[var(--brand-primary-dark)] focus-visible:ring-[var(--brand-primary)]',
    action: 'bg-[var(--brand-action)] text-white shadow-xs hover:brightness-95 active:brightness-90 focus-visible:ring-[var(--brand-action)] font-semibold',
    secondary: 'bg-slate-100 text-slate-800 shadow-xs hover:bg-slate-200 border border-slate-200 focus-visible:ring-slate-400',
    outline: 'border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-[var(--brand-primary)]',
    destructive: 'bg-red-600 text-white shadow-xs hover:bg-red-700 focus-visible:ring-red-500',
    danger: 'bg-red-600 text-white shadow-xs hover:bg-red-700 focus-visible:ring-red-500',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400',
    link: 'text-[var(--brand-primary)] underline-offset-4 hover:underline p-0 h-auto font-semibold',
  };

  return (
    <button
      disabled={disabled || loading}
      className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : icon}
      {children && <span>{children}</span>}
    </button>
  );
};
