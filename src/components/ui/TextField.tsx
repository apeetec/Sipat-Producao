import React, { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, helperText, icon, rightElement, className, id, required, disabled, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>
              {label} {required && <span className="text-red-500">*</span>}
            </span>
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div
              className="pointer-events-none absolute inset-y-0 left-3 flex w-5 items-center justify-center text-slate-400 [&>svg]:shrink-0"
              aria-hidden="true"
            >
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            required={required}
            disabled={disabled}
            className={cn(
              'flex h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs transition-all duration-150',
              'file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:border-[var(--brand-primary)]',
              'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400',
              icon && 'pl-11',
              rightElement && 'pr-12',
              error && 'border-red-500 focus-visible:ring-red-400 focus-visible:border-red-500',
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute inset-y-0 right-1 flex items-center justify-center text-slate-400">
              {rightElement}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-red-600 font-medium" role="alert">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

TextField.displayName = 'TextField';
