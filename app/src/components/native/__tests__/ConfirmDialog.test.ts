import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ConfirmDialog from '@/components/native/ConfirmDialog.vue'

describe('ConfirmDialog', () => {
  it('enables the confirm button immediately for a soft-tier dialog', () => {
    const wrapper = mount(ConfirmDialog, {
      props: { open: true, tier: 'soft', title: 'Create group?' },
    })
    const confirmButton = wrapper.findAll('button').find((b) => b.text() === 'Confirm')
    expect(confirmButton?.attributes('disabled')).toBeUndefined()
  })

  it('enables the confirm button immediately for a disruptive-tier dialog', () => {
    const wrapper = mount(ConfirmDialog, {
      props: { open: true, tier: 'disruptive', title: 'Restart service?' },
    })
    const confirmButton = wrapper.findAll('button').find((b) => b.text() === 'Confirm')
    expect(confirmButton?.attributes('disabled')).toBeUndefined()
  })

  it('keeps the confirm button disabled for a destructive tier until the phrase matches', async () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        open: true,
        tier: 'destructive',
        title: 'Shut down?',
        confirmPhrase: 'shutdown',
      },
    })
    const confirmButton = () => wrapper.findAll('button').find((b) => b.text() === 'Confirm')
    expect(confirmButton()?.attributes('disabled')).toBeDefined()

    const input = wrapper.find('input[type="text"]')
    await input.setValue('not quite')
    expect(confirmButton()?.attributes('disabled')).toBeDefined()

    await input.setValue('shutdown')
    expect(confirmButton()?.attributes('disabled')).toBeUndefined()
  })

  it('disables confirm while busy regardless of tier', () => {
    const wrapper = mount(ConfirmDialog, {
      props: { open: true, tier: 'soft', title: 'Create group?', busy: true },
    })
    const confirmButton = wrapper.findAll('button').find((b) => b.text() === 'Working…')
    expect(confirmButton?.attributes('disabled')).toBeDefined()
  })

  it('emits confirm and cancel', async () => {
    const wrapper = mount(ConfirmDialog, {
      props: { open: true, tier: 'soft', title: 'Create group?' },
    })
    await wrapper.findAll('button').find((b) => b.text() === 'Cancel')!.trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)

    await wrapper.findAll('button').find((b) => b.text() === 'Confirm')!.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })
})
