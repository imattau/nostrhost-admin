<script setup lang="ts">
import { ref } from 'vue'

import { planPackageManifest, type PackagePlan } from '@/api/nativePackages'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useSigner } from '@/composables/useSigner'

const { publicKey, signerAvailable, sync } = useSigner()

const manifest = ref(
  JSON.stringify({ app: { id: 'example-app', version: '0.1.0' } }, null, 2),
)
const plan = ref<PackagePlan | null>(null)
const error = ref('')
const planning = ref(false)

async function reviewPlan() {
  planning.value = true
  error.value = ''
  plan.value = null
  try {
    await sync()
    const packageData: unknown = JSON.parse(manifest.value)
    if (
      !packageData ||
      typeof packageData !== 'object' ||
      Array.isArray(packageData)
    )
      throw new Error('The package manifest must be a JSON object.')
    plan.value = await planPackageManifest(
      packageData as Record<string, unknown>,
    )
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Plan request failed.'
  } finally {
    planning.value = false
  }
}

function riskLabel(operation: NonNullable<PackagePlan['operations']>[number]) {
  const risk = operation.risk || 'low'
  const reverse =
    operation.reverse || (operation.reversible ? 'available' : null)
  return `${risk} risk · ${reverse ? `reversible (${reverse})` : 'no automatic reverse'}`
}

function riskVariant(risk: string | undefined) {
  if (risk === 'high') return 'danger'
  if (risk === 'medium') return 'warning'
  return 'success'
}
</script>

<template>
  <section class="tw:mx-auto tw:grid tw:max-w-4xl tw:gap-6">
    <header class="tw:border-b tw:border-border-subtle tw:pb-4">
      <p
        class="tw:font-mono tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-brand-500"
      >
        NostrHost native package planner
      </p>
      <h1 class="tw:mt-1 tw:text-2xl tw:font-bold tw:text-foreground">
        Package authoring
      </h1>
      <p class="tw:mt-2 tw:max-w-2xl tw:text-sm tw:text-muted-foreground">
        Draft a declarative package and inspect its resource plan. Planning is
        read-only; this screen cannot install packages.
      </p>
    </header>

    <Alert v-if="!signerAvailable" variant="danger">
      You are not signed in. Sign in at the portal to continue.
    </Alert>
    <Alert v-else-if="!publicKey" variant="info">
      Sign in at the portal to continue.
    </Alert>
    <Alert v-else variant="success">
      Signer connected ·
      <code class="tw:font-mono"
        >{{ publicKey.slice(0, 12) }}…{{ publicKey.slice(-8) }}</code
      >
    </Alert>
    <Alert v-if="error" variant="danger" role="alert">{{ error }}</Alert>

    <Card>
      <CardHeader>
        <CardTitle>package.json</CardTitle>
      </CardHeader>
      <CardContent>
        <Label for="package-manifest">Package manifest</Label>
        <Textarea
          id="package-manifest"
          v-model="manifest"
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          aria-describedby="manifest-help"
        />
        <p id="manifest-help" class="tw:text-sm tw:text-muted-foreground">
          Enter a JSON package object. The server validates it and returns a
          read-only resource plan; it does not install packages.
        </p>
        <div>
          <Button
            :disabled="!publicKey || planning"
            variant="primary"
            @click="reviewPlan"
            >{{ planning ? 'Building plan…' : 'Review plan' }}</Button
          >
        </div>
      </CardContent>
    </Card>

    <Card v-if="plan?.operations">
      <CardHeader>
        <CardTitle
          >Plan for {{ plan.package.id }} {{ plan.package.version }}</CardTitle
        >
      </CardHeader>
      <CardContent>
        <p class="tw:text-sm tw:text-muted-foreground">
          {{ plan.operations.length }} resource operations. No host changes have
          been made.
        </p>
        <ol class="tw:grid tw:gap-3">
          <li
            v-for="(operation, index) in plan.operations"
            :key="`${operation.resource}-${index}`"
            class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
          >
            <div class="tw:grid tw:gap-1">
              <strong class="tw:text-sm tw:text-foreground">{{
                operation.summary
              }}</strong>
              <code class="tw:font-mono tw:text-xs tw:text-muted-foreground"
                >{{ operation.name }} · {{ operation.resource }}</code
              >
            </div>
            <Badge :variant="riskVariant(operation.risk)" class="tw:w-fit">
              {{ riskLabel(operation) }}
            </Badge>
          </li>
        </ol>
      </CardContent>
    </Card>
  </section>
</template>
