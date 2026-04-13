// GET /api/export/json — Export all session data as a downloadable JSON file.

import { NextRequest, NextResponse } from "next/server";
import { extractSessionId, runWithSession } from "@/lib/session";
import {
  getReports,
  getSearchHistory,
  getSearchEvolution,
  getKnowledgeBase,
  getStoredBrandConfig,
  getStoredBusinessProfile,
  getSettings,
} from "@/lib/store";

export async function GET(req: NextRequest) {
  const sessionId = extractSessionId(req);
  try {
    const [reports, searchHistory, searchEvolution, knowledgeBase, brandConfig, businessProfile, settings] =
      await runWithSession(sessionId, () =>
        Promise.all([
          getReports(),
          getSearchHistory(),
          getSearchEvolution(),
          getKnowledgeBase(),
          getStoredBrandConfig(),
          getStoredBusinessProfile(),
          getSettings(),
        ])
      );

    const payload = {
      exportedAt: new Date().toISOString(),
      reports,
      searchHistory,
      searchEvolution,
      knowledgeBase,
      brandConfig,
      businessProfile,
      settings,
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="var-hunter-export-${dateStr}.json"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
