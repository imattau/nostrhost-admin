<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'

import { publishNsite } from '@/api/nativeNsites'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useActionRunner } from '@/composables/useActionRunner'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { parseList } from '@/lib/utils'
import { toErrorMessage } from '@/utils/errors'
import { inventoryFromFiles, type InventoryItem } from '@/lib/nsite/inventory'
import {
  buildUnsignedManifest,
  planDigest,
  KIND_ROOT,
  KIND_NAMED,
} from '@/lib/nsite/manifest'
import { uploadToBlossom, type BlossomResult } from '@/lib/nsite/blossom'
import { signAndSubmit } from '@/lib/nsite/publish'
import { NSITE_STATE_KEY } from './useNsiteState'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [boolean] }>()

const { publicKey } = useSigner()
const { success, danger } = useNotifications()
const nsite = inject(NSITE_STATE_KEY)!
const { status } = nsite

const wizardStep = ref(0) // 0 identity · 1 directory · 2 targets · 3 upload · 4 review · 5 sign/submit · 6 done
const signerAvailable = ref(Boolean(window.nostr))
const publishBusy = ref('')
const { run } = useActionRunner(publishBusy, '')

const wKind = ref(String(KIND_ROOT))
const wD = ref('')
const wTitle = ref('')
const selectedFiles = ref<File[]>([])
const filesByPath = new Map<string, File>()
const inventory = ref<InventoryItem[]>([])
const wServers = ref('')
const wRelays = ref('')
const wBlossomResults = ref<BlossomResult[]>([])
const uploadProgress = ref({ done: 0, total: 0, path: '' })
const reviewDigest = ref('')
const reviewEvent = ref<unknown>(null)
const publishResult = ref<unknown>(null)

const publishEventId = computed(() => {
  const value = publishResult.value as { event_id?: string } | null
  return value?.event_id?.slice(0, 16) ?? ''
})

const publishSiteUrl = computed(() => {
  const value = publishResult.value as { site_url?: string } | null
  return value?.site_url
})

function openPublish() {
  publishResult.value = null
  wizardStep.value = 0
  selectedFiles.value = []
  filesByPath.clear()
  inventory.value = []
  wBlossomResults.value = []
  uploadProgress.value = { done: 0, total: 0, path: '' }
  reviewDigest.value = ''
  reviewEvent.value = null
  signerAvailable.value = Boolean(window.nostr)
  wServers.value = (status.value?.config?.blossom?.fallback_servers ?? []).join(
    ', ',
  )
  wRelays.value = 'wss://purplepag.es, wss://nos.lol, wss://relay.damus.io'
}

// SitesSection toggles visibility via v-model; reset the wizard each time it
// opens, same as the old inline openPublish() did on click.
watch(
  () => props.visible,
  (visible) => {
    if (visible) openPublish()
  },
)

function closePublish() {
  wizardStep.value = 0
  emit('update:visible', false)
}

async function stepIdentity() {
  if (!wTitle.value.trim()) {
    danger('Give the site a title.')
    return
  }
  if (
    Number(wKind.value) === KIND_NAMED &&
    !/^[a-z0-9-]{1,13}$/.test(wD.value)
  ) {
    danger('A named-site d tag is 1–13 lowercase letters, digits or hyphens.')
    return
  }
  if (!signerAvailable.value) {
    danger(
      'Publishing needs a NIP-07 signer (window.nostr). Sign in with one, or wait for NIP-46.',
    )
    return
  }
  wizardStep.value = 1
}

async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  input.value = ''
  inventory.value = []
  if (!files.length) return
  selectedFiles.value = files
  filesByPath.clear()
  for (const file of files) filesByPath.set(file.webkitRelativePath, file)
  try {
    const items = await inventoryFromFiles(files)
    inventory.value = items
    if (!items.length) return
    success(
      `${items.length} file(s), ${formatBytes(items.reduce((sum, item) => sum + item.size, 0))}.`,
    )
  } catch (cause) {
    danger(toErrorMessage(cause, 'Inventory failed.'))
  }
}

function stepTargets() {
  if (!inventory.value.length) {
    danger('Choose a directory with files first.')
    return
  }
  if (!wServers.value.trim()) {
    danger('At least one Blossom server is required to host the blobs.')
    return
  }
  wizardStep.value = 2
}

async function doUpload() {
  await run(
    'upload',
    async () => {
      wBlossomResults.value = []
      const servers = parseList(wServers.value)
      const items = inventory.value.map((item) => ({
        path: item.path,
        sha256: item.sha256,
      }))
      for (const server of servers) {
        const result = await uploadToBlossom(
          server,
          items,
          async (path) => {
            const file = filesByPath.get(path)
            return file ? new Uint8Array(await file.arrayBuffer()) : null
          },
          {
            pubkey: publicKey.value ?? '',
            signEvent: (event) => window.nostr!.signEvent(event),
            onProgress: (done, total, path) => {
              uploadProgress.value = { done, total, path }
            },
          },
        )
        wBlossomResults.value.push(result)
      }
      const allOk = wBlossomResults.value.every((result) => result.ok)
      if (!allOk) {
        danger(
          'Some blobs failed to upload. Review the per-server results below.',
        )
        return
      }
      wizardStep.value = 3
    },
    'Upload failed.',
  )
}

