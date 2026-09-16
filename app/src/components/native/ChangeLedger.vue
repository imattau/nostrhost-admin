<script setup lang="ts">
import { ref } from 'vue'

type LedgerOperation = {
  resource: string
  summary: string
  risk?: string
  reversible?: boolean
}

defineProps<{
  title: string
  digest?: string
  operations: LedgerOperation[]
}>()

const root = ref<HTMLElement | null>(null)
defineExpose({ focus: () => root.value?.focus() })
</script>

<template>
  <section
    ref="root"
    tabindex="-1"
    class="tw:border-l-2 tw:border-signature tw:bg-selection/35 tw:px-4 tw:py-4 tw:focus-visible:outline tw:focus-visible:outline-2 tw:focus-visible:outline-focus"
    aria-live="polite"
  >
    <div
      class="tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-3"
    >
      <div>
        <h3 class="tw:m-0 tw:text-sm tw:font-semibold">{{ title }}</h3>
        <code
          v-if="digest"
          class="tw:mt-1 tw:block tw:font-mono tw:text-xs tw:text-muted-foreground"
        >
          {{ digest }}
        </code>
      </div>
      <slot name="actions" />
    </div>
    <ol class="tw:mb-0 tw:mt-4 tw:grid tw:gap-3 tw:pl-5 tw:text-sm">
      <li
        v-for="(operation, index) in operations"
        :key="`${operation.resource}-${index}`"
      >
        <strong>{{ operation.summary }}</strong>
        <span
          class="tw:mt-0.5 tw:block tw:font-mono tw:text-xs tw:text-muted-foreground"
        >
          {{ operation.resource }} · {{ operation.risk || 'low' }} risk ·
          {{ operation.reversible ? 'reversible' : 'no automatic reverse' }}
        </span>
      </li>
    </ol>
    <slot />
  </section>
</template>
