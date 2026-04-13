// api/settings — Read/write per-session API keys in KV (web/Vercel mode).
// Constructs the Redis client directly from env vars to avoid adapter detection issues.

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { extractSessionId } from "@/lib/session";

const ALLOWED_KEYS = [
  "ANTHROPIC_API_KEY",
  "SERPER_API_KEY",
  "RESEND_API_KEY",
  "REPORT_TO_EMAIL",
  "RESEND_FROM",
  "ENABLE_EMAIL_DELIVERY",
];

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  console.log("[settings] UPSTASH_REDIS_REST_URL present:", !!url, "UPSTASH_REDIS_REST_TOKEN present:", !!token);
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function GET(req: NextRequest) {
  const sessionId = extractSessionId(req);
  console.log("[settings GET] sessionId:", sessionId);

  const redis = getRedis();
  if (!redis) {
    // No KV — return env vars (masked)
    console.log("[settings GET] no KV, returning env vars");
    return NextResponse.json({
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? "••••••••" : "",
      SERPER_API_KEY: process.env.SERPER_API_KEY ? "••••••••" : "",
      RESEND_API_KEY: process.env.RESEND_API_KEY ? "••••••••" : "",
      REPORT_TO_EMAIL: process.env.REPORT_TO_EMAIL ?? "",
      RESEND_FROM: process.env.RESEND_FROM ?? "",
      ENABLE_EMAIL_DELIVERY: process.env.ENABLE_EMAIL_DELIVERY ?? "false",
    });
  }

  try {
    const raw = await redis.get<Record<string, string>>(`${sessionId}:settings`);
    const stored: Record<string, string> = raw ?? {};
    console.log("[settings GET] KV stored keys:", Object.keys(stored), "hasAnthropicKey:", !!stored.ANTHROPIC_API_KEY, "hasSerperKey:", !!stored.SERPER_API_KEY);
    return NextResponse.json({
      ANTHROPIC_API_KEY: stored.ANTHROPIC_API_KEY ? "••••••••" : (process.env.ANTHROPIC_API_KEY ? "••••••••" : ""),
      SERPER_API_KEY: stored.SERPER_API_KEY ? "••••••••" : (process.env.SERPER_API_KEY ? "••••••••" : ""),
      RESEND_API_KEY: stored.RESEND_API_KEY ? "••••••••" : (process.env.RESEND_API_KEY ? "••••••••" : ""),
      REPORT_TO_EMAIL: stored.REPORT_TO_EMAIL ?? process.env.REPORT_TO_EMAIL ?? "",
      RESEND_FROM: stored.RESEND_FROM ?? process.env.RESEND_FROM ?? "",
      ENABLE_EMAIL_DELIVERY: stored.ENABLE_EMAIL_DELIVERY ?? process.env.ENABLE_EMAIL_DELIVERY ?? "false",
    });
  } catch (e: any) {
    console.error("[settings GET] KV error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sessionId = extractSessionId(req);
  console.log("[settings POST] sessionId:", sessionId);

  const redis = getRedis();
  if (!redis) {
    console.error("[settings POST] KV not configured");
    return NextResponse.json({ ok: false, message: "KV not configured" }, { status: 503 });
  }

  try {
    const body = (await req.json()) as Record<string, string>;
    const filtered = Object.fromEntries(
      Object.entries(body).filter(([k]) => ALLOWED_KEYS.includes(k))
    );
    console.log("[settings POST] saving keys:", Object.keys(filtered), "hasAnthropicKey:", !!filtered.ANTHROPIC_API_KEY, "hasSerperKey:", !!filtered.SERPER_API_KEY);

    // Merge with existing so a partial save doesn't wipe other keys
    const existing = (await redis.get<Record<string, string>>(`${sessionId}:settings`)) ?? {};
    const merged = { ...existing, ...filtered };
    await redis.set(`${sessionId}:settings`, merged);

    console.log("[settings POST] KV write done for session:", sessionId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[settings POST] error:", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
