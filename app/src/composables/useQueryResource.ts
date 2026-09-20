import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { toErrorMessage } from '@/utils/errors'

// A2 server-state: a screen-load read backed by Vue Query. Views pass a query
// key (see api/queryKeys) and a fetcher; loading/error/caching/cancellation
// and invalidation-on-key-change are handled by the query client. Mutations in
// the same domain call queryClient.invalidateQueries(key) to refresh.
export function useQueryResource<T>(
  queryKey: () => readonly unknown[],
  fetcher: () => Promise<T>,
  options?: {
    enabled?: boolean
    staleTime?: number
    refetchInterval?: number | false
  },
) {
  const { publicKey, sync } = useSigner()
  const { danger } = useNotifications()
  const queryClient = useQueryClient()

  // A thin, deliberate adapter: the admin app already has a working session
  // probe + auth path in useSigner. For query reads we still gate on the
  // session key becoming available, then run the fetcher through the same
  // authenticated request() wrapper the rest of the app uses.
  const load = async (): Promise<T> => {
    await sync()
    return fetcher()
  }

  const { data, isLoading, isError, error, refetch, isRefetching } =
    useQuery({
      queryKey: queryKey(),
      queryFn: load,
      enabled: options?.enabled ?? true,
      staleTime: options?.staleTime ?? 5_000,
      refetchInterval: options?.refetchInterval ?? false,
      retry: 1,
    })

  // Surface transient errors consistently with the rest of the app.
  if (isError && error) {
    danger(toErrorMessage(error.value, 'Failed to load.'))
  }

  return {
    data,
    loading: isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    publicKey,
    queryClient,
  }
}