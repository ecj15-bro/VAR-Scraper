// app/api/reports/route.ts — Returns stored VAR reports

import { NextResponse } from "next/server";
import { getReports, getKnowledgeBase } from "@/lib/store";

export async function GET() {
  try {
    const reports = getReports();
    const knowledgeBase = getKnowledgeBase();
    return NextResponse.json({ reports, knowledgeBase });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
