// api/translate-context — Translates a business profile into a WatchtowerConfig

import { NextRequest, NextResponse } from "next/server";
import { translateBusinessContext } from "@/agents/context";
import { saveWatchtowerConfig, saveBusinessProfile, BusinessProfile } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { profile: BusinessProfile; save?: boolean };
    if (!body.profile) {
      return NextResponse.json({ error: "Missing business profile" }, { status: 400 });
    }

    const config = await translateBusinessContext(body.profile);

    // Optionally persist both the profile and generated config
    if (body.save) {
      saveBusinessProfile(body.profile);
      saveWatchtowerConfig(config);
    }

    return NextResponse.json({ ok: true, config });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
