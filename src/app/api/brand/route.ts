// api/brand — GET/POST brand configuration

import { NextRequest, NextResponse } from "next/server";
import { getBrandConfig } from "@/lib/brand";
import { saveBrandConfig, BrandConfig } from "@/lib/store";

export async function GET() {
  const brand = getBrandConfig();
  // Don't send the full logoDataUrl in list — only on explicit request (it can be large)
  return NextResponse.json({
    companyName: brand.companyName,
    tagline: brand.tagline,
    primaryColor: brand.primaryColor,
    hasLogo: !!brand.logoDataUrl,
    logoDataUrl: brand.logoDataUrl, // included for settings page preview
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<BrandConfig>;
    const current = getBrandConfig();

    const updated: BrandConfig = {
      companyName: body.companyName ?? current.companyName,
      tagline: body.tagline ?? current.tagline,
      primaryColor: body.primaryColor ?? current.primaryColor,
      // Only update logo if explicitly provided
      logoDataUrl: body.logoDataUrl !== undefined ? body.logoDataUrl : current.logoDataUrl,
    };

    saveBrandConfig(updated);
    return NextResponse.json({ ok: true, brand: updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
