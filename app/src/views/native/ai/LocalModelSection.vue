<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  downloadModel,
  getModelProfile,
  getModelRecommendations,
  getModelStatus,
  selectModel,
  type HostCapabilities,
  type ModelRecommendation,
  type ModelStatus,
} from '@/api/nativeAgentModels'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { formatBytes } from '@/lib/utils'
import { toErrorMessage } from '@/utils/errors'

const emit = defineEmits<{ 'model-selected': [] }>()

const { publicKey, sync } = useSigner()
const { success, danger } = useNotifications()

const hostProfile = ref<HostCapabilities | null>(null)
const recommendations = ref<ModelRecommendation[]>([])
const modelStatus = ref<ModelStatus | null>(null)
const modelsLoading = ref(false)
const selectedModelId = ref('')
const downloadingModelId = ref('')
const selectingModelId = ref('')
const evalAcknowledged = ref(false)

const selectedRecommendation = computed(() =>
  recommendations.value.find((r) => r.model.id === selectedModelId.value),
)
const selectedIsDownloaded = computed(
  () => modelStatus.value?.selected_model === selectedModelId.value,
)

async function loadModels() {
  modelsLoading.value = true
  try {
    await sync()
    const [profile, recommend, status] = await Promise.all([
      getModelProfile(),
      getModelRecommendations(),
      getModelStatus(),
    ])
    hostProfile.value = profile
    recommendations.value = recommend.models
    modelStatus.value = status
    if (!selectedModelId.value && recommendations.value.length) {
      selectedModelId.value = recommendations.value[0].model.id
    }
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to load model catalog.'))
  } finally {
    modelsLoading.value = false
  }
}

async function downloadSelectedModel() {
  const recommendation = selectedRecommendation.value
  if (!recommendation) return
  downloadingModelId.value = recommendation.model.id
  try {
    await sync()
    await downloadModel(recommendation.model.id, !recommendation.model.deployment_eligible)
    await loadModels()
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to download the model.'))
  } finally {
    downloadingModelId.value = ''
  }
}

async function useSelectedModel() {
  const recommendation = selectedRecommendation.value
  if (!recommendation) return
  if (!recommendation.model.deployment_eligible && !evalAcknowledged.value) return
  selectingModelId.value = recommendation.model.id
  try {
    await sync()
    await selectModel(recommendation.model.id)
    success(`Now using ${recommendation.model.id}.`)
    await loadModels()
    emit('model-selected')
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to switch to this model.'))
  } finally {
    selectingModelId.value = ''
  }
}

watch(selectedModelId, () => {
  evalAcknowledged.value = false
})

onMounted(() => {
  if (publicKey.value) loadModels()
})
watch(publicKey, (key) => {
  if (key) loadModels()
})
</script>

<template>
  <Card v-if="publicKey">
    <CardHeader>
      <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <span>Local model</span>
        <Button
          variant="outline"
          size="sm"
          :disabled="modelsLoading"
          @click="loadModels"
          >{{ modelsLoading ? 'Refreshing…' : 'Refresh' }}</Button
        >
      </CardTitle>
    </CardHeader>
    <CardContent class="tw:grid tw:gap-4">
      <p class="tw:text-sm tw:text-muted-foreground">
        Run a local model on this node instead of a remote API. Every
        candidate below currently fails the agent's own safety/quality
        gate — they can be downloaded and used for testing (evaluation
        only), but are not recommended for unattended operation.
      </p>

      <p
        v-if="hostProfile"
        class="tw:m-0 tw:text-xs tw:text-muted-foreground"
      >
        This host: {{ hostProfile.logical_cpus }} CPUs,
        {{ formatBytes(hostProfile.memory_available_bytes) }} available of
        {{ formatBytes(hostProfile.memory_total_bytes) }} RAM,
        {{ formatBytes(hostProfile.model_dir_free_bytes) }} free disk.
      </p>

      <div v-if="recommendations.length" class="tw:grid tw:gap-2">
        <Label for="model-select">Candidate model</Label>
        <Select id="model-select" v-model="selectedModelId">
          <option
            v-for="rec in recommendations"
            :key="rec.model.id"
            :value="rec.model.id"
          >
            {{ rec.model.name }} ({{ formatBytes(rec.model.size_bytes) }})
          </option>
        </Select>

        <template v-if="selectedRecommendation">
          <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            <Badge
              :variant="
                selectedRecommendation.model.deployment_eligible
                  ? 'success'
                  : 'warning'
              "
              >{{ selectedRecommendation.model.evaluation_status }}</Badge
            >
            <Badge
              :variant="
                selectedRecommendation.assessment.resource_compatible
                  ? 'success'
                  : 'danger'
              "
              >{{
                selectedRecommendation.assessment.resource_compatible
                  ? 'fits this host'
                  : 'does not fit this host'
              }}</Badge
            >
            <Badge v-if="selectedIsDownloaded" variant="brand"
              >in use</Badge
            >
          </div>
          <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
            {{ selectedRecommendation.model.evaluation_note }}
          </p>

          <div class="tw:flex tw:justify-end tw:gap-2">
            <Button
              variant="outline"
              size="sm"
              :disabled="
                !!downloadingModelId ||
                !selectedRecommendation.assessment.resource_compatible
              "
              @click="downloadSelectedModel"
              >{{
                downloadingModelId === selectedModelId
                  ? 'Downloading…'
                  : 'Download'
              }}</Button
            >
          </div>

          <template
            v-if="!selectedRecommendation.model.deployment_eligible"
          >
            <label
              class="tw:flex tw:items-start tw:gap-2 tw:text-xs tw:text-foreground"
            >
              <input
                v-model="evalAcknowledged"
                type="checkbox"
                class="tw:mt-0.5 tw:size-4 tw:rounded tw:border-border-subtle"
              />
              <span
                >I understand this model has not passed the agent's
                safety/quality gate and is evaluation-only.</span
              >
            </label>
          </template>

          <div class="tw:flex tw:justify-end">
            <Button
              variant="primary"
              size="sm"
              :disabled="
                !!selectingModelId ||
                selectedIsDownloaded ||
                (!selectedRecommendation.model.deployment_eligible &&
                  !evalAcknowledged)
              "
              @click="useSelectedModel"
              >{{
                selectingModelId === selectedModelId
                  ? 'Switching…'
                  : selectedIsDownloaded
                    ? 'Currently in use'
                    : 'Use this model'
              }}</Button
            >
          </div>
        </template>
      </div>
      <p v-else class="tw:m-0 tw:text-sm tw:text-muted-foreground">
        {{ modelsLoading ? 'Loading…' : 'No candidate models available.' }}
      </p>
    </CardContent>
  </Card>
</template>
