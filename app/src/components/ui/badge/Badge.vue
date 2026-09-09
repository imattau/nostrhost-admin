<script setup lang="ts">
import { cva, type VariantProps } from 'class-variance-authority'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'tw:inline-flex tw:items-center tw:rounded-full tw:px-2.5 tw:py-0.5 tw:text-xs tw:font-medium',
  {
    variants: {
      variant: {
        neutral:
          'tw:bg-surface-muted tw:text-slate-700 tw:dark:bg-surface-muted-dark tw:dark:text-slate-200',
        brand:
          'tw:bg-brand-100 tw:text-brand-800 tw:dark:bg-brand-900 tw:dark:text-brand-100',
        success:
          'tw:bg-green-100 tw:text-green-800 tw:dark:bg-green-900 tw:dark:text-green-100',
        warning:
          'tw:bg-amber-100 tw:text-amber-800 tw:dark:bg-amber-900 tw:dark:text-amber-100',
        danger:
          'tw:bg-red-100 tw:text-red-800 tw:dark:bg-red-900 tw:dark:text-red-100',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

type BadgeVariants = VariantProps<typeof badgeVariants>

const props = defineProps<{
  variant?: BadgeVariants['variant']
  class?: string
}>()

const classes = computed(() =>
  cn(badgeVariants({ variant: props.variant }), props.class),
)
</script>

<template>
  <span :class="classes"><slot /></span>
</template>
