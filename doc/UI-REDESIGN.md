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
  YunoHost user portal SPA at `/yunohost/sso/` on the same domain — it isn't
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
  interrupt the service in use, start does not).
- **API clients** (`src/api/`): `client.ts` holds the shared NIP-98 request
  signer; `nativePackages.ts`, `nativeSystem.ts`, `nativeCatalog.ts`,
  `nativeIdentity.ts`, `nativeService.ts` are thin typed wrappers per
  resource area, one file per route group in `nostrhost-yunohost`'s
  `src/nostrhost/api.py`.

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
