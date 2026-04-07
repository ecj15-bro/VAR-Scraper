// src/lib/session.ts — Per-user session management for web mode.
//
// In Electron, there is a single user; getCurrentSessionId() always returns 'default'.
// In web mode, each browser gets a UUID stored in a cookie (session-id) on first visit.
// The cookie is sent automatically on every same-origin request — no fetch changes needed.

import { AsyncLocalStorage } from "async_hooks";

const _storage = new AsyncLocalStorage<string>();

// ─── SERVER-SIDE ─────────────────────────────────────────────────────────────

/** Run async code with the given session ID propagated through the whole call chain. */
export function runWithSession<T>(sessionId: string, fn: () => T): T {
  return _storage.run(sessionId, fn);
}

/** Returns the active session ID, or 'default' when outside a session context (Electron). */
export function getCurrentSessionId(): string {
  return _storage.getStore() ?? "default";
}

/**
 * Extract the session ID from an HTTP request.
 * Checks X-Session-ID header first, then session-id cookie (sent automatically by browsers).
 * Returns 'default' when neither is present (Electron IPC, cron, tests).
 */
export function extractSessionId(req: {
  headers: { get(name: string): string | null };
  cookies?: { get(name: string): { value: string } | undefined };
}): string {
  const header = req.headers.get("x-session-id");
  if (header && /^[a-z0-9-]{8,64}$/i.test(header)) return header;

  const cookie = req.cookies?.get("session-id")?.value;
  if (cookie && /^[a-z0-9-]{8,64}$/i.test(cookie)) return cookie;

  return "default";
}
