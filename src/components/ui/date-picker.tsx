import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

type DatePickerProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
};

function parseCalendarValue(value: string) {
  if (!value) return undefined;
  const date = parseISO(`${value}T12:00:00`);
  return isValid(date) ? date : undefined;
}

export function DatePicker({
  id,
  label,
  value,
  onChange,
  placeholder = 'Selecione uma data',
  required,
  disabled,
  error,
  className,
}: DatePickerProps) {
  const selected = parseCalendarValue(value);
  const inputId = id ?? React.useId();

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700">
          {label}{required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
        </label>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={inputId}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-required={required}
            aria-invalid={Boolean(error)}
            icon={<CalendarIcon className="size-4 shrink-0" aria-hidden="true" />}
            className={cn(
              'h-11 w-full min-w-0 justify-start gap-2.5 px-3 text-left font-normal [&>span]:truncate',
              !selected && 'text-slate-500',
              error && 'border-red-500 focus-visible:ring-red-400',
            )}
          >
            {selected ? format(selected, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={date => date && onChange(format(date, 'yyyy-MM-dd'))}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}
