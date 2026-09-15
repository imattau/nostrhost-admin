import { ref, type Ref } from 'vue'

// Every "ask before doing this" flow in the native views hand-rolls the same
// triple: a `confirmingX` ref that sits at an idle value (`false` for a
// payload-less flag, `null` for one that needs to remember which row/target
// is pending) and flips to `true` or the pending payload while a
// confirmation is showing, a `requestX()` that sets it, and a `cancelX()`
// that clears it back to idle. This centralizes the ref + cancel half of
// that shape. `request(value)` opens the confirmation with that payload (or
// `true` for a flag), and `cancel()` resets `pending` back to `idle`. Call
// sites keep their own `confirmX()` handler -- it reads the captured
// payload, calls `cancel()`, then runs the mutating action -- since that
// varies per site, and keep whatever idle value (`false` or `null`) they
// already declared by passing it back in here.
export function useConfirm<T>(idle: T) {
  const pending = ref(idle) as Ref<T>

  function request(value: T): void {
    pending.value = value
  }

  function cancel(): void {
    pending.value = idle
  }

  return { pending, request, cancel }
}
