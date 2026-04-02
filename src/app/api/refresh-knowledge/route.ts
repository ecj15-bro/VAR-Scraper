// app/api/refresh-knowledge/route.ts
//   GET  — Vercel cron trigger (requires Bearer CRON_SECRET)
//   POST — Manual dashboard trigger (no auth required)

import { NextRequest, NextResponse } from "next/server";
import { runKnowledgeRefresh } from "@/agents/knowledge";

export const maxDuration = 300;

// Vercel cron hits this via GET with the Authorization header
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("📚 Knowledge refresh cron started (6am UTC)");
    const kb = await runKnowledgeRefresh();
    console.log(`📚 Knowledge refresh complete. Last insights: ${kb.lastInsights.slice(0, 80)}...`);
    return NextResponse.json({ success: true, lastRefreshed: kb.lastRefreshed });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("Knowledge refresh cron failed:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Dashboard "Refresh Now" button hits this via POST
export async function POST(_req: NextRequest) {
  try {
    console.log("📚 Manual knowledge refresh triggered from dashboard");
    const kb = await runKnowledgeRefresh();
    return NextResponse.json({ success: true, lastRefreshed: kb.lastRefreshed });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("Manual knowledge refresh failed:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
