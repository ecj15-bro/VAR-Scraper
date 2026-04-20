// lib/deliver.ts — Delivery abstraction layer.
// All agents import from here, never directly from email.ts.
// When we add Slack, Teams webhook, or other delivery channels, only this file changes.
export type { VARReport } from "./email";
import { sendReport } from "./email";
import type { VARReport } from "./email";

export async function deliverReport(report: VARReport): Promise<void> {
  return sendReport(report);
}
