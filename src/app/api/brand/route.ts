// api/brand — GET/POST brand configuration

import { NextRequest, NextResponse } from "next/server";
import { getBrandConfig } from "@/lib/brand";
import { saveBrandConfig, BrandConfig } from "@/lib/store";
import { extractSessionId, runWithSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const sessionId = extractSessionId(req);
  const brand = await runWithSession(sessionId, () => getBrandConfig());
  return NextResponse.json({
    companyName: brand.companyName,
    tagline: brand.tagline,
    primaryColor: brand.primaryColor,
    hasLogo: !!brand.logoDataUrl,
    logoDataUrl: brand.logoDataUrl,
  });
}

export async function POST(req: NextRequest) {
  const sessionId = extractSessionId(req);
  try {
    const body = await req.json() as Partial<BrandConfig>;
    const current = await runWithSession(sessionId, () => getBrandConfig());

    const updated: BrandConfig = {
      companyName: body.companyName ?? current.companyName,
      tagline: body.tagline ?? current.tagline,
      primaryColor: body.primaryColor ?? current.primaryColor,
      logoDataUrl: body.logoDataUrl !== undefined ? body.logoDataUrl : current.logoDataUrl,
    };

    await runWithSession(sessionId, () => saveBrandConfig(updated));
    return NextResponse.json({ ok: true, brand: updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
