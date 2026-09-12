<script setup lang="ts">
import { computed, ref } from 'vue'
import { planPackageManifest, type PackagePlan } from '@/api/nativePackages'
import { Button } from '@/components/ui/button'

const manifest = ref(
  JSON.stringify({ app: { id: 'example-app', version: '0.1.0' } }, null, 2),
)
const publicKey = ref<string | null>(null)
const plan = ref<PackagePlan | null>(null)
const error = ref('')
const busy = ref<'connect' | 'plan' | null>(null)
const signerAvailable = computed(() => Boolean(window.nostr))

async function connectSigner() {
  busy.value = 'connect'
  error.value = ''
  try {
    const connectedKey = (await window.nostr?.getPublicKey()) ?? null
    if (!connectedKey)
      throw new Error('The signer did not return a public key.')
    publicKey.value = connectedKey
  } catch (cause) {
    publicKey.value = null
    error.value =
      cause instanceof Error ? cause.message : 'Could not connect the signer.'
  } finally {
    busy.value = null
  }
}

async function syncSignerIdentity() {
  const current = await window.nostr?.getPublicKey()
  if (!current) {
    publicKey.value = null
    throw new Error('The Nostr signer is no longer available.')
  }
  if (publicKey.value && current !== publicKey.value) {
    publicKey.value = current
    throw new Error(
      'The signer account changed. Review the account before continuing.',
    )
  }
  publicKey.value = current
}

async function reviewPlan() {
  busy.value = 'plan'
  error.value = ''
  plan.value = null
  try {
    await syncSignerIdentity()
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
    busy.value = null
  }
}

function riskLabel(operation: NonNullable<PackagePlan['operations']>[number]) {
  const risk = operation.risk || 'low'
  const reverse =
    operation.reverse || (operation.reversible ? 'available' : null)
  return `${risk} risk · ${reverse ? `reversible (${reverse})` : 'no automatic reverse'}`
}
</script>

<template>
  <section class="native-authoring" aria-labelledby="page-title">
    <header class="page-heading">
      <div>
        <p class="eyebrow">NostrHost native package planner</p>
        <h1 id="page-title">Package authoring</h1>
        <p class="lede">
          Draft a declarative package and inspect its resource plan. Planning is
          read-only; this screen cannot install packages.
        </p>
      </div>
      <Button
        :disabled="busy !== null || !signerAvailable"
        variant="outline"
        @click="connectSigner"
      >
        {{
          busy === 'connect'
            ? 'Connecting…'
            : publicKey
              ? 'Reconnect signer'
              : 'Connect Nostr signer'
        }}
      </Button>
    </header>

    <p v-if="!signerAvailable" class="notice" role="status">
      A NIP-07 browser signer is required. Enable a signer extension, then
      reload this page.
    </p>
    <p v-else-if="publicKey" class="notice" role="status">
      Signer connected ·
      <code>{{ publicKey.slice(0, 12) }}…{{ publicKey.slice(-8) }}</code>
    </p>
    <p v-else class="notice" role="status">
      Connect your signer to authorize package planning.
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <div class="editor-grid">
      <label class="editor-label" for="package-manifest">package.json</label>
      <textarea
        id="package-manifest"
        v-model="manifest"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        aria-describedby="manifest-help"
      />
      <p id="manifest-help" class="help">
        Enter a JSON package object. The server validates it and returns a
        read-only resource plan; it does not install packages.
      </p>
      <div class="actions">
        <Button
          :disabled="!publicKey || busy !== null"
          variant="outline"
          @click="reviewPlan"
          >{{ busy === 'plan' ? 'Building plan…' : 'Review plan' }}</Button
        >
      </div>
    </div>

    <section
      v-if="plan?.operations"
      class="result"
      aria-labelledby="plan-title"
    >
      <h2 id="plan-title">
        Plan for {{ plan.package.id }} {{ plan.package.version }}
      </h2>
      <p>
        {{ plan.operations.length }} resource operations. No host changes have
        been made.
      </p>
      <ol class="operations">
        <li
          v-for="(operation, index) in plan.operations"
          :key="`${operation.resource}-${index}`"
        >
          <div>
            <strong>{{ operation.summary }}</strong
            ><code>{{ operation.name }} · {{ operation.resource }}</code>
          </div>
          <span>{{ riskLabel(operation) }}</span>
        </li>
      </ol>
    </section>
  </section>
</template>

<style scoped>
.native-authoring {
  display: grid;
  gap: 1rem;
  max-width: 58rem;
  margin: 0 auto;
}
.page-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.page-heading h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 650;
}
.eyebrow {
  margin: 0 0 0.35rem;
  color: #6d5bce;
  font:
    600 0.72rem/1.2 ui-monospace,
    monospace;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.lede {
  max-width: 42rem;
  margin: 0.5rem 0 0;
  color: #626574;
}
.notice,
.error,
.success {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background: #f1efff;
}
.error {
  color: #9b1c1c;
  background: #fff1f0;
}
.success {
  color: #17663a;
  background: #edf9f0;
}
.editor-grid {
  display: grid;
  gap: 0.65rem;
}
.editor-label {
  font-weight: 600;
}
textarea {
  min-height: 17rem;
  width: 100%;
  resize: vertical;
  border: 1px solid #c9cad3;
  border-radius: 0.5rem;
  padding: 0.85rem;
  background: #171923;
  color: #f6f6fa;
  font:
    0.9rem/1.55 ui-monospace,
    SFMono-Regular,
    monospace;
}
textarea:focus-visible,
summary:focus-visible {
  outline: 3px solid #8b5cf6;
  outline-offset: 2px;
}
.help,
.result > p {
  margin: 0;
  color: #626574;
  font-size: 0.9rem;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}
.result {
  display: grid;
  gap: 0.75rem;
  border: 1px solid #dedee5;
  border-radius: 0.65rem;
  padding: 1rem;
}
.result h2 {
  margin: 0;
  font-size: 1.1rem;
}
.operations {
  display: grid;
  gap: 0.55rem;
  margin: 0;
  padding-left: 1.3rem;
}
.operations {
  padding-left: 1.7rem;
}
.operations li {
  padding-left: 0.2rem;
}
.operations li > div {
  display: grid;
  gap: 0.2rem;
}
.operations code,
.operations span {
  display: inline-block;
  margin-top: 0.3rem;
  color: #626574;
  font-size: 0.8rem;
}
@media (max-width: 42rem) {
  .page-heading {
    flex-direction: column;
  }
  .page-heading > :last-child {
    width: 100%;
  }
}
</style>
