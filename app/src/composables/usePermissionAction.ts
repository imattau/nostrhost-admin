import { useNotifications } from '@/composables/useNotifications'
import { useBusyAction } from '@/composables/useBusyAction'
import type { LifecycleOperation } from '@/api/nativeGroupsPermissions'

// Grant/revoke actions across AppManagementView, GroupsView, and
// AiManagementView all follow the same shape: reset messaging, mark one key
// busy, call an async action, notify success or failure, refetch, clear
// busy. This is that shape, extracted. It's generic over the action itself
// (not hardcoded to addPermission/removePermission) so it also covers
// AiManagementView's revokeCapability, which returns the same
// LifecycleOperation envelope but hits a different endpoint.
export function usePermissionAction() {
  const { success, fromOperationError } = useNotifications()
  const { isBusy, run } = useBusyAction()

  async function perform(
    key: string,
    action: () => Promise<LifecycleOperation>,
    messages: {
      successMessage: (result: LifecycleOperation) => string
      failureFallback: string
    },
    onSettled?: () => Promise<void> | void,
  ): Promise<LifecycleOperation | undefined> {
    return run(key, async () => {
      try {
        const result = await action()
        success(messages.successMessage(result))
        return result
      } catch (cause) {
        fromOperationError(cause, messages.failureFallback)
        return undefined
      } finally {
        await onSettled?.()
      }
    })
  }

  return { perform, isBusy }
}
