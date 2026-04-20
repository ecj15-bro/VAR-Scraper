// lib/jobs.ts — File-based job registry at /tmp/jobs.json.
// Persists across execution contexts so Inngest and the status route
// always read/write the same state. Synchronous fs to avoid race conditions.
// Interface is stable — will be backed by Supabase when multi-tenant is added.
import fs from "fs";
import type { OrchestratorResult } from "@/agents/orchestrator";

const JOBS_PATH = "/tmp/jobs.json";

export type JobStatus = "pending" | "running" | "complete" | "error";

export interface Job {
  id: string;
  status: JobStatus;
  createdAt: string;
  result?: OrchestratorResult;
  error?: string;
}

function readAll(): Record<string, Job> {
  try {
    if (fs.existsSync(JOBS_PATH)) {
      return JSON.parse(fs.readFileSync(JOBS_PATH, "utf8")) as Record<string, Job>;
    }
  } catch {}
  return {};
}

function writeAll(jobs: Record<string, Job>): void {
  fs.writeFileSync(JOBS_PATH, JSON.stringify(jobs, null, 2));
}

export function createJob(id: string): Job {
  const job: Job = { id, status: "pending", createdAt: new Date().toISOString() };
  const jobs = readAll();
  jobs[id] = job;
  writeAll(jobs);
  return job;
}

export function updateJob(id: string, update: Partial<Omit<Job, "id" | "createdAt">>): void {
  const jobs = readAll();
  if (jobs[id]) {
    jobs[id] = { ...jobs[id], ...update };
    writeAll(jobs);
  }
}

export function getJob(id: string): Job | undefined {
  return readAll()[id];
}
