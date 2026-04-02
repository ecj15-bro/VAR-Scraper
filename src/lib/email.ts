// lib/email.ts — Report delivery utility
// Currently delegates to the Teams webhook. Add additional delivery channels here.

import { sendToTeams, VARReport } from "./teams";

export type { VARReport };

export async function sendReport(report: VARReport): Promise<void> {
  await sendToTeams(report);
}
