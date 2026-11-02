import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { ptBR } from 'date-fns/locale';
import { cn } from '../../lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, locale = ptBR, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={locale}
      className={cn('p-1', className)}
      classNames={{
        months: 'flex flex-col gap-4',
        month: 'space-y-4',
        month_caption: 'relative flex h-8 items-center justify-center',
        caption_label: 'text-sm font-medium capitalize',
        nav: 'absolute inset-x-0 top-0 flex items-center justify-between',
        button_previous: 'inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white p-0 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600',
        button_next: 'inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white p-0 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600',
        month_grid: 'w-full border-collapse space-y-1',
        weekdays: 'flex',
        weekday: 'w-9 rounded-md text-center text-[0.8rem] font-normal text-slate-500',
        week: 'mt-2 flex w-full',
        day: 'relative size-9 p-0 text-center text-sm focus-within:relative focus-within:z-20',
        day_button: 'inline-flex size-9 items-center justify-center rounded-md p-0 font-normal hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 aria-selected:opacity-100',
        selected: 'rounded-md bg-[#028056] text-white hover:bg-[#015237] focus:bg-[#028056]',
        today: 'rounded-md bg-slate-100 text-slate-900',
        outside: 'text-slate-400 opacity-50 aria-selected:bg-slate-100 aria-selected:text-slate-500',
        disabled: 'text-slate-400 opacity-50',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => orientation === 'left'
          ? <ChevronLeft className="size-4" />
          : <ChevronRight className="size-4" />,
      }}
      {...props}
    />
  );
}

Calendar.displayName = 'Calendar';

export { Calendar };
