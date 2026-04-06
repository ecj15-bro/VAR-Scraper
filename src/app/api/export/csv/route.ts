// src/app/api/export/csv/route.ts — Bulk CSV export of all VAR reports

import { NextRequest, NextResponse } from "next/server";
import { getReports, ReportEntry } from "@/lib/store";

// ─── CSV HELPERS ──────────────────────────────────────────────────────────────

function escapeCSV(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  const str = String(value);
  // Always quote if contains comma, newline, or double-quote
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const COLUMNS = [
  "Company Name",
  "Decision Maker",
  "Title",
  "LinkedIn URL",
  "Company Website",
  "Fit Category",
  "Overall Score",
  "Relevance Score",
  "Confidence Score",
  "Deployment Ease",
  "Deal Size",
  "Recommended Tone",
  "Hook Angle",
  "Cold Email Pitch",
  "LinkedIn Message",
  "Follow-up Email",
  "Text Message",
  "Executive Brief",
  "Company Profile",
  "Person Profile",
  "News Title",
  "News Source",
  "Date Detected",
];

function reportToRow(r: ReportEntry): string {
  const fields = [
    r.companyName,
    r.decisionMaker,
    r.title,
    r.linkedinUrl ?? "",
    r.companyWebsite ?? "",
    r.varFitScore?.fitCategory ?? "",
    r.varFitScore?.overallScore ?? "",
    r.relevanceScore ?? "",
    r.confidenceScore ?? "",
    r.varFitScore?.deploymentEase ?? "",
    r.varFitScore?.estimatedDealSize ?? "",
    r.pitchContext?.toneRecommendation ?? "",
    r.pitchContext?.hookAngle ?? "",
    r.pitchVariants?.cold_email ?? r.pitch ?? "",
    r.pitchVariants?.linkedin_message ?? "",
    r.pitchVariants?.followup_email ?? "",
    r.pitchVariants?.text_message ?? "",
    r.pitchVariants?.executive_brief ?? "",
    r.companyProfile,
    r.personProfile,
    r.newsTitle,
    r.newsSource,
    new Date(r.timestamp).toISOString(),
  ];
  return fields.map(escapeCSV).join(",");
}

// ─── ROUTE ───────────────────────────────────────────────────────────────────

// GET /api/export/csv?format=csv (default) | ?format=sheets
export async function GET(req: NextRequest) {
  try {
    const reports = getReports();
    if (reports.length === 0) {
      return NextResponse.json({ error: "No reports to export" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") ?? "csv";
    const sheetsMode = format === "sheets";

    const headerRow = COLUMNS.map(escapeCSV).join(",");
    const dataRows = reports.map(reportToRow);
    const csvContent = [headerRow, ...dataRows].join("\r\n");

    // UTF-8 BOM for Excel / Google Sheets compatibility
    const bom = sheetsMode ? "\uFEFF" : "";
    const body = bom + csvContent;

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = sheetsMode
      ? `Cloudbox-VAR-Leads-Sheets-${dateStr}.csv`
      : `Cloudbox-VAR-Leads-${dateStr}.csv`;

    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
