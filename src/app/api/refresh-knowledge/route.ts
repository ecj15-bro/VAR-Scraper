// app/api/refresh-knowledge/route.ts
//   GET  — Vercel cron trigger (requires Bearer CRON_SECRET)
//   POST — Manual dashboard trigger (no auth required)

import { NextRequest, NextResponse } from "next/server";
import { runKnowledgeRefresh } from "@/agents/knowledge";
import { extractSessionId, runWithSession } from "@/lib/session";
import { getEnv } from "@/lib/env";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${getEnv().cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("📚 Knowledge refresh cron started (6am UTC)");
    const kb = await runWithSession("cron-default", () => runKnowledgeRefresh());
    console.log(`📚 Knowledge refresh complete. Last insights: ${kb.lastInsights.slice(0, 80)}...`);
    return NextResponse.json({ success: true, lastRefreshed: kb.lastRefreshed });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("Knowledge refresh cron failed:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sessionId = extractSessionId(req);
  try {
    console.log("📚 Manual knowledge refresh triggered from dashboard");
    const kb = await runWithSession(sessionId, () => runKnowledgeRefresh());
    return NextResponse.json({ success: true, lastRefreshed: kb.lastRefreshed, knowledgeBase: kb });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("Manual knowledge refresh failed:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
