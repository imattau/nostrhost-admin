<script setup lang="ts">
import { type VariantProps } from 'class-variance-authority'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { badgeVariants } from './variants'

type BadgeVariants = VariantProps<typeof badgeVariants>

const props = withDefaults(
  defineProps<{
    variant?: BadgeVariants['variant']
    shape?: BadgeVariants['shape']
    class?: string
  }>(),
  { variant: undefined, shape: undefined, class: undefined },
)

const classes = computed(() =>
  cn(badgeVariants({ variant: props.variant, shape: props.shape }), props.class),
)
</script>

<template>
  <span :class="classes">
    <slot />
  </span>
</template>
