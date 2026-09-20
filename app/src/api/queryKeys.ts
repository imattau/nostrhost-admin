// Central query-key factory for the admin app (A2). Keys are scoped per
// domain so any view can invalidate a domain after a mutation without knowing
// the exact key shape the reader used.
export const queryKeys = {
  all: ['nostrhost'] as const,
  // session probe (mirrors useSigner's cache — kept separate so a stale
  // sign-in state is never served to a fresh tab)
  session: () => [...queryKeys.all, 'session'] as const,
  operations: () => [...queryKeys.all, 'operations'] as const,
  operationsDetail: (requestId: string) => [...queryKeys.operations(), requestId] as const,
  nsite: () => [...queryKeys.all, 'nsite'] as const,
  nsiteCollection: () => [...queryKeys.nsite(), 'collection'] as const,
  catalog: () => [...queryKeys.all, 'catalog'] as const,
  users: () => [...queryKeys.all, 'users'] as const,
  groups: () => [...queryKeys.all, 'groups'] as const,
  permissions: () => [...queryKeys.all, 'permissions'] as const,
  backups: () => [...queryKeys.all, 'backups'] as const,
  domains: () => [...queryKeys.all, 'domains'] as const,
  firewall: () => [...queryKeys.all, 'firewall'] as const,
  settings: () => [...queryKeys.all, 'settings'] as const,
  agent: () => [...queryKeys.all, 'agent'] as const,
  system: () => [...queryKeys.all, 'system'] as const,
  services: () => [...queryKeys.all, 'services'] as const,
  state: () => [...queryKeys.all, 'state'] as const,
  diagnosis: () => [...queryKeys.all, 'diagnosis'] as const,
  identity: () => [...queryKeys.all, 'identity'] as const,
  mcp: () => [...queryKeys.all, 'mcp'] as const,
  connectivity: () => [...queryKeys.all, 'connectivity'] as const,
  packages: () => [...queryKeys.all, 'packages'] as const,
} as const