<script setup lang="ts">
import { type VariantProps } from 'class-variance-authority'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { buttonVariants } from './variants'

type ButtonVariants = VariantProps<typeof buttonVariants>

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariants['variant']
    size?: ButtonVariants['size']
    as?: string
    class?: string
  }>(),
  { as: 'button', variant: undefined, size: undefined, class: undefined },
)

const classes = computed(() =>
  cn(buttonVariants({ variant: props.variant, size: props.size }), props.class),
)
</script>

<template>
  <component :is="as" :class="classes">
    <slot />
  </component>
</template>
