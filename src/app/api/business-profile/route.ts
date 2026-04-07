// api/business-profile — GET/POST business profile

import { NextRequest, NextResponse } from "next/server";
import { getStoredBusinessProfile, saveBusinessProfile, BusinessProfile } from "@/lib/store";

export async function GET() {
  const profile = getStoredBusinessProfile();
  return NextResponse.json(profile ?? null);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as BusinessProfile;
    saveBusinessProfile(body);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
