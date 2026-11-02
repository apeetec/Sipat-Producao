import * as React from 'react';
import { cn } from '../../lib/utils';
import { DatePicker } from './date-picker';

type DateTimePickerProps = {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
};

export function DateTimePicker({ id, label, value, onChange, required, disabled, error, className }: DateTimePickerProps) {
  const [date = '', time = '00:00'] = value.split('T');
  const baseId = id ?? React.useId();
  const updateDate = (nextDate: string) => onChange(`${nextDate}T${time || '00:00'}`);
  const updateTime = (nextTime: string) => onChange(`${date}T${nextTime}`);

  return (
    <fieldset className={cn('space-y-1.5', className)} disabled={disabled}>
      <legend className="mb-1.5 text-xs font-semibold text-slate-700">
        {label}{required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <DatePicker
          id={`${baseId}-date`}
          value={date}
          onChange={updateDate}
          required={required}
          disabled={disabled}
        />
        <input
          id={`${baseId}-time`}
          type="time"
          value={time}
          onChange={event => updateTime(event.target.value)}
          required={required}
          disabled={disabled || !date}
          aria-label={`Horário de ${label.toLowerCase()}`}
          aria-invalid={Boolean(error)}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-xs outline-none focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </fieldset>
  );
}
