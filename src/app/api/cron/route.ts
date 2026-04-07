// app/api/cron/route.ts — Vercel cron job endpoint (runs daily at 9am UTC)

import { NextRequest, NextResponse } from "next/server";
import { runOrchestrator } from "@/agents/orchestrator";
import { runWithSession } from "@/lib/session";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("⏰ Daily VAR Hunter cron job started");
    // Cron runs in a shared session — data accumulates across all cron runs
    const result = await runWithSession("cron-default", () => runOrchestrator());
    console.log(`✅ Cron complete: ${result.processed} reports generated`);
    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("Cron job failed:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
