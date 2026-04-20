// lib/trigger.ts — Pipeline trigger abstraction.
// Emits a "pipeline/run" event to Inngest, which executes the orchestrator
// as a durable background function. Job status is updated by the Inngest
// handler in src/app/api/inngest/route.ts.
import { inngest } from "./inngest-client";

export interface TriggerOptions {
  dryRun?: boolean;
  backfill?: boolean;
}

export async function triggerPipeline(jobId: string, options: TriggerOptions): Promise<void> {
  await inngest.send({
    name: "pipeline/run",
    data: { jobId, ...options },
  });
}
