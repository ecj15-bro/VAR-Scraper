// app/api/run/route.ts — Manual pipeline trigger from dashboard.
// Returns immediately with { accepted: true, jobId }.
// Client polls /api/status/[jobId] for results.
import { NextRequest, NextResponse } from "next/server";
import { extractSessionId } from "@/lib/session";
import { createJob } from "@/lib/jobs";
import { triggerPipeline } from "@/lib/trigger";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  extractSessionId(req);
  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun === true;

    const jobId = crypto.randomUUID();
    createJob(jobId);

    // Fire and forget — triggerPipeline keeps running after response is returned.
    // In production this moves to an Inngest event; the interface here stays identical.
    triggerPipeline(jobId, { dryRun }).catch((e) => {
      console.error("[run] Background pipeline error:", e);
    });

    return NextResponse.json({ accepted: true, jobId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
