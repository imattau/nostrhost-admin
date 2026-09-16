import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppLogo from '@/components/native/AppLogo.vue'

describe('AppLogo', () => {
  it('renders the served logo image when a URL is provided', () => {
    const wrapper = mount(AppLogo, {
      props: { name: 'WordPress', logo: '/nostrhost/sso/applogos/abc.png' },
    })
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('/nostrhost/sso/applogos/abc.png')
    expect(wrapper.find('span').exists()).toBe(false)
  })

  it('falls back to a monogram when no logo is available', () => {
    const wrapper = mount(AppLogo, { props: { name: 'Nextcloud Mail' } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('span').text()).toBe('NM')
  })

  it('single-word names use one initial', () => {
    const wrapper = mount(AppLogo, { props: { name: 'Gitea', logo: null } })
    expect(wrapper.find('span').text()).toBe('G')
  })
})
