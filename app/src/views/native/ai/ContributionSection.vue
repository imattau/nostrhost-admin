<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  getContributionSettings,
  listExportableCycles,
  setContributionSettings,
  shareCycle,
  type ContributionSettings,
  type ExportCycleSummary,
} from '@/api/nativeAgentModels'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { toErrorMessage } from '@/utils/errors'

const { publicKey, sync } = useSigner()
const { success, danger } = useNotifications()

const exportCycles = ref<ExportCycleSummary[]>([])
const exportsLoading = ref(false)
const sharingCycleId = ref('')
const sharedCycleIds = ref<Set<string>>(new Set())
const sharedPullRequestUrls = ref<Record<string, string>>({})

// Suggested community dataset repo -- prefilled as a convenience only; the
// operator can change or clear it, and sharing stays off until they opt in
// and save a token.
const DEFAULT_DATASET_REPO = '0xx0lostcause0xx0/nostrhost-agent'

const contributionSettings = ref<ContributionSettings | null>(null)
const contributionRepo = ref('')
const contributionToken = ref('')
const contributionSaving = ref(false)

// Automatic submission is a standing authorization, not a stronger safety
// tier: both it and the manual "Share" button below redact locally and rely
// on the community repo's own CI validation, with nobody on this host
// reading a candidate before it goes out either way. The distinction that
// still matters is consent granularity -- share each cycle yourself, or let
// every future cycle go out with no click at all until you turn this off.
const pendingAutoSubmit = ref(false)
const autoSubmitConfirmChecked = ref(false)

async function loadExports() {
  exportsLoading.value = true
  try {
    await sync()
    const [cycles, settings] = await Promise.all([
      listExportableCycles(),
      getContributionSettings(),
    ])
    exportCycles.value = cycles
    contributionSettings.value = settings
    pendingAutoSubmit.value = settings.auto_submit
    autoSubmitConfirmChecked.value = false
    contributionRepo.value = settings.dataset_repo || DEFAULT_DATASET_REPO
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to load export data.'))
  } finally {
    exportsLoading.value = false
  }
}

const turningOnAutoSubmit = computed(
  () => pendingAutoSubmit.value && !contributionSettings.value?.auto_submit,
)

async function saveContributionSettings() {
  if (turningOnAutoSubmit.value && !autoSubmitConfirmChecked.value) return
  contributionSaving.value = true
  try {
    await sync()
    const settings = await setContributionSettings(
      contributionRepo.value.trim(),
      pendingAutoSubmit.value,
      contributionToken.value.trim() || undefined,
    )
    contributionSettings.value = settings
    pendingAutoSubmit.value = settings.auto_submit
    autoSubmitConfirmChecked.value = false
    contributionToken.value = ''
    success('Sharing settings saved.')
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to save sharing settings.'))
  } finally {
    contributionSaving.value = false
  }
}

async function share(cycleId: string) {
  sharingCycleId.value = cycleId
  try {
    await sync()
    const result = await shareCycle(cycleId)
    sharedCycleIds.value = new Set([...sharedCycleIds.value, cycleId])
    sharedPullRequestUrls.value = {
      ...sharedPullRequestUrls.value,
      [cycleId]: result.pull_request_url,
    }
    success('Shared.')
    // The backend now excludes this cycle from future listings; refresh so
    // it actually disappears from "Completed cycles" instead of lingering
    // until the next unrelated reload.
    exportCycles.value = await listExportableCycles()
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to share this cycle.'))
  } finally {
    sharingCycleId.value = ''
  }
}

onMounted(() => {
  if (publicKey.value) loadExports()
})
watch(publicKey, (key) => {
  if (key) loadExports()
})
</script>

