// app/api/status/[jobId]/route.ts — Job status polling endpoint.
// The dashboard polls this every 3 seconds after triggering a run.
// Returns { status: "pending" | "running" | "complete" | "error", result?, error? }
import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json(job);
}
