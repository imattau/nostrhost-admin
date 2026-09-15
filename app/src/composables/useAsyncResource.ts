import { onMounted, ref, watch } from 'vue'

import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { toErrorMessage } from '@/utils/errors'

// Nearly every native view repeats the same "load this screen's data"
// boilerplate: a `loading` flag, a sync() + fetch body wrapped in
// try/catch/finally that toasts on failure, and the onMounted/watch(publicKey)
// pair that (re)loads once a session's public key becomes available (or
// changes, e.g. sign-in/out). This centralizes that pattern so a view keeps
// only its own fetch body and error message.
export function useAsyncResource(
  run: () => Promise<void>,
  errorMessage: string,
) {
  const { publicKey, sync } = useSigner()
  const { danger } = useNotifications()
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

  return { publicKey, sync, loading, load }
}
