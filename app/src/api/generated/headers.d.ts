// Type augmentation for the Orval-generated client. The generated
// getHeaders() helper calls Headers.entries(), which is not in this TS
// lib.dom (5.7); the runtime Headers object does expose it. We never forward
// generated headers to the wire (orvalRequest uses the authenticated
// request() wrapper), so this is a type-only shim.
interface Headers {
  entries(): IterableIterator<[string, string]>
}