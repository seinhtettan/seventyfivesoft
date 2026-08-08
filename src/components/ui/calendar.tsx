import { DayPicker } from 'react-day-picker'
import type { ComponentProps } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CalendarProps = ComponentProps<typeof DayPicker>

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-1', className)}
      classNames={{
        months: 'relative flex flex-col gap-6 sm:flex-row',
        month: 'w-full space-y-4',
        month_caption: 'flex h-9 items-center justify-center',
        caption_label: 'font-serif text-lg tracking-wide text-brown',
        nav: 'absolute inset-x-0 top-0 flex h-9 items-center justify-between',
        button_previous:
          'z-10 grid size-8 place-items-center rounded-full text-brown-soft transition-colors hover:bg-cream-deep disabled:opacity-30',
        button_next:
          'z-10 grid size-8 place-items-center rounded-full text-brown-soft transition-colors hover:bg-cream-deep disabled:opacity-30',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday:
          'w-9 flex-1 text-[0.625rem] font-medium uppercase tracking-[0.14em] text-brown-faint',
        weeks: '',
        week: 'mt-1.5 flex w-full',
        day: 'group relative flex-1 p-0 text-center text-sm',
        day_button: cn(
          'mx-auto grid size-9 place-items-center rounded-full font-sans text-sm text-brown transition-all',
          'hover:bg-blush-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/50',
          'disabled:pointer-events-none disabled:opacity-30',
        ),
        selected:
          '[&>button]:bg-sage-deep [&>button]:text-white [&>button]:hover:bg-sage-deep [&>button]:shadow-[0_6px_14px_-8px_rgba(127,151,121,1)]',
        range_start: 'rounded-l-full bg-sage-soft/60',
        range_end: 'rounded-r-full bg-sage-soft/60',
        range_middle:
          'bg-sage-soft/60 [&>button]:!bg-transparent [&>button]:!text-brown-soft [&>button]:!shadow-none [&>button]:hover:!bg-sage-soft',
        today: '[&>button]:font-semibold [&>button]:text-blush-deep [&>button]:ring-1 [&>button]:ring-blush/70',
        outside: '[&>button]:text-brown-faint/45',
        disabled: 'opacity-35',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === 'left' ? (
            <ChevronLeft className="size-4" {...rest} />
          ) : (
            <ChevronRight className="size-4" {...rest} />
          ),
      }}
      {...props}
    />
  )
}
