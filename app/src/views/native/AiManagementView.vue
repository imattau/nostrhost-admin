<script setup lang="ts">
import { useTemplateRef } from 'vue'

import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'
import AdminAgentSection from './ai/AdminAgentSection.vue'
import McpGrantsSection from './ai/McpGrantsSection.vue'
import LocalModelSection from './ai/LocalModelSection.vue'
import OperationModeSection from './ai/OperationModeSection.vue'
import ContributionSection from './ai/ContributionSection.vue'

const operationMode = useTemplateRef('operationMode')

// Switching the local model can change which operation modes are safe to
// run, so refresh that section's display once a switch lands.
function onModelSelected() {
  operationMode.value?.reload()
}
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="AI &amp; agent administration"
      title="AI management"
      description="Control the resident admin agent and grant MCP-connected agents scoped access to this node. All actions publish signed events to the control relay — there is no password store and no third-party account required."
    />

    <AdminAgentSection />
    <McpGrantsSection />
    <LocalModelSection @model-selected="onModelSelected" />
    <OperationModeSection ref="operationMode" />
    <ContributionSection />
  </PageLayout>
</template>
