<script setup lang="ts">
import { nextTick, ref } from 'vue'

import {
  applyConnectivity,
  checkConnectivity,
  getConnectivity,
  planConnectivity,
  type ConnectivityConfiguration,
  type ConnectivityPlan,
  type RelayPurpose,
} from '@/api/nativeConnectivity'
import ChangeLedger from '@/components/native/ChangeLedger.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'
import RuledSection from '@/components/native/RuledSection.vue'
import UrlListEditor from '@/components/native/UrlListEditor.vue'
import { Button } from '@/components/ui/button'

const configuration = ref<ConnectivityConfiguration | null>(null)
const controlRelay = ref('')
const plan = ref<ConnectivityPlan | null>(null)
const ledger = ref<InstanceType<typeof ChangeLedger> | null>(null)
const busy = ref(false)
const message = ref('')
const error = ref('')
const advancedOpen = ref(false)
const purposes: { key: RelayPurpose; label: string; description: string }[] = [
  {
    key: 'lookup',
    label: 'Lookup relays',
    description: 'Used when finding public Nostr information.',
  },
  {
    key: 'publish',
    label: 'Publish relays',
    description: 'Used for ordinary public Nostr events.',
  },
  {
    key: 'catalogue',
    label: 'Catalogue relays',
    description: 'Used to exchange signed application catalogue entries.',
  },
  {
    key: 'nsite',
    label: 'Site relays',
    description: 'Used to find and publish Nsite manifests.',
  },
]

function clean(values: string[]) {
  return [
    ...new Set(
      values.map((value) => value.trim().replace(/\/$/, '')).filter(Boolean),
    ),
  ]
}

function normalised(): ConnectivityConfiguration {
  const source = configuration.value!
  return {
    ...source,
    default_relays: clean(source.default_relays),
    default_blossom_servers: clean(source.default_blossom_servers),
    additional_discovery_relays: clean(source.additional_discovery_relays),
    overrides: Object.fromEntries(
      purposes.map(({ key }) => [
        key,
        source.overrides[key] === null ? null : clean(source.overrides[key]!),
      ]),
    ) as ConnectivityConfiguration['overrides'],
  }
}

async function load() {
  busy.value = true
  error.value = ''
  try {
    const state = await getConnectivity()
    configuration.value = structuredClone(state.configured)
    controlRelay.value = state.control_relay.url
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : 'Could not load Nostr network settings.'
  } finally {
    busy.value = false
  }
}

async function testConnections() {
  if (!configuration.value) return
  busy.value = true
  error.value = ''
  message.value = ''
  try {
    const value = normalised()
    const result = await checkConnectivity(
      value.default_relays,
      value.default_blossom_servers,
    )
    const relayResults = Array.isArray(result.relays) ? result.relays.length : 0
    const serverResults = Array.isArray(result.servers)
      ? result.servers.length
      : 0
    message.value = `Checked ${relayResults} relay${relayResults === 1 ? '' : 's'} and ${serverResults} storage server${serverResults === 1 ? '' : 's'}.`
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Connection check failed.'
  } finally {
    busy.value = false
  }
}

async function review() {
  if (!configuration.value) return
  busy.value = true
  error.value = ''
  try {
    configuration.value = normalised()
    plan.value = await planConnectivity(configuration.value)
    await nextTick()
    ledger.value?.focus()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Could not prepare the change.'
  } finally {
    busy.value = false
  }
}

async function apply() {
  if (!configuration.value || !plan.value) return
  busy.value = true
  error.value = ''
  try {
    await applyConnectivity(configuration.value, plan.value.plan_sha256)
    message.value = 'Nostr network defaults were updated.'
    plan.value = null
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Could not apply the change.'
  } finally {
    busy.value = false
  }
}

function enableOverride(key: RelayPurpose) {
  if (!configuration.value) return
  configuration.value.overrides[key] = [...configuration.value.default_relays]
}