async function doReview() {
  await run(
    'review',
    async () => {
      const items = inventory.value.map((item) => ({
        path: item.path,
        sha256: item.sha256,
      }))
      const servers = parseList(wServers.value)
      const relays = parseList(wRelays.value)
      const digest = await planDigest({
        kind: Number(wKind.value),
        d: Number(wKind.value) === KIND_NAMED ? wD.value : '',
        paths: items,
        servers,
      })
      const { event } = await buildUnsignedManifest({
        pubkey: publicKey.value ?? '',
        kind: Number(wKind.value),
        d: Number(wKind.value) === KIND_NAMED ? wD.value : '',
        items,
        servers,
      })
      reviewDigest.value = digest
      reviewEvent.value = event
      wRelays.value = relays.join(', ')
      wizardStep.value = 4
    },
    'Review failed.',
  )
}

async function doPublish() {
  await run(
    'publish',
    async () => {
      const items = inventory.value.map((item) => ({
        path: item.path,
        sha256: item.sha256,
      }))
      const servers = parseList(wServers.value)
      const relays = parseList(wRelays.value)
      const outcome = await signAndSubmit({
        pubkey: publicKey.value ?? '',
        kind: Number(wKind.value),
        d: Number(wKind.value) === KIND_NAMED ? wD.value : '',
        items,
        servers,
        relays,
        signEvent: (event) => window.nostr!.signEvent(event),
        submit: (args) =>
          publishNsite({
            event: args.event,
            plan_sha256: args.plan_sha256,
            relays: args.relays,
          }),
      })
      publishResult.value = outcome
      wizardStep.value = 5
      await Promise.all([nsite.load(), nsite.loadSites()])
    },
    'Publish failed.',
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / 1048576).toFixed(1)} MiB`
}

function openSite(url: string | undefined) {
  if (url) window.open(url, '_blank')
}
</script>

<template>
  <Card v-if="visible">
    <CardHeader>
      <CardTitle>
        Publish a site
        <span class="tw:text-sm tw:font-normal tw:text-muted-foreground">
          step {{ wizardStep + 1 }} of 6
        </span>
      </CardTitle>
    </CardHeader>
    <CardContent class="tw:grid tw:gap-3">
      <!-- step 1: identity -->
      <template v-if="wizardStep === 0">
        <div class="tw:grid tw:gap-1.5">
          <Label for="w-title">Site title</Label>
          <Input id="w-title" v-model="wTitle" spellcheck="false" />
        </div>
        <div class="tw:grid tw:gap-1.5">
          <Label for="w-kind">Site type</Label>
          <Select id="w-kind" v-model="wKind">
            <option :value="String(KIND_ROOT)">Root site (npub address)</option>
            <option :value="String(KIND_NAMED)">
              Named site (custom d label)
            </option>
          </Select>
        </div>
        <div v-if="Number(wKind) === KIND_NAMED" class="tw:grid tw:gap-1.5">
          <Label for="w-d">d label</Label>
          <Input
            id="w-d"
            v-model="wD"
            placeholder="blog"
            spellcheck="false"
            autocomplete="off"
          />
        </div>
        <Alert v-if="!signerAvailable" variant="warning">
          No NIP-07 signer detected. Publishing needs a browser signer
          (window.nostr) until NIP-46 support lands.
        </Alert>
        <div v-else class="tw:flex tw:justify-end">
          <Button size="sm" @click="stepIdentity">Next</Button>
        </div>
      </template>

      <!-- step 2: directory -->
      <template v-else-if="wizardStep === 1">
        <div class="tw:grid tw:gap-1.5">
          <Label for="w-dir">Site directory</Label>
          <Input
            id="w-dir"
            type="file"
            webkitdirectory
            directory=""
            multiple
            @change="onFilesSelected"
          />
          <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
            Select the folder that becomes the site root. Files are hashed in
            your browser (Web Crypto); paths with &quot;..&quot; and files over
            32 MiB are rejected.
          </p>
        </div>
        <div v-if="inventory.length" class="tw:grid tw:gap-1">
          <p class="tw:m-0 tw:text-sm">
            {{ inventory.length }} file(s) · total
            {{
              formatBytes(inventory.reduce((sum, item) => sum + item.size, 0))
            }}
          </p>
          <ul
            class="tw:m-0 tw:max-h-48 tw:overflow-auto tw:grid tw:gap-1 tw:p-0 tw:list-none tw:text-xs tw:font-mono"
          >
            <li
              v-for="item in inventory.slice(0, 50)"
              :key="item.path"
              class="tw:truncate"
            >
              {{ item.path }} · {{ formatBytes(item.size) }}
            </li>
            <li v-if="inventory.length > 50" class="tw:text-muted-foreground">
              …and {{ inventory.length - 50 }} more
            </li>
          </ul>
        </div>
        <div class="tw:flex tw:justify-end tw:gap-2">
          <Button variant="outline" size="sm" @click="wizardStep = 0"
            >Back</Button
          >
          <Button size="sm" :disabled="!inventory.length" @click="stepTargets"
            >Next</Button
          >
        </div>
      </template>

      <!-- step 3: servers + relays -->
      <template v-else-if="wizardStep === 2">
        <div class="tw:grid tw:gap-1.5">
          <Label for="w-servers">Blossom servers (comma-separated)</Label>
          <Input
            id="w-servers"
            v-model="wServers"
            placeholder="https://blossom.primal.net"
            spellcheck="false"
            autocomplete="off"
          />
          <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
            Blobs are uploaded from your browser straight to these servers
            (BUD-01). The manifest will list them as server hints.
          </p>
        </div>
        <div class="tw:grid tw:gap-1.5">
          <Label for="w-relays">Publish relays (comma-separated)</Label>
          <Input
            id="w-relays"
            v-model="wRelays"
            spellcheck="false"
            autocomplete="off"
          />
        </div>
        <div class="tw:flex tw:justify-end tw:gap-2">
          <Button variant="outline" size="sm" @click="wizardStep = 1"
            >Back</Button
          >
          <Button
            size="sm"
            :disabled="publishBusy === 'upload'"
            @click="doUpload"
            >{{
              publishBusy === 'upload' ? 'Uploading…' : 'Upload blobs'
            }}</Button
          >
        </div>
      </template>

      <!-- step 4: upload progress -->
      <template v-else-if="wizardStep === 3">
        <p class="tw:m-0 tw:text-sm">
          Uploading
          <template v-if="uploadProgress.total">
            {{ uploadProgress.done }} / {{ uploadProgress.total }}
          </template>
          <template v-if="uploadProgress.path">
            · <code class="tw:font-mono">{{ uploadProgress.path }}</code>
          </template>
        </p>
        <div
          v-for="result in wBlossomResults"
          :key="result.server"
          class="tw:grid tw:gap-1 tw:rounded-md tw:border tw:px-3 tw:py-2 tw:text-sm"
        >
          <div class="tw:flex tw:items-center tw:gap-2">
            <code class="tw:font-mono">{{ result.server }}</code>
            <Badge :variant="result.ok ? 'success' : 'danger'">{{
              result.ok ? 'ok' : 'failed'
            }}</Badge>
          </div>
          <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
            {{ result.uploaded.length }} uploaded ·
            {{ result.skipped.length }} skipped ·
            {{ result.failed.length }} failed
          </p>
        </div>
        <div class="tw:flex tw:justify-end tw:gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="publishBusy !== ''"
            @click="wizardStep = 2"
            >Back</Button
          >
          <Button size="sm" :disabled="publishBusy !== ''" @click="doReview"
            >Review manifest</Button
          >
        </div>
      </template>

      <!-- step 5: review -->
      <template v-else-if="wizardStep === 4">
        <p class="tw:m-0 tw:text-sm">
          Kind <code class="tw:font-mono">{{ wKind }}</code> · d
          <code class="tw:font-mono">{{ wD || '—' }}</code>
        </p>
        <div class="tw:grid tw:gap-1">
          <p class="tw:m-0 tw:text-sm">Tags to be signed:</p>
          <pre
            class="tw:m-0 tw:max-h-48 tw:overflow-auto tw:rounded tw:bg-muted tw:p-2 tw:text-xs tw:font-mono"
            >{{ JSON.stringify(reviewEvent, null, 2) }}</pre
          >
        </div>
        <p class="tw:m-0 tw:text-sm">
          Plan digest
          <code class="tw:font-mono">{{ reviewDigest }}</code>
        </p>
        <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
          Editing anything above (kind, d, files, servers) discards this digest
          — go back and re-review.
        </p>
        <div class="tw:flex tw:justify-end tw:gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="publishBusy !== ''"
            @click="wizardStep = 2"
            >Back</Button
          >
          <Button size="sm" :disabled="publishBusy !== ''" @click="doPublish">{{
            publishBusy === 'publish' ? 'Publishing…' : 'Sign &amp; publish'
          }}</Button>
        </div>
      </template>

      <!-- step 6: result -->
      <template v-else-if="wizardStep === 5">
        <div class="tw:grid tw:gap-1 tw:text-sm">
          <p class="tw:m-0">
            Published
            <code class="tw:font-mono">{{ publishEventId || '…' }}</code>
          </p>
          <template v-if="publishSiteUrl">
            <p class="tw:m-0">
              Site URL
              <code class="tw:font-mono">{{ publishSiteUrl }}</code>
            </p>
            <div class="tw:flex tw:justify-end">
              <Button
                size="sm"
                variant="outline"
                @click="openSite(publishSiteUrl)"
                >Open site</Button
              >
            </div>
          </template>
          <p v-else class="tw:m-0 tw:text-xs tw:text-muted-foreground">
            The publish is pending approval or was submitted; check the
            operations list for the chain result.
          </p>
        </div>
        <div class="tw:flex tw:justify-end">
          <Button size="sm" @click="closePublish">Done</Button>
        </div>
      </template>
    </CardContent>
  </Card>
</template>
