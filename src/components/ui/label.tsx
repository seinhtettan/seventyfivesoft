import type * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-brown-faint select-none',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