void load()
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="Nostr"
      title="Nostr network"
      description="Choose the public relays and file-storage servers NostrHost uses by default. Most servers only need these two lists."
    />

    <p
      v-if="error"
      role="alert"
      class="tw:border-l-2 tw:border-destructive tw:pl-3 tw:text-sm tw:text-destructive"
    >
      {{ error }}
    </p>
    <p
      v-if="message"
      role="status"
      class="tw:border-l-2 tw:border-healthy tw:pl-3 tw:text-sm"
    >
      {{ message }}
    </p>

    <template v-if="configuration">
      <RuledSection
        title="Public connections"
        description="These defaults are used unless a particular site or specialist tool has its own setting."
      >
        <div class="tw:grid tw:gap-7 tw:lg:grid-cols-2">
          <UrlListEditor
            v-model="configuration.default_relays"
            label="Default relays"
            scheme="wss"
            :disabled="busy"
          />
          <UrlListEditor
            v-model="configuration.default_blossom_servers"
            label="Default file-storage servers"
            scheme="https"
            :disabled="busy"
          />
        </div>
        <div class="tw:mt-5 tw:flex tw:flex-wrap tw:gap-2">
          <Button variant="outline" :disabled="busy" @click="testConnections"
            >Test connections</Button
          >
          <Button :disabled="busy" @click="review">Review changes</Button>
        </div>
      </RuledSection>

      <RuledSection
        title="Advanced"
        description="Use separate relay lists only when a service has different trust, privacy, or availability requirements."
      >
        <button
          type="button"
          class="workbench-link tw:border-0 tw:bg-transparent tw:p-0 tw:text-sm"
          :aria-expanded="advancedOpen"
          @click="advancedOpen = !advancedOpen"
        >
          {{
            advancedOpen ? 'Hide advanced settings' : 'Show advanced settings'
          }}
        </button>
        <div v-if="advancedOpen" class="tw:mt-5 tw:grid tw:gap-7">
          <div
            v-for="purpose in purposes"
            :key="purpose.key"
            class="tw:border-t tw:border-border-subtle tw:pt-4"
          >
            <div
              class="tw:mb-3 tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-3"
            >
              <div>
                <h3 class="tw:m-0 tw:text-sm tw:font-semibold">
                  {{ purpose.label }}
                </h3>
                <p class="tw:mb-0 tw:mt-1 tw:text-sm tw:text-muted-foreground">
                  {{ purpose.description }}
                </p>
              </div>
              <Button
                v-if="configuration.overrides[purpose.key] === null"
                variant="ghost"
                size="sm"
                @click="enableOverride(purpose.key)"
                >Use custom relays</Button
              >
              <Button
                v-else
                variant="ghost"
                size="sm"
                @click="configuration.overrides[purpose.key] = null"
                >Return to system defaults</Button
              >
            </div>
            <p
              v-if="configuration.overrides[purpose.key] === null"
              class="tw:m-0 tw:text-sm tw:text-muted-foreground"
            >
              Using system defaults
            </p>
            <UrlListEditor
              v-else
              v-model="configuration.overrides[purpose.key]!"
              :label="purpose.label"
              scheme="wss"
            />
          </div>
          <UrlListEditor
            v-model="configuration.additional_discovery_relays"
            label="Additional discovery relays"
            scheme="wss"
          />
          <details class="tw:border-t tw:border-border-subtle tw:pt-4">
            <summary class="tw:cursor-pointer tw:text-sm tw:font-semibold">
              Technical details
            </summary>
            <p class="tw:text-sm tw:text-muted-foreground">
              The private control relay carries signed approvals and machine
              events. It is intentionally separate and cannot be changed here.
            </p>
            <code class="tw:font-mono tw:text-xs">{{ controlRelay }}</code>
          </details>
        </div>
      </RuledSection>

      <ChangeLedger
        v-if="plan"
        ref="ledger"
        title="Review Nostr network change"
        :digest="plan.plan_sha256"
        :operations="
          plan.affected_services.map((service) => ({
            resource: service,
            summary: 'Apply the reviewed public connection defaults',
            risk: 'medium',
            reversible: true,
          }))
        "
      >
        <div class="tw:mt-4 tw:flex tw:justify-end tw:gap-2">
          <Button variant="ghost" @click="plan = null">Cancel</Button>
          <Button :disabled="busy" @click="apply">Apply changes</Button>
        </div>
      </ChangeLedger>
    </template>
  </PageLayout>
</template>
