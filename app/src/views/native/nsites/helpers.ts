import type { NsiteSite } from '@/api/nativeNsites'

// Used by the Sites list, the custom-domain site picker, and the
// create-my-copy source picker — the same short label everywhere a site
// needs identifying without room for its full manifest.
export function siteLabel(site: NsiteSite): string {
  return site.kind === 35128
    ? `${site.pubkey.slice(0, 8)}…/d=${site.d}`
    : `${site.pubkey.slice(0, 16)}…`
}
