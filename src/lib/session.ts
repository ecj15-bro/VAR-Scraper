import { auth } from "@clerk/nextjs/server";

/** Run async code — session is always "default" in local mode. */
export function runWithSession<T>(_sessionId: string, fn: () => T): T {
  return fn();
}

/** Always returns "default" in local mode. */
export function getCurrentSessionId(): string {
  return "default";
}

/**
 * Extracts the authenticated user's ID from Clerk.
 * Returns "default" when no Clerk session is present (local/Electron mode).
 */
export async function extractSessionId(_req: {
  headers: { get(name: string): string | null };
  cookies?: { get(name: string): { value: string } | undefined };
}): Promise<string> {
  const { userId } = await auth();
  return userId ?? "default";
}
