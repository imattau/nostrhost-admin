import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ChangeLedger from '@/components/native/ChangeLedger.vue'
import ActionMenu from '@/components/native/ActionMenu.vue'
import InspectorPane from '@/components/native/InspectorPane.vue'
import ResourceList from '@/components/native/ResourceList.vue'
import StatusMark from '@/components/native/StatusMark.vue'

describe('workbench primitives', () => {
  it('gives resource lists and inspectors accessible names', () => {
    const list = mount(ResourceList, {
      props: { label: 'Applications' },
      slots: { default: '<button type="button">Gitea</button>' },
    })
    const inspector = mount(InspectorPane, {
      props: { label: 'Selected application details' },
      slots: { default: 'Details' },
    })

    expect(list.get('section').attributes('aria-label')).toBe('Applications')
    expect(inspector.get('aside').attributes('aria-label')).toBe(
      'Selected application details',
    )
  })

  it('renders signed plans as a focusable, announced ledger', () => {
    const wrapper = mount(ChangeLedger, {
      props: {
        title: 'Review install plan',
        digest: 'plan abc123',
        operations: [
          {
            resource: 'service:gitea',
            summary: 'Install the service',
            risk: 'medium',
            reversible: true,
          },
        ],
      },
    })

    expect(wrapper.get('section').attributes('aria-live')).toBe('polite')
    expect(wrapper.get('section').attributes('tabindex')).toBe('-1')
    expect(wrapper.text()).toContain('service:gitea · medium risk · reversible')
  })

  it('pairs status color with readable text', () => {
    const wrapper = mount(StatusMark, {
      props: { state: 'healthy', label: 'Control plane reachable' },
    })
    expect(wrapper.text()).toContain('Control plane reachable')
    expect(wrapper.find('[aria-hidden="true"]').exists()).toBe(true)
  })

  it('opens tertiary actions as a named menu', async () => {
    const wrapper = mount(ActionMenu, {
      props: { label: 'More actions for backup' },
      slots: { default: '<button role="menuitem">Delete archive</button>' },
    })
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click')
    expect(wrapper.get('[role="menu"]').text()).toContain('Delete archive')
  })
})
