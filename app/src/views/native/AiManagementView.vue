<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'
import AdminAgentSection from './ai/AdminAgentSection.vue'
import McpGrantsSection from './ai/McpGrantsSection.vue'
import LocalModelSection from './ai/LocalModelSection.vue'
import OperationModeSection from './ai/OperationModeSection.vue'
import ContributionSection from './ai/ContributionSection.vue'

const route = useRoute()
const router = useRouter()

const sections = [
  { id: 'agent', label: 'Agent', component: AdminAgentSection },
  { id: 'access', label: 'MCP access', component: McpGrantsSection },
  { id: 'models', label: 'Models', component: LocalModelSection },
  { id: 'mode', label: 'Operating mode', component: OperationModeSection },
  { id: 'sharing', label: 'Data sharing', component: ContributionSection },
] as const

const selectedId = computed(() =>
  typeof route.params.section === 'string' ? route.params.section : 'agent',
)
const selected = computed(
  () =>
    sections.find((section) => section.id === selectedId.value) || sections[0],
)

watch(
  selectedId,
  (section) => {
    if (!sections.some((item) => item.id === section)) {
      router.replace({ name: 'native-ai', params: { section: 'agent' } })
    }
  },
  { immediate: true },
)

// Switching the local model can change which operation modes are safe to
// run, so refresh that section's display once a switch lands.
function onModelSelected() {}
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="Workbench"
      title="AI management"
      description="Control the resident admin agent and grant MCP-connected agents scoped access to this node. All actions publish signed events to the control relay — there is no password store and no third-party account required."
    />

    <nav
      class="tw:flex tw:overflow-x-auto tw:border-y tw:border-border-subtle"
      aria-label="AI management sections"
    >
      <RouterLink
        v-for="section in sections"
        :key="section.id"
        :to="{ name: 'native-ai', params: { section: section.id } }"
        class="tw:flex tw:min-h-11 tw:shrink-0 tw:items-center tw:border-b-2 tw:px-4 tw:text-sm tw:no-underline"
        :class="
          selected.id === section.id
            ? 'tw:border-signature tw:font-semibold tw:text-foreground'
            : 'tw:border-transparent tw:text-muted-foreground tw:hover:text-foreground'
        "
        :aria-current="selected.id === section.id ? 'page' : undefined"
      >
        {{ section.label }}
      </RouterLink>
    </nav>

    <section class="tw:pt-2" :aria-label="selected.label">
      <component :is="selected.component" @model-selected="onModelSelected" />
    </section>
  </PageLayout>
</template>
