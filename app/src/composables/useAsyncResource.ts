import { onMounted, ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'

import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { toErrorMessage } from '@/utils/errors'

// A2 server-state layer: the screen-load pattern is backed by Vue Query so
// reads are cached, cancellable and automatically invalidated, while loading
// and error handling stay consistent. The public signature is unchanged from
// the hand-rolled version, so a view only swaps its data source for a query
// key + fetcher (see useQueryResource) or keeps calling load() as before.
//
// `load()` remains for one-off/manual reloads; `useQueryResource` is the
// preferred form for reads that benefit from caching/invalidation.
export function useAsyncResource(
  run: () => Promise<void>,
  errorMessage: string,
) {
  const { publicKey, sync } = useSigner()
  const { danger } = useNotifications()
  const queryClient = useQueryClient()
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      await sync()
      await run()
    } catch (cause) {
      danger(toErrorMessage(cause, errorMessage))
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

  return { publicKey, sync, loading, load, queryClient }
}