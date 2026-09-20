import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { toErrorMessage } from '@/utils/errors'
import { listOperations } from '@/api/nativeOperations'
import { queryKeys } from '@/api/queryKeys'

// A2: the operations list is polled server-state. Vue Query drives the
// interval (respecting document visibility) and caches the list so an
// approve/reject mutation only needs to invalidate/refetch, instead of the
// hand-rolled setInterval + visibilitychange plumbing the view used to carry.
export function useOperationsList(options?: { refetchInterval?: number | false }) {
  const { publicKey, sync } = useSigner()
  const { danger } = useNotifications()
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.operations(),
    queryFn: async () => {
      await sync()
      return listOperations(200)
    },
    enabled: true,
    staleTime: 5_000,
    refetchInterval: options?.refetchInterval ?? 15_000,
    refetchIntervalInBackground: false,
    retry: 1,
  })

  if (isError && error) {
    danger(toErrorMessage(error.value, 'Failed to load operations.'))
  }

  return {
    operations: data,
    loading: isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    publicKey,
    queryClient,
  }
}