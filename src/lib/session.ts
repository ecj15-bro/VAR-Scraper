// src/lib/session.ts — Trivial stub for local/file mode.
// All session functions return "default" so the single local user owns all data.
// runWithSession just calls the function directly — no AsyncLocalStorage needed.

/** Run async code — session is always "default" in local mode. */
export function runWithSession<T>(_sessionId: string, fn: () => T): T {
  return fn();
}

/** Always returns "default" in local mode. */
export function getCurrentSessionId(): string {
  return "default";
}

/**
 * Extract session ID from a request — always returns "default" in local mode.
 * Signature kept for API route compatibility.
 */
export function extractSessionId(_req: {
  headers: { get(name: string): string | null };
  cookies?: { get(name: string): { value: string } | undefined };
}): string {
  return "default";
}
