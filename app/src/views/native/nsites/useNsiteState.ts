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
import { useActionRunner } from '@/composables/useActionRunner'
import { useSigner } from '@/composables/useSigner'

// Gateway status, registered domains, sites and custom domains are read by
// several sibling sections of this page (Gateway, Sites, Custom domains,
// Create-my-copy, the publish wizard) and some of them need to trigger a
// refresh of state another section owns (e.g. publishing a site should
// refresh both the gateway status and the sites list). One instance of this
// is created by the page shell and shared via provide/inject rather than
// duplicated per section.
export function useNsiteState() {
  const { sync } = useSigner()

  const status = ref<GatewayStatus | null>(null)
  const domains = ref<string[]>([])
  const sites = ref<NsiteSite[]>([])
  const customDomains = ref<NsiteCustomDomain[]>([])
  const loading = ref(false)
  const sitesLoading = ref(false)
  const domainsLoading = ref(false)
  const { run: runLoad } = useActionRunner(loading, false)
  const { run: runSites } = useActionRunner(sitesLoading, false)
  const { run: runDomains } = useActionRunner(domainsLoading, false)

  async function loadSites() {
    await runSites(
      true,
      async () => {
        const result = await getNsiteList()
        sites.value = result.sites
      },
      'Failed to load sites.',
    )
  }

  async function loadDomains() {
    await runDomains(
      true,
      async () => {
        const result = await getNsiteDomainList()
        customDomains.value = result.domains
      },
      'Failed to load custom domains.',
    )
  }

  async function load() {
    await runLoad(
      true,
      async () => {
        await sync()
        const [statusResult, domainResult] = await Promise.all([
          getNsiteGatewayStatus(),
          getDomains(),
        ])
        status.value = statusResult.gateway
        domains.value = domainResult.domains
        await loadSites()
        await loadDomains()
      },
      'Failed to load gateway status.',
    )
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
