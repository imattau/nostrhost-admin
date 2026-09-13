import { cva } from 'class-variance-authority'

export const alertVariants = cva(
  'tw:rounded-lg tw:border tw:px-4 tw:py-3 tw:text-sm',
  {
    variants: {
      variant: {
        info: 'tw:border-brand-500/30 tw:bg-brand-500/10 tw:text-foreground',
        success:
          'tw:border-emerald-500/30 tw:bg-emerald-500/10 tw:text-foreground',
        danger: 'tw:border-red-500/30 tw:bg-red-500/10 tw:text-foreground',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  },
)
