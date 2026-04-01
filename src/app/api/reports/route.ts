// app/api/reports/route.ts — Returns stored VAR reports

import { NextResponse } from "next/server";
import { getReports } from "@/lib/store";

export async function GET() {
  try {
    const reports = getReports();
    return NextResponse.json({ reports });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
