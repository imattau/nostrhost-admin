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
