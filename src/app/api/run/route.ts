// app/api/run/route.ts — Manual pipeline trigger from dashboard

import { NextRequest, NextResponse } from "next/server";
import { runOrchestrator } from "@/agents/orchestrator";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun === true;

    const result = await runOrchestrator({ dryRun });
    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
