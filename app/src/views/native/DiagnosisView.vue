<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

import {
  ignoreIssue,
  runDiagnosis,
  unignoreIssue,
  type DiagnosisItem,
  type DiagnosisReport,
  type DiagnosisStatus,
} from '@/api/nativeDiagnosis'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSigner } from '@/composables/useSigner'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { publicKey, admin, sync } = useSigner()

const reports = ref<DiagnosisReport[] | null>(null)
const error = ref('')
const loading = ref(false)
const running = ref(false)

// Keyed by `${category}:${JSON.stringify(item.meta)}` — the same identity
// diagnosis_ignore matches issues by (see docs/reference/diagnosis-engine.md
// §The ignore-filter workflow).
const filterBusy = reactive<Record<string, boolean>>({})
const filterError = reactive<Record<string, string>>({})

function itemKey(categoryId: string, item: DiagnosisItem) {
  return `${categoryId}:${JSON.stringify(item.meta ?? {})}`
}

const totals = computed(() => {
  const counts: Record<DiagnosisStatus, number> = {
    SUCCESS: 0,
    INFO: 0,
    WARNING: 0,
    ERROR: 0,
  }
  for (const report of reports.value ?? []) {
    for (const item of report.items) {
      if (item.ignored) continue
      counts[item.status]++
    }
  }
  return counts
})

function statusVariant(status: DiagnosisStatus) {
  if (status === 'SUCCESS') return 'success'
  if (status === 'WARNING') return 'warning'
  if (status === 'ERROR') return 'danger'
  return 'neutral'
}

async function load(force = false) {
  loading.value = true
  error.value = ''
  try {
    await sync()
    reports.value = await runDiagnosis([], force)
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to load diagnosis.'
  } finally {
    loading.value = false
  }
}

async function runNow() {
  running.value = true
  error.value = ''
  try {
    await sync()
    reports.value = await runDiagnosis([], true)
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Diagnosis run failed.'
  } finally {
    running.value = false
  }
}

async function toggleIgnore(categoryId: string, item: DiagnosisItem) {
  const key = itemKey(categoryId, item)
  filterBusy[key] = true
  filterError[key] = ''
  try {
    await sync()
    if (item.ignored) {
      await unignoreIssue(categoryId, item.meta ?? {})
    } else {
      await ignoreIssue(categoryId, item.meta ?? {})
    }
    item.ignored = !item.ignored
  } catch (cause) {
    filterError[key] =
      cause instanceof Error ? cause.message : 'Failed to update the ignore filter.'
  } finally {
    filterBusy[key] = false
  }
}

onMounted(() => {
  if (publicKey.value) load()
})
watch(publicKey, (key) => {
  if (key) load()
})
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="System health"
      title="Diagnosis"
      description="Per-category health checks — DNS, mail, ports, services, and more. Ignoring an issue keeps future runs from reporting it again until you un-ignore it; it does not fix anything."
    />

    <Alert v-if="error" variant="danger" role="alert">{{ error }}</Alert>

    <div v-if="publicKey" class="tw:flex tw:items-center tw:justify-between tw:gap-3">
      <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <Badge v-if="totals.ERROR" variant="danger">{{ totals.ERROR }} error(s)</Badge>
        <Badge v-if="totals.WARNING" variant="warning"
          >{{ totals.WARNING }} warning(s)</Badge
        >
        <Badge v-if="!totals.ERROR && !totals.WARNING && reports" variant="success"
          >All clear</Badge
        >
        <span v-if="reports" class="tw:text-xs tw:text-muted-foreground"
          >{{ reports.length }} categor{{ reports.length === 1 ? 'y' : 'ies' }}</span
        >
      </div>
      <div class="tw:flex tw:gap-2">
        <Button variant="outline" size="sm" :disabled="loading || running" @click="load(false)">{{
          loading ? 'Refreshing…' : 'Refresh'
        }}</Button>
        <Button variant="primary" size="sm" :disabled="loading || running" @click="runNow">{{
          running ? 'Running…' : 'Run diagnosis now'
        }}</Button>
      </div>
    </div>

    <template v-if="publicKey">
      <Card v-for="report in reports ?? []" :key="report.id">
        <CardHeader>
          <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
            <span>{{ report.description || report.id }}</span>
            <code class="tw:text-xs tw:font-normal tw:text-muted-foreground">{{
              report.id
            }}</code>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul v-if="report.items.length" class="tw:grid tw:gap-2">
            <li
              v-for="item in report.items"
              :key="itemKey(report.id, item)"
              class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
              :class="{ 'tw:opacity-60': item.ignored }"
            >
              <div class="tw:flex tw:items-start tw:justify-between tw:gap-3">
                <div class="tw:flex tw:items-start tw:gap-2">
                  <Badge :variant="statusVariant(item.status)">{{ item.status }}</Badge>
                  <span class="tw:text-sm tw:text-foreground">{{ item.summary }}</span>
                </div>
                <div
                  v-if="admin && (item.status === 'WARNING' || item.status === 'ERROR')"
                  class="tw:flex tw:shrink-0 tw:items-center tw:gap-2"
                >
                  <Badge v-if="item.ignored" variant="neutral">Ignored</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    :disabled="filterBusy[itemKey(report.id, item)]"
                    @click="toggleIgnore(report.id, item)"
                    >{{
                      filterBusy[itemKey(report.id, item)]
                        ? 'Working…'
                        : item.ignored
                          ? 'Un-ignore'
                          : 'Ignore'
                    }}</Button
                  >
                </div>
              </div>
              <ul
                v-if="item.details?.length"
                class="tw:ml-1 tw:grid tw:gap-1 tw:border-l tw:border-border-subtle tw:pl-3 tw:text-xs tw:text-muted-foreground"
              >
                <li v-for="(detail, index) in item.details" :key="index">{{ detail }}</li>
              </ul>
              <Alert
                v-if="filterError[itemKey(report.id, item)]"
                variant="danger"
                role="alert"
                >{{ filterError[itemKey(report.id, item)] }}</Alert
              >
            </li>
          </ul>
          <p v-else class="tw:text-sm tw:text-muted-foreground">No issues reported.</p>
        </CardContent>
      </Card>

      <p v-if="!reports" class="tw:text-sm tw:text-muted-foreground">
        {{ loading ? 'Loading…' : 'No diagnosis data yet.' }}
      </p>
    </template>
  </PageLayout>
</template>
