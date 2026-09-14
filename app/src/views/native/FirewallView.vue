<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import {
  closeFirewallPort,
  getFirewallList,
  openFirewallPort,
  reloadFirewall,
  type FirewallProtocol,
} from '@/api/nativeFirewall'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useSigner } from '@/composables/useSigner'

const { publicKey, signerAvailable, sync } = useSigner()

const openPorts = ref<Record<FirewallProtocol, (number | string)[]>>({
  tcp: [],
  udp: [],
})
const forwardedPorts = ref<Record<FirewallProtocol, (number | string)[]>>({
  tcp: [],
  udp: [],
})

const loading = ref(false)
const error = ref('')
const notice = ref('')
const busy = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    await sync()
    const [tcpOpen, udpOpen, tcpForwarded, udpForwarded] = await Promise.all([
      getFirewallList('tcp'),
      getFirewallList('udp'),
      getFirewallList('tcp', true),
      getFirewallList('udp', true),
    ])
    openPorts.value = { tcp: tcpOpen.tcp ?? [], udp: udpOpen.udp ?? [] }
    forwardedPorts.value = {
      tcp: tcpForwarded.tcp ?? [],
      udp: udpForwarded.udp ?? [],
    }
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to load firewall rules.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (publicKey.value) load()
})
watch(publicKey, (key) => {
  if (key) load()
})

// -- open a port ------------------------------------------------------------

const showOpenForm = ref(false)
const openPort = ref('')
const openProtocol = ref<FirewallProtocol>('tcp')
const openComment = ref('')
const openUpnp = ref(false)
const confirmingOpen = ref(false)
const openError = ref('')

function resetOpenForm() {
  openPort.value = ''
  openProtocol.value = 'tcp'
  openComment.value = ''
  openUpnp.value = false
  confirmingOpen.value = false
  openError.value = ''
}

function requestOpen() {
  if (!openPort.value.trim()) {
    openError.value = 'Enter a port or port range.'
    return
  }
  openError.value = ''
  confirmingOpen.value = true
}

