<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  getContributionSettings,
  getExportCandidate,
  listExportableCycles,
  runExport,
  setContributionSettings,
  submitContribution,
  type ContributionSettings,
  type ExportCandidate,
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
const preparingCycleId = ref('')
const preparedCandidates = ref<ExportCandidate[]>([])
const openCandidateId = ref<string | null>(null)

// Suggested community dataset repo -- prefilled as a convenience only; the
// operator can change or clear it, and sharing stays off until they opt in
// and save a token.
const DEFAULT_DATASET_REPO = '0xx0lostcause0xx0/nostrhost-agent'

const contributionSettings = ref<ContributionSettings | null>(null)
const contributionRepo = ref('')
const contributionToken = ref('')
const contributionSaving = ref(false)
const submittingCandidateId = ref('')
const submittedCandidateIds = ref<Set<string>>(new Set())
const submittedPullRequestUrls = ref<Record<string, string>>({})

// Automatic submission is a separate, stronger opt-in from having sharing
// configured at all: it makes the resident daemon submit every completed
// cycle itself with no human review. pendingAutoSubmit tracks the Switch's
// value before Apply; autoSubmitConfirmChecked gates turning it on, the same
// pattern as the dangerous operation-mode levels in OperationModeSection.
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

async function prepareCycle(cycleId: string) {
  preparingCycleId.value = cycleId
  try {
    await sync()
    const candidate = await runExport(cycleId)
    preparedCandidates.value = [
      candidate,
      ...preparedCandidates.value.filter(
        (c) => c.candidate_file_id !== candidate.candidate_file_id,
      ),
    ]
    openCandidateId.value = candidate.candidate_file_id
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to prepare this cycle for review.'))
  } finally {
    preparingCycleId.value = ''
  }
}

async function toggleCandidateOpen(candidateFileId: string) {
  if (openCandidateId.value === candidateFileId) {
    openCandidateId.value = null
    return
  }
  try {
    await sync()
    const fresh = await getExportCandidate(candidateFileId)
    preparedCandidates.value = preparedCandidates.value.map((c) =>
      c.candidate_file_id === candidateFileId ? fresh : c,
    )
    openCandidateId.value = candidateFileId
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to load the prepared candidate.'))
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

async function submitCandidate(candidateFileId: string) {
  submittingCandidateId.value = candidateFileId
  try {
    await sync()
    const result = await submitContribution(candidateFileId)
    submittedCandidateIds.value = new Set([
      ...submittedCandidateIds.value,
      candidateFileId,
    ])
    submittedPullRequestUrls.value = {
      ...submittedPullRequestUrls.value,
      [candidateFileId]: result.pull_request_url,
    }
    success('Submitted for review.')
    // The backend now excludes this cycle from future listings; refresh so
    // it actually disappears from "Completed cycles" instead of lingering
    // until the next unrelated reload.
    exportCycles.value = await listExportableCycles()
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to submit this candidate.'))
  } finally {
    submittingCandidateId.value = ''
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
        Prepare one completed agent decision as a locally-redacted review
        file. Nothing is ever uploaded automatically — sharing is off by
        default, and submitting sends only the single file you review
        below.
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
              : 'No completed agent cycles are ready to export yet.'
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
            <div class="tw:flex tw:justify-end">
              <Button
                variant="outline"
                size="sm"
                :disabled="preparingCycleId === cycle.cycle_id"
                @click="prepareCycle(cycle.cycle_id)"
                >{{
                  preparingCycleId === cycle.cycle_id
                    ? 'Preparing…'
                    : 'Prepare for review'
                }}</Button
              >
            </div>
          </li>
        </ul>
      </div>

      <div v-if="preparedCandidates.length" class="tw:grid tw:gap-2">
        <span class="tw:text-sm tw:font-medium tw:text-foreground"
          >Prepared candidates</span
        >
        <div
          v-for="candidate in preparedCandidates"
          :key="candidate.candidate_file_id"
          class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
        >
          <div class="tw:flex tw:items-center tw:justify-between tw:gap-2">
            <code class="tw:font-mono tw:text-xs">{{
              candidate.candidate_id
            }}</code>
            <div class="tw:flex tw:gap-2">
              <Button
                variant="outline"
                size="sm"
                @click="toggleCandidateOpen(candidate.candidate_file_id)"
                >{{
                  openCandidateId === candidate.candidate_file_id
                    ? 'Hide'
                    : 'Review'
                }}</Button
              >
              <Button
                v-if="
                  contributionSettings?.enabled &&
                  contributionSettings?.token_configured
                "
                variant="primary"
                size="sm"
                :disabled="
                  submittingCandidateId === candidate.candidate_file_id ||
                  submittedCandidateIds.has(candidate.candidate_file_id)
                "
                @click="submitCandidate(candidate.candidate_file_id)"
                >{{
                  submittedCandidateIds.has(candidate.candidate_file_id)
                    ? 'Submitted'
                    : submittingCandidateId === candidate.candidate_file_id
                      ? 'Submitting…'
                      : 'Submit to Hugging Face'
                }}</Button
              >
            </div>
          </div>
          <pre
            v-if="openCandidateId === candidate.candidate_file_id"
            class="tw:m-0 tw:max-h-64 tw:overflow-auto tw:rounded tw:bg-surface-muted tw:p-2 tw:text-[11px]"
            >{{ JSON.stringify(candidate, null, 2) }}</pre
          >
          <a
            v-if="submittedPullRequestUrls[candidate.candidate_file_id]"
            :href="submittedPullRequestUrls[candidate.candidate_file_id]"
            target="_blank"
            rel="noopener noreferrer"
            class="tw:text-xs tw:text-brand-500 tw:underline"
            >View the pull request →</a
          >
        </div>
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
            configured, submitting a candidate above opens a pull request
            with only that one file — never a direct commit, never the raw
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
              When on, the agent submits every completed cycle itself, the
              moment it finishes — with no human review. The automated
              redaction above is the only privacy check before it becomes a
              public pull request. Off by default; leave off to keep
              reviewing each candidate yourself before submitting.
            </p>
          </div>
          <Switch v-model="pendingAutoSubmit" aria-label="Automatic submission" />
        </div>

        <Alert v-if="turningOnAutoSubmit" variant="danger">
          <p class="tw:m-0">
            Every future completed cycle will be redacted and submitted as
            a pull request automatically, with nobody checking it first.
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
              >I understand submissions will happen automatically with no
              review, and want to proceed.</span
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
