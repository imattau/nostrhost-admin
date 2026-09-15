import type { NsiteSite } from '@/api/nativeNsites'
import { truncatePubkey } from '@/lib/utils'

// Used by the Sites list, the custom-domain site picker, and the
// create-my-copy source picker — the same short label everywhere a site
// needs identifying without room for its full manifest.
export function siteLabel(site: NsiteSite): string {
  return site.kind === 35128
    ? `${truncatePubkey(site.pubkey, 8, 0)}/d=${site.d}`
    : truncatePubkey(site.pubkey, 16, 0)
}
