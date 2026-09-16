<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    label: string
    scheme: 'wss' | 'https'
    disabled?: boolean
  }>(),
  { disabled: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

function update(index: number, value: string) {
  const next = [...props.modelValue]
  next[index] = value
  emit('update:modelValue', next)
}

function remove(index: number) {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, itemIndex) => itemIndex !== index),
  )
}

function add() {
  emit('update:modelValue', [...props.modelValue, `${props.scheme}://`])
}
</script>

<template>
  <fieldset class="tw:m-0 tw:border-0 tw:p-0" :disabled="disabled">
    <legend class="tw:mb-2 tw:text-sm tw:font-semibold">{{ label }}</legend>
    <div class="tw:grid tw:gap-2">
      <div
        v-for="(value, index) in modelValue"
        :key="index"
        class="tw:flex tw:items-center tw:gap-2"
      >
        <Input
          :model-value="value"
          :aria-label="`${label} ${index + 1}`"
          class="tw:font-mono tw:text-sm"
          @update:model-value="update(index, String($event))"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          :aria-label="`Remove ${value}`"
          @click="remove(index)"
          >Remove</Button
        >
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        class="tw:w-fit"
        @click="add"
      >
        Add address
      </Button>
    </div>
  </fieldset>
</template>