async function confirmOpen() {
  confirmingOpen.value = false
  busy.value = 'open'
  openError.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await openFirewallPort({
      port: openPort.value.trim(),
      protocol: openProtocol.value,
      comment: openComment.value.trim() || undefined,
      upnp: openUpnp.value,
    })
    notice.value = `Port open submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    showOpenForm.value = false
    resetOpenForm()
    await load()
  } catch (cause) {
    openError.value =
      cause instanceof Error ? cause.message : 'Failed to open port.'
  } finally {
    busy.value = ''
  }
}

// -- close a port -------------------------------------------------------------

const confirmingClose = ref<string | null>(null)

function closeKey(protocol: FirewallProtocol, port: number | string) {
  return `${protocol}:${port}`
}

function requestClose(protocol: FirewallProtocol, port: number | string) {
  notice.value = ''
  error.value = ''
  confirmingClose.value = closeKey(protocol, port)
}

function cancelClose() {
  confirmingClose.value = null
}

async function confirmClose(protocol: FirewallProtocol, port: number | string) {
  confirmingClose.value = null
  const key = closeKey(protocol, port)
  busy.value = `close-${key}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await closeFirewallPort({ port: String(port), protocol })
    notice.value = `Port close submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : `Failed to close ${protocol}/${port}.`
  } finally {
    busy.value = ''
  }
}

// -- remove UPnP forwarding ---------------------------------------------------

const confirmingUnforward = ref<string | null>(null)

function requestUnforward(protocol: FirewallProtocol, port: number | string) {
  notice.value = ''
  error.value = ''
  confirmingUnforward.value = closeKey(protocol, port)
}

function cancelUnforward() {
  confirmingUnforward.value = null
}

async function confirmUnforward(
  protocol: FirewallProtocol,
  port: number | string,
) {
  confirmingUnforward.value = null
  const key = closeKey(protocol, port)
  busy.value = `unforward-${key}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await closeFirewallPort({
      port: String(port),
      protocol,
      upnp_only: true,
    })
    notice.value = `UPnP forwarding removal submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : `Failed to remove forwarding for ${protocol}/${port}.`
  } finally {
    busy.value = ''
  }
}

// -- reload -------------------------------------------------------------------

const confirmingReload = ref(false)
const reloadSkipUpnp = ref(false)

function requestReload() {
  notice.value = ''
  error.value = ''
  confirmingReload.value = true
}

async function confirmReload() {
  confirmingReload.value = false
  busy.value = 'reload'
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await reloadFirewall(reloadSkipUpnp.value)
    notice.value = `Firewall reload submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to reload firewall.'
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <section class="tw:mx-auto tw:grid tw:max-w-4xl tw:gap-6">
    <header class="tw:border-b tw:border-border-subtle tw:pb-4">
      <p
        class="tw:font-mono tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-brand-500"
      >
        Network
      </p>
      <h1 class="tw:mt-1 tw:text-2xl tw:font-bold tw:text-foreground">
        Firewall
      </h1>
      <p class="tw:mt-2 tw:max-w-2xl tw:text-sm tw:text-muted-foreground">
        Open and closed TCP/UDP ports and UPnP forwarding. Changes ask for
        confirmation first — a reload can transiently drop connections.
      </p>
    </header>

    <Alert v-if="!signerAvailable" variant="danger">
      You are not signed in. Sign in at the portal to continue.
    </Alert>
    <Alert v-else-if="!publicKey" variant="info">
      Sign in at the portal to continue.
    </Alert>
    <Alert v-if="error" variant="danger" role="alert">{{ error }}</Alert>
    <Alert v-if="notice" variant="success" role="status">{{ notice }}</Alert>

    <template v-if="publicKey">
      <Card>
        <CardHeader>
          <CardTitle
            class="tw:flex tw:items-center tw:justify-between tw:gap-2"
          >
            <span>Open ports</span>
            <span class="tw:flex tw:gap-2">
              <Button
                variant="outline"
                size="sm"
                :disabled="busy !== ''"
                @click="showOpenForm = !showOpenForm"
                >{{ showOpenForm ? 'Cancel' : 'Open port' }}</Button
              >
              <template v-if="confirmingReload">
                <span class="tw:flex tw:items-center tw:gap-2">
                  <span class="tw:text-xs tw:text-muted-foreground"
                    >Reload?</span
                  >
                  <Button
                    variant="outline"
                    size="sm"
                    @click="confirmingReload = false"
                    >Cancel</Button
                  >
                  <Button
                    variant="danger"
                    size="sm"
                    :disabled="busy !== ''"
                    @click="confirmReload"
                    >Confirm</Button
                  >
                </span>
              </template>
              <Button
                v-else
                variant="outline"
                size="sm"
                :disabled="busy !== ''"
                @click="requestReload"
                >{{ busy === 'reload' ? 'Reloading…' : 'Reload' }}</Button
              >
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-4">
          <label
            class="tw:flex tw:items-center tw:gap-2 tw:text-xs tw:text-muted-foreground"
          >
            <input
              v-model="reloadSkipUpnp"
              type="checkbox"
              class="tw:size-4 tw:accent-brand-500"
            />
            Skip UPnP refresh on reload
          </label>

          <div
            v-if="showOpenForm"
            class="tw:grid tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
          >
            <div class="tw:grid tw:gap-4 tw:sm:grid-cols-2">
              <div class="tw:grid tw:gap-1.5">
                <Label for="firewall-open-port">Port or range</Label>
                <Input
                  id="firewall-open-port"
                  v-model="openPort"
                  placeholder="8080 or 1000-2000"
                  autocomplete="off"
                  spellcheck="false"
                />
              </div>
              <div class="tw:grid tw:gap-1.5">
                <Label for="firewall-open-protocol">Protocol</Label>
                <Select id="firewall-open-protocol" v-model="openProtocol">
                  <option value="tcp">tcp</option>
                  <option value="udp">udp</option>
                </Select>
              </div>
            </div>
            <div class="tw:grid tw:gap-1.5">
              <Label for="firewall-open-comment">Comment (optional)</Label>
              <Input
                id="firewall-open-comment"
                v-model="openComment"
                placeholder="opened via native operation"
                autocomplete="off"
              />
            </div>
            <label class="tw:flex tw:items-center tw:gap-2 tw:text-sm">
              <input
                v-model="openUpnp"
                type="checkbox"
                class="tw:size-4 tw:accent-brand-500"
              />
              Also forward via UPnP
            </label>
            <Alert v-if="openError" variant="danger">{{ openError }}</Alert>
            <div
              v-if="confirmingOpen"
              class="tw:flex tw:items-center tw:justify-end tw:gap-2"
            >
              <span class="tw:text-xs tw:text-muted-foreground"
                >Open {{ openProtocol }}/{{ openPort.trim() }}?</span
              >
              <Button
                variant="outline"
                size="sm"
                @click="confirmingOpen = false"
                >Cancel</Button
              >
              <Button
                variant="danger"
                size="sm"
                :disabled="busy !== ''"
                @click="confirmOpen"
                >Confirm</Button
              >
            </div>
            <div v-else class="tw:flex tw:justify-end">
              <Button size="sm" :disabled="busy !== ''" @click="requestOpen">{{
                busy === 'open' ? 'Opening…' : 'Open port'
              }}</Button>
            </div>
          </div>

          <div
            v-for="protocol in ['tcp', 'udp'] as const"
            :key="protocol"
            class="tw:grid tw:gap-2"
          >
            <h3 class="tw:m-0 tw:text-sm tw:font-semibold tw:uppercase">
              {{ protocol }}
            </h3>
            <p
              v-if="!loading && openPorts[protocol].length === 0"
              class="tw:m-0 tw:text-sm tw:text-muted-foreground"
            >
              No open {{ protocol }} ports.
            </p>
            <p
              v-else-if="loading"
              class="tw:m-0 tw:text-sm tw:text-muted-foreground"
            >
              Loading…
            </p>
            <ul v-else class="tw:m-0 tw:grid tw:gap-1 tw:pl-0">
              <li
                v-for="port in openPorts[protocol]"
                :key="port"
                class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3 tw:text-sm"
              >
                <code class="tw:font-mono">{{ port }}</code>
                <template v-if="confirmingClose === closeKey(protocol, port)">
                  <span class="tw:flex tw:items-center tw:gap-2">
                    <span class="tw:text-xs tw:text-muted-foreground"
                      >Close?</span
                    >
                    <Button variant="outline" size="sm" @click="cancelClose"
                      >Cancel</Button
                    >
                    <Button
                      variant="danger"
                      size="sm"
                      :disabled="busy !== ''"
                      @click="confirmClose(protocol, port)"
                      >Confirm</Button
                    >
                  </span>
                </template>
                <Button
                  v-else
                  variant="outline"
                  size="sm"
                  :disabled="busy !== ''"
                  @click="requestClose(protocol, port)"
                  >{{
                    busy === `close-${closeKey(protocol, port)}`
                      ? 'Closing…'
                      : 'Close'
                  }}</Button
                >
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>UPnP forwarded ports</CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-4">
          <div
            v-for="protocol in ['tcp', 'udp'] as const"
            :key="protocol"
            class="tw:grid tw:gap-2"
          >
            <h3 class="tw:m-0 tw:text-sm tw:font-semibold tw:uppercase">
              {{ protocol }}
            </h3>
            <p
              v-if="!loading && forwardedPorts[protocol].length === 0"
              class="tw:m-0 tw:text-sm tw:text-muted-foreground"
            >
              No UPnP-forwarded {{ protocol }} ports.
            </p>
            <ul v-else class="tw:m-0 tw:grid tw:gap-1 tw:pl-0">
              <li
                v-for="port in forwardedPorts[protocol]"
                :key="port"
                class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3 tw:text-sm"
              >
                <code class="tw:font-mono">{{ port }}</code>
                <template
                  v-if="confirmingUnforward === closeKey(protocol, port)"
                >
                  <span class="tw:flex tw:items-center tw:gap-2">
                    <span class="tw:text-xs tw:text-muted-foreground"
                      >Remove forwarding?</span
                    >
                    <Button variant="outline" size="sm" @click="cancelUnforward"
                      >Cancel</Button
                    >
                    <Button
                      variant="danger"
                      size="sm"
                      :disabled="busy !== ''"
                      @click="confirmUnforward(protocol, port)"
                      >Confirm</Button
                    >
                  </span>
                </template>
                <Button
                  v-else
                  variant="outline"
                  size="sm"
                  :disabled="busy !== ''"
                  @click="requestUnforward(protocol, port)"
                  >{{
                    busy === `unforward-${closeKey(protocol, port)}`
                      ? 'Removing…'
                      : 'Remove forwarding'
                  }}</Button
                >
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </template>
  </section>
</template>
