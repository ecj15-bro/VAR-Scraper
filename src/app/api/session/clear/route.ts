// POST /api/session/clear — Wipe all KV data for the current session.
// Called from Settings > Session & Data when the user chooses "Clear All My Data".

import { NextRequest, NextResponse } from "next/server";
import { extractSessionId, runWithSession } from "@/lib/session";
import { clearSessionData } from "@/lib/store";

export async function POST(req: NextRequest) {
  const sessionId = extractSessionId(req);
  if (sessionId === "default") {
    return NextResponse.json({ error: "No session" }, { status: 400 });
  }
  await runWithSession(sessionId, () => clearSessionData());
  return NextResponse.json({ ok: true });
}
