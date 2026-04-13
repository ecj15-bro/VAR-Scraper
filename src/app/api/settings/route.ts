// api/settings — Read/write settings for non-Electron context (Vercel/local dev).
//
// In Electron, settings are handled via IPC (electron-store); this route is unused.
//
// In Vercel web mode with KV: settings are stored per-session in KV, allowing
// each user to bring their own API keys (BYOK). Keys are never exposed in responses.

import { NextRequest, NextResponse } from "next/server";
import { getStoreAdapter, getSettings, saveSettings } from "@/lib/store";
import { extractSessionId, runWithSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const sessionId = extractSessionId(req);
  console.log("[settings GET] sessionId:", sessionId, "adapter:", getStoreAdapter());

  if (getStoreAdapter() === "kv") {
    // Web mode: return per-session settings from KV (keys are masked)
    const stored = await runWithSession(sessionId, () => getSettings());
    console.log("[settings GET] KV returned keys:", Object.keys(stored), "hasAnthropicKey:", !!stored.ANTHROPIC_API_KEY, "hasSerperKey:", !!stored.SERPER_API_KEY);
    return NextResponse.json({
      ANTHROPIC_API_KEY: stored.ANTHROPIC_API_KEY ? "••••••••" : (process.env.ANTHROPIC_API_KEY ? "••••••••" : ""),
      SERPER_API_KEY: stored.SERPER_API_KEY ? "••••••••" : (process.env.SERPER_API_KEY ? "••••••••" : ""),
      RESEND_API_KEY: stored.RESEND_API_KEY ? "••••••••" : (process.env.RESEND_API_KEY ? "••••••••" : ""),
      REPORT_TO_EMAIL: stored.REPORT_TO_EMAIL ?? process.env.REPORT_TO_EMAIL ?? "",
      RESEND_FROM: stored.RESEND_FROM ?? process.env.RESEND_FROM ?? "",
      ENABLE_EMAIL_DELIVERY: stored.ENABLE_EMAIL_DELIVERY ?? process.env.ENABLE_EMAIL_DELIVERY ?? "false",
    });
  }

  // File mode (local dev without KV): return env vars (masked)
  return NextResponse.json({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? "••••••••" : "",
    SERPER_API_KEY: process.env.SERPER_API_KEY ? "••••••••" : "",
    RESEND_API_KEY: process.env.RESEND_API_KEY ? "••••••••" : "",
    REPORT_TO_EMAIL: process.env.REPORT_TO_EMAIL ?? "",
    RESEND_FROM: process.env.RESEND_FROM ?? "",
    ENABLE_EMAIL_DELIVERY: process.env.ENABLE_EMAIL_DELIVERY ?? "false",
  });
}

export async function POST(req: NextRequest) {
  console.log("[settings POST] adapter:", getStoreAdapter());
  console.log("[settings POST] UPSTASH_REDIS_REST_URL present:", !!process.env.UPSTASH_REDIS_REST_URL);
  console.log("[settings POST] UPSTASH_REDIS_REST_TOKEN present:", !!process.env.UPSTASH_REDIS_REST_TOKEN);
  const sessionId = extractSessionId(req);
  console.log("[settings POST] sessionId:", sessionId, "adapter:", getStoreAdapter());

  if (getStoreAdapter() === "kv") {
    try {
      const body = await req.json() as Record<string, string>;
      // Only allow known keys
      const allowed = ["ANTHROPIC_API_KEY", "SERPER_API_KEY", "RESEND_API_KEY", "REPORT_TO_EMAIL", "RESEND_FROM", "ENABLE_EMAIL_DELIVERY"];
      const filtered = Object.fromEntries(
        Object.entries(body).filter(([k]) => allowed.includes(k))
      );
      console.log("[settings POST] saving keys:", Object.keys(filtered), "hasAnthropicKey:", !!filtered.ANTHROPIC_API_KEY, "hasSerperKey:", !!filtered.SERPER_API_KEY);
      await runWithSession(sessionId, () => saveSettings(filtered));
      console.log("[settings POST] KV write done for session:", sessionId);
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
  }

  return NextResponse.json(
    { ok: false, message: "Settings can only be saved via the Electron desktop app or by setting environment variables." },
    { status: 400 }
  );
}
