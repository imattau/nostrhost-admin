import { cva } from 'class-variance-authority'

export const badgeVariants = cva(
  'tw:inline-flex tw:items-center tw:whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'tw:bg-surface-muted tw:text-muted-foreground',
        brand: 'tw:bg-selection tw:text-signature',
        success: 'tw:bg-healthy/10 tw:text-healthy',
        warning: 'tw:bg-caution/10 tw:text-caution',
        danger: 'tw:bg-destructive/10 tw:text-destructive',
      },
      // "badge" is the small uppercase-mono status chip (10px); "chip" is for
      // anything a user actually reads as data (usernames, scopes, values) —
      // normal case, 12px minimum, matches the plan's "no data below 12px" rule.
      shape: {
        badge:
          'tw:rounded-[2px] tw:px-1.5 tw:py-0.5 tw:font-mono tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide',
        chip: 'tw:rounded-[3px] tw:px-2.5 tw:py-1 tw:text-xs tw:font-medium',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      shape: 'badge',
    },
  },
)
