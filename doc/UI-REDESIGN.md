# UI redesign: Tailwind + shadcn-vue

The native admin SPA is Tailwind CSS + shadcn-vue style primitives from a
clean start — there is no Bootstrap Vue Next in the shipped build. (The
legacy YunoHost admin those views came from was Bootstrap-based; it wasn't
migrated in place, it was cut over. See `docs/ADMIN-PORT-PLAN.md` and
`docs/ADMIN-FEATURE-MATRIX.md` in the `nostrhost` umbrella repo for what was
kept, deferred, or dropped.)

## Why this stack

- **Tailwind**: utility classes instead of hand-written SCSS per component —
  fewer files to open to change how something looks, no BEM/naming
  bikeshedding, and dead styles are easy to spot from the markup itself.
- **shadcn-vue style primitives**: components are copied into
  `src/components/ui/` as plain Vue SFCs (not an installed dependency you
  fight the API of), built on `class-variance-authority` for variants and
  plain Tailwind/ARIA for behaviour. You own the code, so there's nothing to
  "eject" from later.

## Conventions

- Tailwind utilities are emitted with a `tw:` prefix (`tw:flex`, `tw:p-4`,
  ...) — see `src/assets/tailwind.css` for why (kept so shared files can't
  collide with any styling reintroduced elsewhere in the umbrella project).
  **Every component must use the `tw:` prefix**, never bare Tailwind class
  names.
- Semantic color tokens (`background`, `surface`, `border-subtle`,
  `muted-foreground`, ...) read CSS variables keyed off `data-bs-theme` on
  `<html>` — one dark-mode attribute, light and dark palettes defined once in
  `src/assets/tailwind.css`.
- Icons: `@lucide/vue` (tree-shakeable, matches the shadcn-vue ecosystem's
  default icon set).

## What exists today

- **App shell** (`src/components/layouts/AppShell.vue`,
  `AppSidebar.vue`): sidebar branding + nav and a header with the shared
  NIP-07 signer connection, matching the Figma admin shell
  (`admin-dashboard` / `sidebar` frames). The sidebar's nav list is derived
  from `router.options.routes` (a route opts in via `meta.nav`), so it can
  never link to a screen that doesn't exist yet. Below the routed items sits
  a plain `Portal` link (`ExternalLink` icon, opens in a new tab) to the
  YunoHost user portal SPA at `/nostrhost/sso/` on the same domain — it isn't
  a route because the portal is a separate app with no native API route of
  its own (see `conf/caddy/caddy_domain.conf` in `nostrhost-yunohost`).
- **Primitives** (`src/components/ui/`): `Button`, `Badge`, `Card` (+
  `CardHeader`/`CardTitle`/`CardDescription`/`CardContent`), `Input`,
  `Textarea`, `Label`, `Select`, `Alert`.
- **Shared signer state** (`src/composables/useSigner.ts`): one connected
  NIP-07 public key shared between the header and any view, instead of each
  view reconnecting independently.
- **Views**: `views/native/SystemOverviewView.vue` (landing screen — API
  health, installed versions, linked identities), `PackageAuthoringView.vue`
  (manifest editing, validation, and read-only resource plan review),
  `CatalogueView.vue` (read-only trusted catalogue with provenance — no
  install/publish action), `IdentitiesView.vue` (link a signer pubkey to a
  YunoHost account, or revoke one — the only screen so far that performs a
  write; revoke asks for inline confirmation before publishing),
  `ServiceControlView.vue` (start/stop/restart managed system services;
  stop and restart ask for inline confirmation first since they can
  interrupt the service in use, start does not), `AiManagementView.vue`
  (see below).
- **API clients** (`src/api/`): `client.ts` holds the shared NIP-98 request
  signer; `nativePackages.ts`, `nativeSystem.ts`, `nativeCatalog.ts`,
  `nativeIdentity.ts`, `nativeService.ts`, `nativeAgent.ts`,
  `nativeCapability.ts` are thin typed wrappers per resource area, one file
  per route group in `nostrhost-yunohost`'s `src/nostrhost/api.py`.
- **AI management** (`views/native/AiManagementView.vue`, route `/ai`):
  three cards, of unequal realness.
  - *Admin agent*: a real control surface for the optional
    `nostrhost-agent` (a resident, read-only "observe" agent — see
    `nostrhost-agent`'s own docs). `nativeAgent.ts` wraps the new
    `/agent/status`, `/agent/init`, `/agent/enable`, `/agent/disable`
    routes in `nostrhost-yunohost`'s `api.py`, which are thin HTTP wrappers
    over the existing `_agent_init`/`_agent_status`/`_agent_service`
    functions the `nostrhost agent` CLI already called — this UI is the
    first way to drive that lifecycle without SSH access.
  - *MCP agent access*: also real. Granting an MCP-connected agent access
    to this node's tools is the existing `/capability/grant` endpoint
    (kind-31100 capability events) via `nativeCapability.ts`, with a
    curated, read-heavy subset of the ~30 scopes in `nostrhost-yunohost`'s
    `nostr_operations.py` so the form doesn't default to granting write or
    delete access. Kind-31100 grants are parameterized-replaceable, keyed
    by the subject pubkey, so "revoke" is just granting an empty scope
    list — there's no separate delete endpoint and no read-back listing of
    past grants.
  - *Local models & data sharing*: **UI-only placeholders.** NostrHost has
    no local model runtime and no Hugging Face integration today; these
    rows are visibly disabled (dimmed, "Coming soon" badge, disabled
    buttons) so the page is honest about what does nothing yet.
- **Signer gate** (`src/views/native/ConnectGateView.vue`,
  `src/router/index.ts`): every route except `/connect` requires a
  connected signer. `router.beforeEach` redirects unauthenticated
  navigation to `native-connect` (carrying the original path in a
  `redirect` query param) and redirects away from it once
  `useSigner().publicKey` is set. The gate route has no `meta.nav`, so it
  never appears in the sidebar, and it carries `meta.layout: 'bare'` so
  `App.vue` renders it without `AppShell` — a centred card instead of the
  console chrome. The card intentionally does not mirror Figma's
  `admin-login` frame, which mocks a username/password form: this project
  has no password auth and no stored session, only a per-page-load NIP-07
  connection, so the gate explains that instead of pretending otherwise.
  Server-side authorization was already enforced independently of this
  guard (every native API route but `/healthz` requires a valid NIP-98
  signature — see `_AuthErrorsPlugin` in `nostrhost-yunohost`'s
  `src/nostrhost/api.py`); the guard closes the UX gap of unauthenticated
  visitors seeing screens whose data/actions would fail anyway.

`src/views/LoginView.vue` and `src/views/service/ServiceInfo.vue` are
carried over from the legacy Bootstrap admin and are not part of the build
(excluded from `tsconfig.json`, ESLint, and the router) — they reference
composables and components (`useForm`, `useInfos`, `YCard`, `BButton`, ...)
that don't exist in this app. They're a reference for what those screens
used to do, not working code; building their native equivalents needs the
identity/session and service-control API contracts described as deferred in
`docs/ADMIN-FEATURE-MATRIX.md`.

## Adding the next screen

1. Add the route in `src/router/routes.ts` with `meta.nav` if it belongs in
   the sidebar — it will appear there automatically.
2. Reuse `src/components/ui/*` before writing new markup; add a primitive
   there (following the existing `variants.ts` + `cva` pattern) only when
   none of the existing ones fit.
3. Pull the corresponding frame from the Figma file for exact spacing,
   type, and color, and convert its React/Tailwind reference output to this
   project's Vue/`tw:`-prefixed conventions rather than pasting it in.
