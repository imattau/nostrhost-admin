<script setup lang="ts">
import { ref } from 'vue'

import {
  closeFirewallPort,
  getFirewallList,
  openFirewallPort,
  reloadFirewall,
  type FirewallProtocol,
} from '@/api/nativeFirewall'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useActionRunner } from '@/composables/useActionRunner'
import { useConfirm } from '@/composables/useConfirm'
import { useNotifications } from '@/composables/useNotifications'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { success, danger } = useNotifications()

const openPorts = ref<Record<FirewallProtocol, (number | string)[]>>({
  tcp: [],
  udp: [],
})
const forwardedPorts = ref<Record<FirewallProtocol, (number | string)[]>>({
  tcp: [],
  udp: [],
})

const busy = ref('')
const { run } = useActionRunner(busy, '')

const { publicKey, sync, loading, load } = useAsyncResource(async () => {
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
}, 'Failed to load firewall rules.')

// -- open a port ------------------------------------------------------------

const showOpenForm = ref(false)
const openPort = ref('')
const openProtocol = ref<FirewallProtocol>('tcp')
const openComment = ref('')
const openUpnp = ref(false)
const {
  pending: confirmingOpen,
  request: requestOpenConfirm,
  cancel: cancelOpen,
} = useConfirm(false)

function resetOpenForm() {
  openPort.value = ''
  openProtocol.value = 'tcp'
  openComment.value = ''
  openUpnp.value = false
  cancelOpen()
}

function requestOpen() {
  if (!openPort.value.trim()) {
    danger('Enter a port or port range.')
    return
  }
  requestOpenConfirm(true)
}

async function confirmOpen() {
  cancelOpen()
  await run(
    'open',
    async () => {
      await sync()
      const result = await openFirewallPort({
        port: openPort.value.trim(),
        protocol: openProtocol.value,
        comment: openComment.value.trim() || undefined,
        upnp: openUpnp.value,
      })
      success(
        `Port open submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      showOpenForm.value = false
      resetOpenForm()
      await load()
    },
    'Failed to open port.',
  )
}

// -- close a port -------------------------------------------------------------

const {
  pending: confirmingCloseTarget,
  request: requestCloseConfirm,
  cancel: cancelClose,
} = useConfirm<{ protocol: FirewallProtocol; port: number | string } | null>(
  null,
)

// Closing one of these can lock the operator out of the server entirely
// (SSH) or take the console/every app offline (HTTP/HTTPS) — worth a harder
// confirmation than an ordinary port close.
const CRITICAL_PORTS = new Set([22, 80, 443])

function closeKey(protocol: FirewallProtocol, port: number | string) {
  return `${protocol}:${port}`
}

function requestClose(protocol: FirewallProtocol, port: number | string) {
  requestCloseConfirm({ protocol, port })
}

async function confirmClose(protocol: FirewallProtocol, port: number | string) {
  cancelClose()
  const key = closeKey(protocol, port)
  await run(
    `close-${key}`,
    async () => {
      await sync()
      const result = await closeFirewallPort({ port: String(port), protocol })
      success(
        `Port close submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      await load()
    },
    `Failed to close ${protocol}/${port}.`,
  )
}

// -- remove UPnP forwarding ---------------------------------------------------

const {
  pending: confirmingUnforward,
  request: requestUnforwardConfirm,
  cancel: cancelUnforward,
} = useConfirm<string | null>(null)

function requestUnforward(protocol: FirewallProtocol, port: number | string) {
  requestUnforwardConfirm(closeKey(protocol, port))
}

async function confirmUnforward(
  protocol: FirewallProtocol,
  port: number | string,
) {
  cancelUnforward()
  const key = closeKey(protocol, port)
  await run(
    `unforward-${key}`,
    async () => {
      await sync()
      const result = await closeFirewallPort({
        port: String(port),
        protocol,
        upnp_only: true,
      })
      success(
        `UPnP forwarding removal submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      await load()
    },
    `Failed to remove forwarding for ${protocol}/${port}.`,
  )
}

// -- reload -------------------------------------------------------------------

const {
  pending: confirmingReload,
  request: requestReloadConfirm,
  cancel: cancelReload,
} = useConfirm(false)
const reloadSkipUpnp = ref(false)

function requestReload() {
  requestReloadConfirm(true)
}

async function confirmReload() {
  cancelReload()
  await run(
    'reload',
    async () => {
      await sync()
      const result = await reloadFirewall(reloadSkipUpnp.value)
      success(
        `Firewall reload submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      await load()
    },
    'Failed to reload firewall.',
  )
}
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="Network"
      title="Firewall"
      description="Open and closed TCP/UDP ports and UPnP forwarding. Changes ask for confirmation first — a reload can transiently drop connections."
    />

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
                  <Button variant="outline" size="sm" @click="cancelReload()"
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
            <div
              v-if="confirmingOpen"
              class="tw:flex tw:items-center tw:justify-end tw:gap-2"
            >
              <span class="tw:text-xs tw:text-muted-foreground"
                >Open {{ openProtocol }}/{{ openPort.trim() }}?</span
              >
              <Button variant="outline" size="sm" @click="cancelOpen()"
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
                <Button
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

    <ConfirmDialog
      :open="confirmingCloseTarget !== null"
      :tier="
        confirmingCloseTarget &&
        CRITICAL_PORTS.has(Number(confirmingCloseTarget.port))
          ? 'destructive'
          : 'disruptive'
      "
      title="Close this port?"
      :description="
        confirmingCloseTarget &&
        CRITICAL_PORTS.has(Number(confirmingCloseTarget.port))
          ? `Port ${confirmingCloseTarget.port} is commonly used for SSH/HTTP(S) — closing it can lock you out of the server or take every app offline.`
          : 'A reload can transiently drop connections.'
      "
      confirm-label="Close"
      :confirm-phrase="
        confirmingCloseTarget &&
        CRITICAL_PORTS.has(Number(confirmingCloseTarget.port))
          ? String(confirmingCloseTarget.port)
          : undefined
      "
      :busy="
        confirmingCloseTarget !== null &&
        busy ===
          `close-${closeKey(confirmingCloseTarget.protocol, confirmingCloseTarget.port)}`
      "
      @confirm="
        confirmClose(
          confirmingCloseTarget!.protocol,
          confirmingCloseTarget!.port,
        )
      "
      @cancel="cancelClose"
    />
  </PageLayout>
</template>
