import { defineConfig } from 'orval'

// A1 typed API contracts: the admin client + Vue Query hooks are generated
// from the backend's exported OpenAPI schema (openapi/nostrhost-api.json,
// produced by forks/yunohost/scripts/export-openapi.py during packaging).
// Every request funnels through src/api/orvalRequest.ts -> the authenticated
// request() wrapper, so session/CSRF/NIP-98/idempotency handling is preserved
// and the generated client cannot drift from the wire contract.
export default defineConfig({
  nostrhost: {
    input: { target: './openapi/nostrhost-api.json' },
    output: {
      mode: 'tags-split',
      target: './src/api/generated',
      schemas: './src/api/generated/schemas',
      client: 'vue-query',
      baseUrl: '',
      prettier: true,
      override: {
        mutator: {
          path: './src/api/orvalRequest.ts',
          name: 'orvalRequest',
        },
        query: {
          useQuery: true,
          useInfinite: false,
          useMutation: true,
          options: {
            retry: 0, // no automatic mutation retries (A2 requirement)
          },
        },
      },
    },
  },
})