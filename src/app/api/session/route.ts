// api/session — Session info endpoint for web mode.
//
// GET  — Returns the current session ID and whether it's new (has no data yet).
// POST — Resets the session (generates a new session ID on the client side).
//
// The client generates its own UUID in localStorage. This endpoint just
// confirms the session is valid and tells the UI if onboarding is needed.

import { NextRequest, NextResponse } from "next/server";
import { extractSessionId, runWithSession } from "@/lib/session";
import { getStoredBrandConfig } from "@/lib/store";

export async function GET(req: NextRequest) {
  const sessionId = extractSessionId(req);

  // Check if this session has any data (brand config = has been set up)
  const brand = await runWithSession(sessionId, () => getStoredBrandConfig());
  const isNew = !brand;

  return NextResponse.json({
    sessionId,
    isNew,
    needsSetup: isNew,
  });
}
