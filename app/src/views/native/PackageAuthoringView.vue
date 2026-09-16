<script setup lang="ts">
import { computed, ref } from 'vue'

import { declareCatalogueEntry } from '@/api/nativeCatalog'
import {
  fetchManifestFromRepository,
  planPackageManifest,
  type ManifestDiagnostic,
  type PackagePlan,
} from '@/api/nativePackages'
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

// -- fetch from repository ---------------------------------------------------
// The primary path: point at the repository the package.toml already lives
// in and let the server clone and read it, instead of hand-pasting the
// manifest as JSON.

const repository = ref('')
const revision = ref('')
const packagePath = ref('')
const packageData = ref<Record<string, unknown> | null>(null)
const commit = ref('')
const diagnostics = ref<ManifestDiagnostic[]>([])
const fetching = ref(false)
const { run: runFetch } = useActionRunner(fetching, false)

const plan = ref<PackagePlan | null>(null)
const planning = ref(false)
const { run: runPlan } = useActionRunner(planning, false)

async function fetchAndPlan() {
  await runFetch(
    true,
    async () => {
      plan.value = null
      packageData.value = null
      diagnostics.value = []
      commit.value = ''
      await sync()
      const result = await fetchManifestFromRepository(
        repository.value.trim(),
        {
          revision: revision.value.trim(),
          packagePath: packagePath.value.trim(),
        },
      )
      packageData.value = result.package
      commit.value = result.commit
      diagnostics.value = result.diagnostics
      if (!result.valid) return
      plan.value = await planPackageManifest(result.package)
      if (!declareRepository.value)
        declareRepository.value = repository.value.trim()
    },
    'Could not fetch the manifest from that repository.',
  )
}

// -- advanced: paste a manifest directly --------------------------------
// Kept for a package that has no repository yet (still being drafted
// locally) - the fetch-from-repository flow above is the default path.

const showAdvanced = ref(false)
const manifestText = ref(
  JSON.stringify({ app: { id: 'example-app', version: '0.1.0' } }, null, 2),
)

async function reviewPastedManifest() {
  await runPlan(
    true,
    async () => {
      plan.value = null
      diagnostics.value = []
      await sync()
      const parsed: unknown = JSON.parse(manifestText.value)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('The package manifest must be a JSON object.')
      packageData.value = parsed as Record<string, unknown>
      commit.value = ''
      plan.value = await planPackageManifest(packageData.value)
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
  if (!packageData.value) return
  await runDeclare(
    true,
    async () => {
      const result = await declareCatalogueEntry(
        packageData.value as Record<string, unknown>,
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

const diagnosticLocation = (diagnostic: ManifestDiagnostic) =>
  diagnostic.path.length ? diagnostic.path.join('.') : 'package'

const busy = computed(() => fetching.value || planning.value)
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="NostrHost native package planner"
      title="Package authoring"
      description="Point at the repository a package already lives in, inspect its resource plan, and declare it in the trusted catalogue. Planning is read-only and this screen cannot install packages; declaring publishes a signed catalogue entry."
    />

    <Alert v-if="publicKey" variant="success">
      Signer connected ·
      <code class="tw:font-mono"
        >{{ publicKey.slice(0, 12) }}…{{ publicKey.slice(-8) }}</code
      >
    </Alert>
    <Alert v-else variant="warning">
      No signer connected. Sign in to fetch, plan, or declare a package.
    </Alert>

    <Card>
      <CardHeader>
        <CardTitle>Package repository</CardTitle>
      </CardHeader>
      <CardContent class="tw:grid tw:gap-3">
        <div class="tw:grid tw:gap-4 tw:sm:grid-cols-[2fr_1fr_1fr]">
          <div class="tw:grid tw:gap-1.5">
            <Label for="repo-url">Repository URL</Label>
            <Input
              id="repo-url"
              v-model="repository"
              placeholder="https://git.example.com/my-app.git"
              spellcheck="false"
              autocomplete="off"
            />
          </div>
          <div class="tw:grid tw:gap-1.5">
            <Label for="repo-revision">Branch or tag (optional)</Label>
            <Input
              id="repo-revision"
              v-model="revision"
              placeholder="default branch"
              spellcheck="false"
              autocomplete="off"
            />
          </div>
          <div class="tw:grid tw:gap-1.5">
            <Label for="repo-path">Package path (optional)</Label>
            <Input
              id="repo-path"
              v-model="packagePath"
              placeholder="repo root"
              spellcheck="false"
              autocomplete="off"
            />
          </div>
        </div>
        <p class="tw:text-sm tw:text-muted-foreground">
          Reads <code class="tw:font-mono">package.toml</code> straight from the
          repository (a shallow clone, https:// only) and validates it the same
          way the authoring CLI does.
        </p>
        <div>
          <Button
            :disabled="!publicKey || busy || !repository.trim()"
            variant="primary"
            @click="fetchAndPlan"
            >{{ fetching ? 'Fetching…' : 'Fetch & review plan' }}</Button
          >
        </div>
      </CardContent>
    </Card>

    <Card v-if="diagnostics.length">
      <CardHeader>
        <CardTitle>Manifest problems</CardTitle>
      </CardHeader>
      <CardContent>
        <ul class="tw:m-0 tw:grid tw:gap-2 tw:p-0 tw:list-none">
          <li
            v-for="(diagnostic, index) in diagnostics"
            :key="index"
            class="tw:rounded-lg tw:border tw:border-border-subtle tw:p-3 tw:text-sm"
          >
            <code class="tw:font-mono tw:text-xs tw:text-muted-foreground">{{
              diagnosticLocation(diagnostic)
            }}</code>
            <p class="tw:m-0">{{ diagnostic.message }}</p>
            <p
              v-if="diagnostic.hint"
              class="tw:m-0 tw:text-xs tw:text-muted-foreground"
            >
              {{ diagnostic.hint }}
            </p>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
          <span>Advanced: paste a manifest</span>
          <Button
            variant="outline"
            size="sm"
            @click="showAdvanced = !showAdvanced"
          >
            {{ showAdvanced ? 'Hide' : 'Show' }}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent v-if="showAdvanced">
        <p class="tw:text-sm tw:text-muted-foreground">
          For a package that has no repository yet. Enter a JSON package object;
          the server validates it and returns a read-only resource plan.
        </p>
        <Label for="package-manifest">Package manifest (JSON)</Label>
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
            variant="outline"
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
          <template v-if="commit"
            >Read at commit
            <code class="tw:font-mono">{{ commit.slice(0, 12) }}</code
            >.</template
          >
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
