import type * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-45 outline-none focus-visible:ring-2 focus-visible:ring-sage/60 focus-visible:ring-offset-2 focus-visible:ring-offset-cream active:scale-[0.985] [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-brown text-cream hover:bg-brown/90 shadow-[0_10px_24px_-14px_rgba(76,61,51,0.7)]',
        sage: 'bg-sage-deep text-white hover:bg-sage-deep/90 shadow-[0_10px_24px_-14px_rgba(127,151,121,0.9)]',
        blush:
          'bg-blush-deep text-white hover:bg-blush-deep/90 shadow-[0_10px_24px_-14px_rgba(207,157,148,0.9)]',
        outline: 'border border-line bg-shell/70 text-brown hover:bg-cream-deep/70 hover:border-taupe',
        ghost: 'text-brown-soft hover:bg-cream-deep/70 hover:text-brown',
        link: 'text-brown-soft underline-offset-4 hover:underline hover:text-brown',
        danger: 'border border-blush-deep/40 bg-blush-soft/60 text-blush-deep hover:bg-blush-soft',
      },
      size: {
        default: 'h-11 px-5 text-sm rounded-full tracking-wide',
        sm: 'h-9 px-4 text-xs rounded-full tracking-wide',
        lg: 'h-12 px-7 text-sm rounded-full tracking-[0.12em] uppercase',
        icon: 'size-10 rounded-full',
        iconSm: 'size-8 rounded-full',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
