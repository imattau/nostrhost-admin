import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  'tw:inline-flex tw:items-center tw:justify-center tw:gap-2 tw:whitespace-nowrap tw:rounded-[3px] tw:text-sm tw:font-semibold tw:transition-colors tw:disabled:pointer-events-none tw:disabled:opacity-50 tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-focus tw:focus-visible:ring-offset-2 tw:focus-visible:ring-offset-background',
  {
    variants: {
      variant: {
        primary: 'tw:bg-foreground tw:text-background tw:hover:opacity-85',
        secondary:
          'tw:bg-surface-muted tw:text-foreground tw:hover:brightness-95',
        outline:
          'tw:border tw:border-border-subtle tw:bg-transparent tw:text-foreground tw:hover:bg-surface-muted',
        ghost: 'tw:bg-transparent tw:text-foreground tw:hover:bg-surface-muted',
        danger: 'tw:bg-destructive tw:text-white tw:hover:opacity-85',
        warning: 'tw:bg-caution tw:text-white tw:hover:opacity-85',
      },
      size: {
        sm: 'tw:h-9 tw:px-3 tw:text-xs',
        md: 'tw:h-10 tw:px-4',
        icon: 'tw:h-10 tw:w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)
