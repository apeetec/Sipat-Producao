import React, { useState, forwardRef } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { TextField, TextFieldProps } from './TextField';

export interface PasswordFieldProps extends Omit<TextFieldProps, 'type' | 'rightElement'> {}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>((props, ref) => {
  const [show, setShow] = useState(false);

  return (
    <TextField
      {...props}
      ref={ref}
      type={show ? 'text' : 'password'}
      icon={props.icon || <Lock className="w-4 h-4" />}
      rightElement={
        <button
          type="button"
          onClick={() => setShow(prev => !prev)}
          className="inline-flex size-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1 cursor-pointer"
          aria-label={show ? 'Ocultar senha' : 'Exibir senha'}
          aria-pressed={show}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  );
});

PasswordField.displayName = 'PasswordField';
