// app/api/reports/route.ts — Returns, deletes, and clears stored VAR reports

import { NextRequest, NextResponse } from "next/server";
import {
  getReports,
  getKnowledgeBase,
  deleteReport,
  clearReports,
  getSearchEvolution,
  getUniqueQueryCount,
} from "@/lib/store";

export async function GET() {
  try {
    const reports = getReports();
    const knowledgeBase = getKnowledgeBase();
    const searchEvolution = getSearchEvolution();
    const totalUniqueQueries = getUniqueQueryCount();
    return NextResponse.json({ reports, knowledgeBase, searchEvolution, totalUniqueQueries });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/reports?id=<id>  — delete one report
// DELETE /api/reports?all=true — clear all reports + seenCompanies
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    if (searchParams.get("all") === "true") {
      clearReports();
      return NextResponse.json({ success: true, cleared: true });
    }

    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id or all param" }, { status: 400 });

    const deleted = deleteReport(id);
    if (!deleted) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    return NextResponse.json({ success: true, deleted: id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