<template>
  <Card v-if="publicKey">
    <CardHeader>
      <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <span>Export &amp; training data</span>
        <Button
          variant="outline"
          size="sm"
          :disabled="exportsLoading"
          @click="loadExports"
          >{{ exportsLoading ? 'Refreshing…' : 'Refresh' }}</Button
        >
      </CardTitle>
    </CardHeader>
    <CardContent class="tw:grid tw:gap-4">
      <p class="tw:text-sm tw:text-muted-foreground">
        Nothing is ever uploaded automatically — sharing is off by default.
        Sharing a cycle redacts it locally, then opens a pull request
        against the community contribution repo, which validates it (format,
        redaction, no duplicates) and merges it automatically; nobody on
        this host or in that repo reads it by hand first.
      </p>

      <div class="tw:grid tw:gap-2">
        <span class="tw:text-sm tw:font-medium tw:text-foreground"
          >Completed cycles</span
        >
        <p
          v-if="!exportCycles.length"
          class="tw:m-0 tw:text-sm tw:text-muted-foreground"
        >
          {{
            exportsLoading
              ? 'Loading…'
              : 'No completed agent cycles are ready to share yet.'
          }}
        </p>
        <ul v-else class="tw:m-0 tw:grid tw:gap-2 tw:pl-0">
          <li
            v-for="cycle in exportCycles"
            :key="cycle.cycle_id"
            class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
          >
            <div
              class="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2"
            >
              <div class="tw:grid tw:gap-1">
                <span class="tw:text-sm tw:text-foreground">{{
                  cycle.decision === 'no_call' ? 'No action' : cycle.decision
                }}</span>
                <span class="tw:text-xs tw:text-muted-foreground">{{
                  cycle.finished_at
                }}</span>
              </div>
              <Badge variant="neutral">{{ cycle.cycle_result }}</Badge>
            </div>
            <div class="tw:flex tw:items-center tw:justify-end tw:gap-2">
              <a
                v-if="sharedPullRequestUrls[cycle.cycle_id]"
                :href="sharedPullRequestUrls[cycle.cycle_id]"
                target="_blank"
                rel="noopener noreferrer"
                class="tw:text-xs tw:text-brand-500 tw:underline"
                >View the pull request →</a
              >
              <Button
                v-if="
                  contributionSettings?.enabled &&
                  contributionSettings?.token_configured
                "
                variant="primary"
                size="sm"
                :disabled="
                  sharingCycleId === cycle.cycle_id ||
                  sharedCycleIds.has(cycle.cycle_id)
                "
                @click="share(cycle.cycle_id)"
                >{{
                  sharedCycleIds.has(cycle.cycle_id)
                    ? 'Shared'
                    : sharingCycleId === cycle.cycle_id
                      ? 'Sharing…'
                      : 'Share'
                }}</Button
              >
            </div>
          </li>
        </ul>
      </div>

      <div
        class="tw:grid tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
      >
        <div>
          <p class="tw:text-sm tw:font-medium tw:text-foreground">
            Hugging Face sharing
          </p>
          <p class="tw:text-xs tw:text-muted-foreground">
            Off until a dataset repo and token are saved below. Once
            configured, sharing a cycle above opens a pull request with only
            that one redacted cycle — never a direct commit, never the raw
            audit journal.
          </p>
        </div>

        <div class="tw:grid tw:gap-1.5">
          <Label for="hf-repo">Dataset repo</Label>
          <Input
            id="hf-repo"
            v-model="contributionRepo"
            placeholder="owner/dataset"
            spellcheck="false"
            autocomplete="off"
          />
        </div>
        <div class="tw:grid tw:gap-1.5">
          <Label for="hf-token">Hugging Face token</Label>
          <Input
            id="hf-token"
            v-model="contributionToken"
            type="password"
            autocomplete="off"
            :placeholder="
              contributionSettings?.token_configured
                ? 'Token already saved — leave blank to keep it'
                : 'hf_…'
            "
          />
        </div>

        <div
          class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
        >
          <div>
            <p class="tw:text-sm tw:font-medium tw:text-foreground">
              Automatic submission
            </p>
            <p class="tw:text-xs tw:text-muted-foreground">
              When on, the agent shares every completed cycle itself, the
              moment it finishes — no click needed from you. It's the same
              redaction and the same community-repo validation as sharing a
              cycle yourself; the difference is that it keeps happening on
              its own until you turn it off. Off by default, so you choose
              which cycles to share.
            </p>
          </div>
          <Switch v-model="pendingAutoSubmit" aria-label="Automatic submission" />
        </div>

        <Alert v-if="turningOnAutoSubmit" variant="danger">
          <p class="tw:m-0">
            Every future completed cycle will be shared automatically, with
            no click from you, until you turn this off again.
          </p>
          <label
            class="tw:mt-2 tw:flex tw:items-start tw:gap-2 tw:text-xs tw:text-foreground"
          >
            <input
              v-model="autoSubmitConfirmChecked"
              type="checkbox"
              class="tw:mt-0.5 tw:size-4 tw:rounded tw:border-border-subtle"
            />
            <span
              >I understand this keeps sharing automatically until I turn it
              off, and want to proceed.</span
            >
          </label>
        </Alert>

        <div class="tw:flex tw:justify-end">
          <Button
            variant="primary"
            size="sm"
            :disabled="
              contributionSaving ||
              !contributionRepo.trim() ||
              (turningOnAutoSubmit && !autoSubmitConfirmChecked)
            "
            @click="saveContributionSettings"
            >{{ contributionSaving ? 'Saving…' : 'Save' }}</Button
          >
        </div>
      </div>
    </CardContent>
  </Card>
</template>
