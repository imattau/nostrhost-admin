// Curated collection publish orchestration (NSITES-CURATED-LISTS.md).
//
// Ties the plan → sign → submit flow together for kind-30004 collections: the
// wizard builds the unsigned event + plan digest, reviews, signs with the
// NIP-07 extension (D7: the server never sees a key) and submits to
// `nsite.collection.publish`. Editing anything after review discards the plan
// digest.

import { buildUnsignedCollection, collectionPlanDigest } from './collection'
import type { CollectionEntry } from '@/api/nativeNsites'
import type { LifecycleOperation } from '@/api/nativeNsites'

export type SignRequest = {
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
}

export type SignedEvent = SignRequest & { id: string; sig: string }

export type CollectionPublishParams = {
  pubkey: string
  d: string
  title: string
  description: string
  image: string
  entries: CollectionEntry[]
  relays: string[]
  signEvent: (event: SignRequest) => Promise<SignedEvent>
  submit: (args: {
    event: SignedEvent
    plan_sha256: string
    relays: string[]
  }) => Promise<LifecycleOperation>
}

export async function signAndSubmitCollection(
  params: CollectionPublishParams,
): Promise<LifecycleOperation> {
  const { event } = await buildUnsignedCollection({
    pubkey: params.pubkey,
    d: params.d,
    title: params.title,
    description: params.description,
    image: params.image,
    entries: params.entries,
  })
  const digest = await collectionPlanDigest({
    pubkey: params.pubkey,
    d: params.d,
    title: params.title,
    description: params.description,
    image: params.image,
    entries: params.entries,
    relays: params.relays,
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
