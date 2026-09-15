// Normalizes a caught value into a human-readable message. Every view's
// catch block (and useSigner's session probe) repeats
// `cause instanceof Error ? cause.message : fallback` inline — this is that
// idiom, named, so it reads the same everywhere it's used.
export function toErrorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}
