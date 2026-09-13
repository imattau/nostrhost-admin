import { cva } from 'class-variance-authority'

export const badgeVariants = cva(
  'tw:inline-flex tw:items-center tw:rounded tw:px-1.5 tw:py-0.5 tw:font-mono tw:text-[10px] tw:font-semibold tw:uppercase tw:tracking-wide tw:whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'tw:bg-surface-muted tw:text-muted-foreground',
        brand: 'tw:bg-brand-500/10 tw:text-brand-500',
        success: 'tw:bg-emerald-500/10 tw:text-emerald-500',
        warning: 'tw:bg-amber-500/10 tw:text-amber-500',
        danger: 'tw:bg-red-500/10 tw:text-red-500',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
)
