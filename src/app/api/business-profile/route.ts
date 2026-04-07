// api/business-profile — GET/POST business profile

import { NextRequest, NextResponse } from "next/server";
import { getStoredBusinessProfile, saveBusinessProfile, BusinessProfile } from "@/lib/store";
import { extractSessionId, runWithSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const sessionId = extractSessionId(req);
  const profile = await runWithSession(sessionId, () => getStoredBusinessProfile());
  return NextResponse.json(profile ?? null);
}

export async function POST(req: NextRequest) {
  const sessionId = extractSessionId(req);
  try {
    const body = await req.json() as BusinessProfile;
    await runWithSession(sessionId, () => saveBusinessProfile(body));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
