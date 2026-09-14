import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  'tw:inline-flex tw:items-center tw:justify-center tw:gap-2 tw:whitespace-nowrap tw:rounded-md tw:text-sm tw:font-medium tw:transition-colors tw:disabled:pointer-events-none tw:disabled:opacity-50 tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-brand-500 tw:focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        primary:
          'tw:bg-brand-600 tw:text-white tw:shadow-sm tw:hover:bg-brand-700',
        secondary:
          'tw:bg-surface-muted tw:text-foreground tw:hover:brightness-95',
        outline:
          'tw:border tw:border-border-subtle tw:bg-transparent tw:text-foreground tw:hover:bg-surface-muted',
        ghost: 'tw:bg-transparent tw:text-foreground tw:hover:bg-surface-muted',
        danger: 'tw:bg-red-600 tw:text-white tw:hover:bg-red-700',
        warning: 'tw:bg-amber-600 tw:text-white tw:hover:bg-amber-700',
      },
      size: {
        sm: 'tw:h-8 tw:px-3 tw:text-xs',
        md: 'tw:h-10 tw:px-4',
        icon: 'tw:h-9 tw:w-9',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)
