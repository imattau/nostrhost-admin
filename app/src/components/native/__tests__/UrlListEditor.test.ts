import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UrlListEditor from '@/components/native/UrlListEditor.vue'

describe('UrlListEditor', () => {
  it('supports keyboard-operable add, edit and remove actions', async () => {
    const wrapper = mount(UrlListEditor, {
      props: {
        modelValue: ['wss://one.example'],
        label: 'Default relays',
        scheme: 'wss',
      },
    })
    expect(wrapper.get('fieldset').text()).toContain('Default relays')
    await wrapper
      .get('button[aria-label="Remove wss://one.example"]')
      .trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([[]])
    await wrapper.findAll('button').at(-1)!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([
      ['wss://one.example', 'wss://'],
    ])
  })
})
