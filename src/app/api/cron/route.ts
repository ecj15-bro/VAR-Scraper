// app/api/cron/route.ts — Vercel cron job endpoint (runs daily at 9am UTC)

import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";

export const maxDuration = 300; // 5 min timeout

export async function GET(req: NextRequest) {
  // Verify this is called by Vercel Cron (not a random request)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("⏰ Daily VAR Hunter cron job started");
    const result = await runPipeline();
    console.log(`✅ Cron complete: ${result.processed} reports sent`);
    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    console.error("Cron job failed:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
