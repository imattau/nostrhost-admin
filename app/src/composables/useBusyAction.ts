import { computed, ref } from 'vue'

// Centralizes the "one action in flight at a time" pattern nearly every
// native view hand-rolls as `const busy = ref('')` plus a manual
// try/finally — this is that pattern, unified, still keyed by the same
// string-tag convention views already use (e.g. 'reboot',
// `permission-remove-${key}`) so call sites read the same as before.
//
// Unlike useSigner/useNotifications this is NOT a module-level singleton:
// busy state is scoped to whichever view/section owns it, so each call to
// useBusyAction() gets its own independent state.
export function useBusyAction() {
  const busyKey = ref<string | null>(null)

  function isBusy(key?: string): boolean {
    return key === undefined ? busyKey.value !== null : busyKey.value === key
  }

  async function run<T>(key: string, action: () => Promise<T>): Promise<T | undefined> {
    if (busyKey.value !== null) return undefined
    busyKey.value = key
    try {
      return await action()
    } finally {
      busyKey.value = null
    }
  }

  return { busyKey: computed(() => busyKey.value), isBusy, run }
}
