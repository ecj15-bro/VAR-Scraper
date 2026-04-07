// api/settings — read/write settings for non-Electron context (Vercel/local dev)
// In Electron, settings are handled via IPC; this route is a no-op fallback.

import { NextResponse } from "next/server";

export async function GET() {
  // Return sanitized config from process.env (masks actual key values)
  return NextResponse.json({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? "••••••••" : "",
    SERPER_API_KEY: process.env.SERPER_API_KEY ? "••••••••" : "",
    RESEND_API_KEY: process.env.RESEND_API_KEY ? "••••••••" : "",
    REPORT_TO_EMAIL: process.env.REPORT_TO_EMAIL ?? "",
    RESEND_FROM: process.env.RESEND_FROM ?? "",
    ENABLE_EMAIL_DELIVERY: process.env.ENABLE_EMAIL_DELIVERY ?? "false",
  });
}

export async function POST() {
  // Cannot write to process.env from API in Vercel/local dev context
  return NextResponse.json(
    { ok: false, message: "Settings can only be saved via the Electron desktop app." },
    { status: 400 }
  );
}
