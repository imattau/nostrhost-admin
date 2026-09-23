<script setup lang="ts">
import { computed, ref } from 'vue'

import { planPackageManifest, type PackagePlan } from '@/api/nativePackages'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useActionRunner } from '@/composables/useActionRunner'
import { useSigner } from '@/composables/useSigner'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { publicKey, sync } = useSigner()

// Publishing and declaring a package in the trusted catalogue now happens
// entirely through the npack CLI (`npack build` / `npack sign-release`),
// which signs the repo/commit into the release so it can be attested - the
// git-repository authoring path this screen used to drive (fetch a
// manifest from a repository, then declare it) was retired along with the
// rest of the git-based catalogue distribution. This screen is left as a
// read-only resource-plan previewer for a manifest you already have.

const manifestText = ref(
  JSON.stringify({ app: { id: 'example-app', version: '0.1.0' } }, null, 2),
)

const plan = ref<PackagePlan | null>(null)
const planning = ref(false)
const { run: runPlan } = useActionRunner(planning, false)

async function reviewPastedManifest() {
  await runPlan(
    true,
    async () => {
      plan.value = null
      await sync()
      const parsed: unknown = JSON.parse(manifestText.value)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('The package manifest must be a JSON object.')
      plan.value = await planPackageManifest(parsed as Record<string, unknown>)
    },
    'Plan request failed.',
  )
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

const busy = computed(() => planning.value)
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="NostrHost native package planner"
      title="Package authoring"
      description="Paste a native package manifest to inspect its resource plan. Planning is read-only and this screen cannot install or publish packages."
    />

    <Alert v-if="publicKey" variant="success">
      Signer connected ·
      <code class="tw:font-mono"
        >{{ publicKey.slice(0, 12) }}…{{ publicKey.slice(-8) }}</code
      >
    </Alert>
    <Alert v-else variant="warning">
      No signer connected. Sign in to review a plan.
    </Alert>

    <Alert variant="info">
      Publishing a package to the trusted catalogue is done with the
      <code class="tw:font-mono">npack</code> CLI (build and sign a release,
      which signs the repo/commit into it so it can be attested), not from this
      console. This screen only previews the resource plan for a manifest you
      already have.
    </Alert>

    <Card>
      <CardHeader>
        <CardTitle>Package manifest</CardTitle>
      </CardHeader>
      <CardContent>
        <p class="tw:text-sm tw:text-muted-foreground">
          Enter a JSON package object; the server validates it and returns a
          read-only resource plan.
        </p>
        <Textarea
          id="package-manifest"
          v-model="manifestText"
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
        />
        <div class="tw:mt-2">
          <Button
            :disabled="!publicKey || busy"
            variant="primary"
            @click="reviewPastedManifest"
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
  </PageLayout>
</template>
