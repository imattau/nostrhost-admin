<script setup lang="ts">
import { type VariantProps } from 'class-variance-authority'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { alertVariants } from './variants'

type AlertVariants = VariantProps<typeof alertVariants>

const props = withDefaults(
  defineProps<{
    variant?: AlertVariants['variant']
    role?: string
    class?: string
  }>(),
  { variant: undefined, role: 'status', class: undefined },
)

const classes = computed(() =>
  cn(alertVariants({ variant: props.variant }), props.class),
)
</script>

<template>
  <div :class="classes" :role="role">
    <slot />
  </div>
</template>
