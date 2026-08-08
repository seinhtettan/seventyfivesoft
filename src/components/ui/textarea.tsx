import type * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'flex min-h-24 w-full rounded-xl border border-line bg-cream/60 px-4 py-3 text-sm leading-relaxed text-brown',
        'placeholder:text-brown-faint/80 placeholder:font-light',
        'transition-all outline-none focus-visible:border-sage/70 focus-visible:bg-shell focus-visible:ring-[3px] focus-visible:ring-sage-soft',
        'resize-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
