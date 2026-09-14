# NostrHost Admin

The admin interface is a Vue 3 + TypeScript single-page application. Its
current native screen supports Nostr signer connection and read-only package
manifest schema, validation, and plan review.
The release package is built by the umbrella repository from
`packaging/packages.yml` and installs static assets under
`/usr/share/nostrhost/admin`, served at `/nostrhost/admin/`.

## Build

Use Node.js 22 and the pinned Yarn Classic release:

```sh
corepack yarn@1.22.22 install --frozen-lockfile --non-interactive
VITE_BASE_URL=/admin/ corepack yarn@1.22.22 build
```

The official package build uses the same commands through
`packaging/scripts/build-package`, which removes old output before building so
stale `dist/` files cannot enter a release.

## Development

Run `corepack yarn@1.22.22 dev` from `app/`. The dev server listens on
`http://127.0.0.1:8080` and proxies `/package` to
`http://127.0.0.1:8190`. Set `VITE_API_TARGET` when the native API listens
elsewhere. Requests are authenticated by the portal session cookie
(`nostrhost.portal`), with a NIP-07 browser signer as a fallback when there
is no session; the proxy preserves the request path and host and forwards
the scheme for NIP-98 verification.

Before submitting UI work, run:

```sh
corepack yarn@1.22.22 lint
corepack yarn@1.22.22 type-check
```

The shipped route table contains only native admin views; there is no legacy
YunoHost screen or cookie/form-data API client left in the tree to avoid.
