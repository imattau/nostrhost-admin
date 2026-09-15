<script setup lang="ts">
import { onMounted, provide, ref, watch } from 'vue'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSigner } from '@/composables/useSigner'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'
import GatewaySection from './nsites/GatewaySection.vue'
import SitesSection from './nsites/SitesSection.vue'
import CustomDomainsSection from './nsites/CustomDomainsSection.vue'
import CreateCopySection from './nsites/CreateCopySection.vue'
import PublishWizardSection from './nsites/PublishWizardSection.vue'
import { NSITE_STATE_KEY, useNsiteState } from './nsites/useNsiteState'

const { publicKey } = useSigner()

const nsite = useNsiteState()
provide(NSITE_STATE_KEY, nsite)

onMounted(() => {
  if (publicKey.value) nsite.load()
})
watch(publicKey, (key) => {
  if (key) nsite.load()
})

const wizardVisible = ref(false)
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="Network"
      title="Sites"
      description="NIP-5A static sites served by the nsite gateway on a dedicated domain. Enabling, disabling or reconfiguring the gateway asks for confirmation first."
    />

    <template v-if="publicKey">
      <GatewaySection />
      <SitesSection
        :wizard-visible="wizardVisible"
        @toggle-wizard="wizardVisible = !wizardVisible"
      />
      <CustomDomainsSection />
      <CreateCopySection />
      <PublishWizardSection v-model:visible="wizardVisible" />

      <Card>
        <CardHeader>
          <CardTitle>How sites are served</CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-1 tw:text-sm">
          <p class="tw:m-0">
            Each site is a NIP-5A manifest (kinds 15128/35128) that lists a
            public-key hash, files and an aggregate digest. The gateway resolves
            manifests over relays and serves their files over HTTPS from Blossom
            servers, verifying hashes on the way.
          </p>
          <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
            Publishing signs a manifest in your browser with NIP-07 (the server
            never sees your key) and submits it for approval.
          </p>
        </CardContent>
      </Card>
    </template>
  </PageLayout>
</template>
