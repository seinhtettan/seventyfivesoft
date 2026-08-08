import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value?: number
  onChange: (value: number) => void
  label?: string
  max?: number
  className?: string
  tone?: 'blush' | 'sage'
}

export function RatingScale({
  value,
  onChange,
  label,
  max = 5,
  className,
  tone = 'blush',
}: Props) {
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      {label && <span className="eyebrow">{label}</span>}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
          const active = (value ?? 0) >= n
          return (
            <button
              key={n}
              type="button"
              aria-label={`${label ?? 'Rating'} ${n} of ${max}`}
              aria-pressed={active}
              onClick={() => onChange(value === n ? 0 : n)}
              className="grid size-8 place-items-center rounded-full transition-transform hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/50"
            >
              <Heart
                className={cn(
                  'size-5 transition-colors',
                  active
                    ? tone === 'blush'
                      ? 'fill-blush-deep text-blush-deep'
                      : 'fill-sage-deep text-sage-deep'
                    : 'text-taupe',
                )}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
