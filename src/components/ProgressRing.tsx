import { cn } from '@/lib/utils'

interface Props {
  /** 0–1 */
  value: number
  size?: number
  stroke?: number
  className?: string
  children?: React.ReactNode
  /** gradient id must be unique per ring on a page */
  id?: string
  from?: string
  to?: string
  track?: string
}

export function ProgressRing({
  value,
  size = 168,
  stroke = 10,
  className,
  children,
  id = 'ring',
  from = '#cf9d94',
  to = '#a9bda4',
  track = '#efe4d6',
}: Props) {
  const clamped = Math.max(0, Math.min(1, value))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r

  return (
    <div className={cn('relative grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`${id}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id}-grad)`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

export function ProgressBar({
  value,
  className,
  height = 8,
}: {
  value: number
  className?: string
  height?: number
}) {
  const clamped = Math.max(0, Math.min(1, value))
  return (
    <div
      className={cn('w-full overflow-hidden rounded-full bg-taupe-soft', className)}
      style={{ height }}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-blush-deep via-blush to-sage transition-[width] duration-700 ease-out"
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}
