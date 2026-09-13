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
