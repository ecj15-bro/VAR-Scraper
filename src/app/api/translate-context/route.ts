// api/translate-context — Translates a business profile into a WatchtowerConfig

import { NextRequest, NextResponse } from "next/server";
import { translateBusinessContext } from "@/agents/context";
import { saveWatchtowerConfig, saveBusinessProfile, BusinessProfile } from "@/lib/store";
import { extractSessionId, runWithSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const sessionId = extractSessionId(req);
  try {
    const body = await req.json() as { profile: BusinessProfile; save?: boolean };
    if (!body.profile) {
      return NextResponse.json({ error: "Missing business profile" }, { status: 400 });
    }

    const config = await runWithSession(sessionId, () =>
      translateBusinessContext(body.profile)
    );

    if (body.save) {
      await runWithSession(sessionId, () =>
        Promise.all([
          saveBusinessProfile(body.profile),
          saveWatchtowerConfig(config),
        ])
      );
    }

    return NextResponse.json({ ok: true, config });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
