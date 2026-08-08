import type * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-xl border border-line bg-cream/60 px-4 py-2 text-sm text-brown',
        'placeholder:text-brown-faint/80 placeholder:font-light',
        'transition-all outline-none focus-visible:border-sage/70 focus-visible:bg-shell focus-visible:ring-[3px] focus-visible:ring-sage-soft',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
