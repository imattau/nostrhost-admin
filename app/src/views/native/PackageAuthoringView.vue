<script setup lang="ts">
import { ref } from 'vue'

import { declareCatalogueEntry } from '@/api/nativeCatalog'
import { planPackageManifest, type PackagePlan } from '@/api/nativePackages'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useActionRunner } from '@/composables/useActionRunner'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { publicKey, sync } = useSigner()
const { success } = useNotifications()

const manifest = ref(
  JSON.stringify({ app: { id: 'example-app', version: '0.1.0' } }, null, 2),
)
const plan = ref<PackagePlan | null>(null)
const planning = ref(false)
const { run: runPlan } = useActionRunner(planning, false)

async function reviewPlan() {
  await runPlan(
    true,
    async () => {
      plan.value = null
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
    },
    'Plan request failed.',
  )
}

// -- publish to catalogue ---------------------------------------------------
// Reviewing a plan is read-only; declaring the reviewed manifest in the
// catalogue is the separate, signed step that actually makes it installable
// elsewhere. catalog.declare re-validates the manifest server-side and
// derives its own provenance hash, so this repository field is only where
// the exact manifest content can be found — not itself trusted as a hash.

const declareRepository = ref('')
const declaring = ref(false)
const { run: runDeclare } = useActionRunner(declaring, false)

async function declareInCatalogue() {
  await runDeclare(
    true,
    async () => {
      const packageData = JSON.parse(manifest.value) as Record<string, unknown>
      const result = await declareCatalogueEntry(
        packageData,
        declareRepository.value.trim(),
      )
      success(
        `Declared ${result.app_id} in the catalogue (event ${result.event_id.slice(0, 12)}…).`,
      )
    },
    'Publishing to the catalogue failed.',
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
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="NostrHost native package planner"
      title="Package authoring"
      description="Draft a declarative package, inspect its resource plan, and declare it in the trusted catalogue. Planning is read-only and this screen cannot install packages; declaring publishes a signed catalogue entry."
    />

    <Alert v-if="publicKey" variant="success">
      Signer connected ·
      <code class="tw:font-mono"
        >{{ publicKey.slice(0, 12) }}…{{ publicKey.slice(-8) }}</code
      >
    </Alert>
    <Alert v-else variant="warning">
      No signer connected. Sign in to plan or declare a package.
    </Alert>

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

    <Card v-if="plan?.operations">
      <CardHeader>
        <CardTitle>Publish to the catalogue</CardTitle>
      </CardHeader>
      <CardContent class="tw:grid tw:gap-3">
        <p class="tw:text-sm tw:text-muted-foreground">
          Sign and publish a kind-32267 declaration for
          {{ plan.package.id }} v{{ plan.package.version }} under this node's
          catalogue publisher key, so it can be trusted and installed elsewhere.
        </p>
        <div class="tw:grid tw:gap-1.5">
          <Label for="declare-repository">Repository URL</Label>
          <Input
            id="declare-repository"
            v-model="declareRepository"
            placeholder="https://git.example.com/my-app.git"
          />
          <p class="tw:text-sm tw:text-muted-foreground">
            Where this exact manifest content is published — required so others
            can locate and audit it.
          </p>
        </div>
        <div>
          <Button
            :disabled="!publicKey || declaring || !declareRepository.trim()"
            variant="primary"
            @click="declareInCatalogue"
            >{{ declaring ? 'Publishing…' : 'Declare in catalogue' }}</Button
          >
        </div>
      </CardContent>
    </Card>
  </PageLayout>
</template>
