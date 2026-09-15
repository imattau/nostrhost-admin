import { ref, type InjectionKey } from 'vue'

import { getDomains } from '@/api/nativeDomains'
import {
  getNsiteDomainList,
  getNsiteGatewayStatus,
  getNsiteList,
  type GatewayStatus,
  type NsiteCustomDomain,
  type NsiteSite,
} from '@/api/nativeNsites'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { toErrorMessage } from '@/utils/errors'

// Gateway status, registered domains, sites and custom domains are read by
// several sibling sections of this page (Gateway, Sites, Custom domains,
// Create-my-copy, the publish wizard) and some of them need to trigger a
// refresh of state another section owns (e.g. publishing a site should
// refresh both the gateway status and the sites list). One instance of this
// is created by the page shell and shared via provide/inject rather than
// duplicated per section.
export function useNsiteState() {
  const { sync } = useSigner()
  const { danger } = useNotifications()

  const status = ref<GatewayStatus | null>(null)
  const domains = ref<string[]>([])
  const sites = ref<NsiteSite[]>([])
  const customDomains = ref<NsiteCustomDomain[]>([])
  const loading = ref(false)
  const sitesLoading = ref(false)
  const domainsLoading = ref(false)

  async function loadSites() {
    sitesLoading.value = true
    try {
      const result = await getNsiteList()
      sites.value = result.sites
    } catch (cause) {
      danger(toErrorMessage(cause, 'Failed to load sites.'))
    } finally {
      sitesLoading.value = false
    }
  }

  async function loadDomains() {
    domainsLoading.value = true
    try {
      const result = await getNsiteDomainList()
      customDomains.value = result.domains
    } catch (cause) {
      danger(toErrorMessage(cause, 'Failed to load custom domains.'))
    } finally {
      domainsLoading.value = false
    }
  }

  async function load() {
    loading.value = true
    try {
      await sync()
      const [statusResult, domainResult] = await Promise.all([
        getNsiteGatewayStatus(),
        getDomains(),
      ])
      status.value = statusResult.gateway
      domains.value = domainResult.domains
      await loadSites()
      await loadDomains()
    } catch (cause) {
      danger(toErrorMessage(cause, 'Failed to load gateway status.'))
    } finally {
      loading.value = false
    }
  }

  return {
    status,
    domains,
    sites,
    customDomains,
    loading,
    sitesLoading,
    domainsLoading,
    load,
    loadSites,
    loadDomains,
  }
}

export type NsiteState = ReturnType<typeof useNsiteState>

export const NSITE_STATE_KEY: InjectionKey<NsiteState> = Symbol('nsiteState')
