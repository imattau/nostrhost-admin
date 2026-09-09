# UI redesign: Tailwind + shadcn-vue

This fork is migrating off Bootstrap Vue Next onto Tailwind CSS + shadcn-vue
style primitives (branch `ui-redesign-tailwind-shadcn`). Goal: a cleaner,
lower-abstraction UI, and less framework surface for maintainers to know.

## Why this stack

- **Tailwind**: utility classes instead of hand-written SCSS per component —
  fewer files to open to change how something looks, no BEM/naming
  bikeshedding, and dead styles are easy to spot from the markup itself.
- **shadcn-vue style primitives**: components are copied into
  `src/components/ui/` as plain Vue SFCs (not an installed dependency you
  fight the API of), built on `class-variance-authority` for variants and
  `reka-ui` for accessible headless behaviour (menus, dialogs, etc. as those
  get migrated). You own the code, so there's nothing to "eject" from later.

## Coexistence during migration

Bootstrap Vue Next is still used by most views (see `yarn why bootstrap-vue-next`
for the full surface — ~66 of 89 `.vue` files at the time this migration
started). Both frameworks run side by side until every view is migrated:

- Tailwind utilities are emitted with a `tw:` prefix (`tw:flex`, `tw:p-4`, ...)
  — see `src/assets/tailwind.css` for why. **Every new/migrated component
  must use the `tw:` prefix**, never bare Tailwind class names.
- Tailwind's preflight (CSS reset) is not imported, so it can't fight
  Bootstrap's reboot in `src/scss/main.scss`.
- Dark mode for Tailwind utilities (`tw:dark:*`) reads the same
  `data-bs-theme` attribute `useSettings` already sets on `<html>` for
  Bootstrap — one dark-mode toggle, not two.

Once every view is migrated: drop the bootstrap imports from
`src/scss/main.scss`, drop `bootstrap`/`bootstrap-vue-next`/`fork-awesome`
from `package.json`, drop the `tw:` prefix and preflight opt-out in
`src/assets/tailwind.css`.

## What's migrated so far

- App shell: header/nav and footer (`src/App.vue`)
- Breadcrumb (`src/components/globals/YBreadcrumb.vue`)
- Home screen (`src/views/HomeView.vue`)
- New primitives: `Button`, `Card`, `Badge` (`src/components/ui/`)

## What's not migrated yet

Everything else — forms, tables, modals, the settings/tool views, user &
domain management, backups, diagnosis, etc. Migrate incrementally, view group
by view group, reusing/extending the primitives in `src/components/ui/`
rather than one-off styling per view. `src/components/modals/`,
`src/components/globals/ConfigPanels.vue` and `src/components/globals/formItems/`
are the highest-value next targets since nearly every view depends on them.

## Icons

New/migrated components use `lucide-vue-next` instead of `fork-awesome`
(smaller, tree-shakeable, actively maintained, matches the shadcn-vue
ecosystem's default icon set). `fork-awesome`/`YIcon` still cover
not-yet-migrated views.
