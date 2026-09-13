<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  getIgnoredFilters,
  ignoreDiagnosisFilter,
  runDiagnosis,
  unignoreDiagnosisFilter,
  type DiagnosisItem,
  type DiagnosisReport,
  type DiagnosisStatus,
  type IgnoreFilterCriteria,
} from '@/api/nativeDiagnosis'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSigner } from '@/composables/useSigner'

const { publicKey, signerAvailable, sync } = useSigner()

const reports = ref<DiagnosisReport[]>([])
const ignoreFilters = ref<Record<string, IgnoreFilterCriteria[]>>({})
const loading = ref(false)
const error = ref('')
const notice = ref('')
const busy = ref('')

const issueCount = computed(() =>
  reports.value.reduce(
    (sum, report) =>
      sum +
      report.items.filter(
        (item) =>
          !item.ignored &&
          (item.status === 'WARNING' || item.status === 'ERROR'),
      ).length,
    0,
  ),
)

async function load(force = false) {
  loading.value = true
  error.value = ''
  try {
    await sync()
    const [runResult, ignoredResult] = await Promise.all([
      runDiagnosis({ full: true, force }),
      getIgnoredFilters(),
    ])
    reports.value = runResult.reports ?? []
    ignoreFilters.value = ignoredResult.ignore_filters
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to load diagnosis.'
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

async function refresh() {
  busy.value = 'refresh'
  error.value = ''
  notice.value = ''
  try {
    await load(true)
    notice.value = 'Diagnosis refreshed.'
  } finally {
    busy.value = ''
  }
}

function statusVariant(status: DiagnosisStatus) {
  if (status === 'ERROR') return 'danger' as const
  if (status === 'WARNING') return 'warning' as const
  if (status === 'SUCCESS') return 'success' as const
  return 'neutral' as const
}

function itemFilter(report: DiagnosisReport, item: DiagnosisItem): string[] {
  const meta = item.meta ?? {}
  return [
    report.id,
    ...Object.entries(meta).map(([key, value]) => `${key}=${value}`),
  ]
}

// -- ignore an issue ----------------------------------------------------------

const confirmingIgnore = ref<string | null>(null)

function issueKey(report: DiagnosisReport, item: DiagnosisItem) {
  return `${report.id}:${item.summary}`
}

function requestIgnore(report: DiagnosisReport, item: DiagnosisItem) {
  notice.value = ''
  error.value = ''
  confirmingIgnore.value = issueKey(report, item)
}

function cancelIgnore() {
  confirmingIgnore.value = null
}

async function confirmIgnore(report: DiagnosisReport, item: DiagnosisItem) {
  confirmingIgnore.value = null
  const key = issueKey(report, item)
  busy.value = `ignore-${key}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await ignoreDiagnosisFilter(itemFilter(report, item))
    notice.value = `Issue ignored.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to ignore issue.'
  } finally {
    busy.value = ''
  }
}

// -- ignored filters ------------------------------------------------------

const ignoredFilterRows = computed(() =>
  Object.entries(ignoreFilters.value).flatMap(([category, criteriaList]) =>
    criteriaList.map((criteria) => ({ category, criteria })),
  ),
)

function criteriaLabel(criteria: IgnoreFilterCriteria) {
  const entries = Object.entries(criteria)
  return entries.length === 0
    ? '(all issues in this category)'
    : entries.map(([key, value]) => `${key}=${value}`).join(', ')
}

function filterOf(category: string, criteria: IgnoreFilterCriteria) {
  return [
    category,
    ...Object.entries(criteria).map(([key, value]) => `${key}=${value}`),
  ]
}

const confirmingUnignore = ref<string | null>(null)

function requestUnignore(category: string, criteria: IgnoreFilterCriteria) {
  notice.value = ''
  error.value = ''
  confirmingUnignore.value = `${category}:${criteriaLabel(criteria)}`
}

function cancelUnignore() {
  confirmingUnignore.value = null
}

async function confirmUnignore(
  category: string,
  criteria: IgnoreFilterCriteria,
) {
  confirmingUnignore.value = null
  const key = `${category}:${criteriaLabel(criteria)}`
  busy.value = `unignore-${key}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await unignoreDiagnosisFilter(filterOf(category, criteria))
    notice.value = `Filter removed.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to remove filter.'
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
        System maintenance
      </p>
      <h1 class="tw:mt-1 tw:text-2xl tw:font-bold tw:text-foreground">
        Diagnosis
      </h1>
      <p class="tw:mt-2 tw:max-w-2xl tw:text-sm tw:text-muted-foreground">
        Health checks across DNS, mail, certificates, ports and more. Ignoring
        an issue mutes it until it's un-ignored — it is not fixed.
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
            <span
              >Report
              <Badge :variant="issueCount === 0 ? 'success' : 'warning'">{{
                issueCount === 0 ? 'healthy' : `${issueCount} issue(s)`
              }}</Badge></span
            >
            <Button
              variant="outline"
              size="sm"
              :disabled="busy !== ''"
              @click="refresh"
              >{{ busy === 'refresh' ? 'Refreshing…' : 'Refresh' }}</Button
            >
          </CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-4">
          <p v-if="loading" class="tw:m-0 tw:text-sm tw:text-muted-foreground">
            Loading…
          </p>
          <p
            v-else-if="reports.length === 0"
            class="tw:m-0 tw:text-sm tw:text-muted-foreground"
          >
            No diagnosis data yet.
          </p>
          <div
            v-for="report in reports"
            v-else
            :key="report.id"
            class="tw:grid tw:gap-2"
          >
            <h3 class="tw:m-0 tw:text-sm tw:font-semibold">
              {{ report.description }}
            </h3>
            <ul class="tw:m-0 tw:grid tw:gap-2 tw:pl-0">
              <li
                v-for="item in report.items"
                :key="issueKey(report, item)"
                class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
              >
                <div class="tw:flex tw:items-start tw:justify-between tw:gap-3">
                  <div class="tw:flex tw:items-start tw:gap-2">
                    <Badge :variant="statusVariant(item.status)">{{
                      item.status
                    }}</Badge>
                    <p class="tw:m-0 tw:text-sm">{{ item.summary }}</p>
                  </div>
                  <Badge v-if="item.ignored" variant="neutral">ignored</Badge>
                </div>
                <ul
                  v-if="item.details?.length"
                  class="tw:m-0 tw:grid tw:gap-1 tw:pl-4 tw:text-xs tw:text-muted-foreground"
                >
                  <li v-for="(detail, index) in item.details" :key="index">
                    {{ detail }}
                  </li>
                </ul>

                <template
                  v-if="
                    !item.ignored &&
                    (item.status === 'WARNING' || item.status === 'ERROR')
                  "
                >
                  <div
                    v-if="confirmingIgnore === issueKey(report, item)"
                    class="tw:flex tw:items-center tw:justify-end tw:gap-2"
                  >
                    <span class="tw:text-xs tw:text-muted-foreground"
                      >Ignore this issue?</span
                    >
                    <Button variant="outline" size="sm" @click="cancelIgnore"
                      >Cancel</Button
                    >
                    <Button
                      variant="danger"
                      size="sm"
                      :disabled="busy !== ''"
                      @click="confirmIgnore(report, item)"
                      >Confirm</Button
                    >
                  </div>
                  <div v-else class="tw:flex tw:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      :disabled="busy !== ''"
                      @click="requestIgnore(report, item)"
                      >{{
                        busy === `ignore-${issueKey(report, item)}`
                          ? 'Ignoring…'
                          : 'Ignore'
                      }}</Button
                    >
                  </div>
                </template>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ignored filters</CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-2">
          <p
            v-if="ignoredFilterRows.length === 0"
            class="tw:m-0 tw:text-sm tw:text-muted-foreground"
          >
            No issues are currently ignored.
          </p>
          <ul v-else class="tw:m-0 tw:grid tw:gap-1 tw:pl-0">
            <li
              v-for="row in ignoredFilterRows"
              :key="`${row.category}:${criteriaLabel(row.criteria)}`"
              class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3 tw:text-sm"
            >
              <div>
                <code class="tw:font-mono">{{ row.category }}</code>
                <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
                  {{ criteriaLabel(row.criteria) }}
                </p>
              </div>
              <template
                v-if="
                  confirmingUnignore ===
                  `${row.category}:${criteriaLabel(row.criteria)}`
                "
              >
                <span class="tw:flex tw:items-center tw:gap-2">
                  <span class="tw:text-xs tw:text-muted-foreground"
                    >Unignore?</span
                  >
                  <Button variant="outline" size="sm" @click="cancelUnignore"
                    >Cancel</Button
                  >
                  <Button
                    variant="danger"
                    size="sm"
                    :disabled="busy !== ''"
                    @click="confirmUnignore(row.category, row.criteria)"
                    >Confirm</Button
                  >
                </span>
              </template>
              <Button
                v-else
                variant="outline"
                size="sm"
                :disabled="busy !== ''"
                @click="requestUnignore(row.category, row.criteria)"
                >{{
                  busy ===
                  `unignore-${row.category}:${criteriaLabel(row.criteria)}`
                    ? 'Removing…'
                    : 'Unignore'
                }}</Button
              >
            </li>
          </ul>
        </CardContent>
      </Card>
    </template>
  </section>
</template>
