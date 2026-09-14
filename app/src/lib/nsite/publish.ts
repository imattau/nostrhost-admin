// Phase 3a publish orchestration (implementation plan §6 steps 5–7).
//
// Ties the plan → sign → submit flow together: the wizard builds the unsigned
// manifest + plan digest, uploads blobs, reviews, then signs the event with
// the NIP-07 extension (D7: the server never sees a key) and submits it to
// `nsite.publish`. Editing anything after step 5 discards the plan digest.

import {
  buildUnsignedManifest,
  planDigest,
  type ManifestItem,
} from './manifest'
import type { LifecycleOperation } from '@/api/nativeNsites'

export type SignRequest = {
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
}

export type SignedEvent = SignRequest & { id: string; sig: string }

export type PublishParams = {
  pubkey: string
  kind: number
  d: string
  items: ManifestItem[]
  servers: string[]
  relays: string[]
  signEvent: (event: SignRequest) => Promise<SignedEvent>
  submit: (args: {
    event: SignedEvent
    plan_sha256: string
    relays: string[]
  }) => Promise<LifecycleOperation>
}

export async function signAndSubmit(
  params: PublishParams,
): Promise<LifecycleOperation> {
  const { event } = await buildUnsignedManifest({
    pubkey: params.pubkey,
    kind: params.kind,
    d: params.d,
    items: params.items,
    servers: params.servers,
  })
  const digest = await planDigest({
    kind: params.kind,
    d: params.d,
    paths: params.items,
    servers: params.servers,
  })
  const signed = await params.signEvent({
    ...event,
    created_at: Math.floor(Date.now() / 1000),
  })
  return params.submit({
    event: signed,
    plan_sha256: digest,
    relays: params.relays,
  })
}

// The plan digest for a given inventory/servers, exposed for the review step
// so the wizard can show the exact digest the signer commits to.
export async function reviewDigest(params: {
  kind: number
  d: string
  items: ManifestItem[]
  servers: string[]
}): Promise<string> {
  return planDigest({ ...params, paths: params.items })
}
