import { useNotifications } from '@/composables/useNotifications'
import { toErrorMessage } from '@/utils/errors'
import type { Ref } from 'vue'

// Nearly every mutating handler across the native views hand-rolls the same
// four lines: mark a busy ref, run the action inside try/catch, toast a
// danger notification with a per-call fallback message on failure, and reset
// the busy ref in `finally`. This centralizes that shape. `busy` stays
// whatever ref the view already declares (a string ref keyed by action name
// like `busy.value = 'save'`, or a boolean ref for a single-purpose flag), so
// call sites keep their existing template bindings (`busy === 'save'`,
// `:disabled="busy"`) unchanged -- only the handler body changes.
export function useActionRunner<B>(busy: Ref<B>, idle: B) {
  const { danger } = useNotifications()

  async function run(
    busyValue: B,
    action: () => Promise<void>,
    // A plain fallback message notifies via `danger(toErrorMessage(...))`,
    // the same as every plain try/catch site. A handful of sites (reboot,
    // shutdown, approve/reject operation) instead route through
    // `notifications.fromOperationError`, which reads a "pending approval"
    // envelope on the error and downgrades those to an info toast -- pass a
    // function to preserve that behavior.
    onError: string | ((cause: unknown) => void),
  ): Promise<void> {
    busy.value = busyValue
    try {
      await action()
    } catch (cause) {
      if (typeof onError === 'function') onError(cause)
      else danger(toErrorMessage(cause, onError))
    } finally {
      busy.value = idle
    }
  }

  return { run }
}
