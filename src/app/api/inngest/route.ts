export const runtime = "nodejs";

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest-client";
import { runOrchestrator } from "@/agents/orchestrator";
import { updateJob } from "@/lib/jobs";

const runPipeline = inngest.createFunction(
  {
    id: "run-pipeline",
    name: "Run VAR Hunter Pipeline",
    triggers: [{ event: "pipeline/run" }],
  },
  async ({ event }: { event: { data: { jobId: string; dryRun?: boolean; backfill?: boolean } } }) => {
    const { jobId, dryRun, backfill } = event.data;

    updateJob(jobId, { status: "running" });

    try {
      const result = await runOrchestrator({ dryRun, backfill });
      updateJob(jobId, { status: "complete", result });
      return result;
    } catch (e) {
      const error = e instanceof Error ? e.message : "Unknown error";
      updateJob(jobId, { status: "error", error });
      throw e;
    }
  }
);

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [runPipeline],
});
