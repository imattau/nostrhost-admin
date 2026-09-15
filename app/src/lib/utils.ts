import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind.css sets up Tailwind with a `tw:` prefix (see that file for why),
// so twMerge needs to know about it to correctly resolve conflicts between
// e.g. `tw:p-4` and `tw:p-2`.
const twMerge = extendTailwindMerge({ prefix: 'tw:' })

// Standard shadcn-vue helper: merges conditional class lists (`clsx`) and
// resolves conflicting Tailwind utility classes (`twMerge`), e.g. letting a
// consumer override a component's default `tw:p-4` with `tw:p-2`.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Shortens a hex pubkey or npub for display in a list row, e.g.
// "npub1abcdefabcdef…9c8b7a6f".
export function shortenKey(key: string) {
  return `${key.slice(0, 12)}…${key.slice(-8)}`
}

// Shorter variant for compact inline display (e.g. next to a badge), e.g.
// "abcdef12…9c8b".
export function truncatePubkey(pubkey: string) {
  return pubkey.length > 16 ? `${pubkey.slice(0, 8)}…${pubkey.slice(-4)}` : pubkey
}

// Formats a byte count for display, e.g. 1536 -> "1.5 KB".
export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )
  return `${(bytes / 1024 ** exponent).toFixed(1)} ${units[exponent]}`
}
