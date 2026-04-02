// app/api/backfill/route.ts — Triggers a backfill run covering the past 30 days

import { NextRequest, NextResponse } from "next/server";
import { runOrchestrator } from "@/agents/orchestrator";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // Verify caller — backfill is an expensive operation
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("📦 Backfill run started (past 30 days)");
    const result = await runOrchestrator({ backfill: true });
    console.log(`✅ Backfill complete: ${result.processed} reports generated`);
    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("Backfill run failed:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
