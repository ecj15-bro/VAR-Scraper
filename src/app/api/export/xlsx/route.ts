// src/app/api/export/xlsx/route.ts — Styled Excel workbook export with summary sheet

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getReports, ReportEntry } from "@/lib/store";
import { extractSessionId, runWithSession } from "@/lib/session";

// ─── THEME ────────────────────────────────────────────────────────────────────

const THEME = {
  headerBg: "0D0D1A",
  headerFg: "FFFFFF",
  accentGreen: "00CC66",
  accentGreenFg: "003311",
  strong: "00AA55",
  strongBg: "E6F9EF",
  moderate: "CC8800",
  moderateBg: "FFF8E6",
  weak: "CC5500",
  weakBg: "FFF1E6",
  avoid: "CC2222",
  avoidBg: "FFE6E6",
  muted: "666680",
  border: "D0D0EC",
  summaryHeaderBg: "1A1A3A",
  summaryAccent: "7C3AED",
} as const;

function hex(s: string): ExcelJS.Color {
  return { argb: `FF${s}`, theme: 0 };
}

// ─── COLUMN DEFINITIONS ──────────────────────────────────────────────────────

interface ColDef {
  key: string;
  header: string;
  width: number;
  wrap?: boolean;
}

const COLUMNS: ColDef[] = [
  { key: "companyName",       header: "Company Name",        width: 28 },
  { key: "decisionMaker",     header: "Decision Maker",      width: 24 },
  { key: "title",             header: "Title",               width: 28 },
  { key: "linkedinUrl",       header: "LinkedIn URL",        width: 36 },
  { key: "companyWebsite",    header: "Company Website",     width: 30 },
  { key: "fitCategory",       header: "Fit Category",        width: 14 },
  { key: "overallScore",      header: "Overall Score",       width: 13 },
  { key: "relevanceScore",    header: "Relevance Score",     width: 14 },
  { key: "confidenceScore",   header: "Confidence Score",    width: 15 },
  { key: "deploymentEase",    header: "Deployment Ease",     width: 16 },
  { key: "dealSize",          header: "Deal Size",           width: 12 },
  { key: "tone",              header: "Recommended Tone",    width: 17 },
  { key: "hookAngle",         header: "Hook Angle",          width: 40, wrap: true },
  { key: "coldEmail",         header: "Cold Email Pitch",    width: 60, wrap: true },
  { key: "linkedinMessage",   header: "LinkedIn Message",    width: 60, wrap: true },
  { key: "followupEmail",     header: "Follow-up Email",     width: 60, wrap: true },
  { key: "textMessage",       header: "Text Message",        width: 40, wrap: true },
  { key: "executiveBrief",    header: "Executive Brief",     width: 60, wrap: true },
  { key: "companyProfile",    header: "Company Profile",     width: 60, wrap: true },
  { key: "personProfile",     header: "Person Profile",      width: 60, wrap: true },
  { key: "newsTitle",         header: "News Title",          width: 50, wrap: true },
  { key: "newsSource",        header: "News Source",         width: 50 },
  { key: "dateDetected",      header: "Date Detected",       width: 22 },
];

function reportToRow(r: ReportEntry): Record<string, string | number> {
  return {
    companyName:     r.companyName,
    decisionMaker:   r.decisionMaker,
    title:           r.title,
    linkedinUrl:     r.linkedinUrl ?? "",
    companyWebsite:  r.companyWebsite ?? "",
    fitCategory:     r.varFitScore?.fitCategory ?? "",
    overallScore:    r.varFitScore?.overallScore ?? "",
    relevanceScore:  r.relevanceScore ?? "",
    confidenceScore: r.confidenceScore ?? "",
    deploymentEase:  r.varFitScore?.deploymentEase ?? "",
    dealSize:        r.varFitScore?.estimatedDealSize ?? "",
    tone:            r.pitchContext?.toneRecommendation ?? "",
    hookAngle:       r.pitchContext?.hookAngle ?? "",
    coldEmail:       r.pitchVariants?.cold_email ?? r.pitch ?? "",
    linkedinMessage: r.pitchVariants?.linkedin_message ?? "",
    followupEmail:   r.pitchVariants?.followup_email ?? "",
    textMessage:     r.pitchVariants?.text_message ?? "",
    executiveBrief:  r.pitchVariants?.executive_brief ?? "",
    companyProfile:  r.companyProfile,
    personProfile:   r.personProfile,
    newsTitle:       r.newsTitle,
    newsSource:      r.newsSource,
    dateDetected:    new Date(r.timestamp).toLocaleString("en-US"),
  };
}

// ─── WORKBOOK BUILDER ────────────────────────────────────────────────────────

async function buildWorkbook(reports: ReportEntry[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Cloudbox VAR Hunter";
  wb.created = new Date();

  // ── Sheet 1: All Leads ────────────────────────────────────────────────────
  const ws = wb.addWorksheet("VAR Leads", {
    views: [{ state: "frozen", ySplit: 1 }], // freeze header row
    properties: { defaultRowHeight: 18 },
  });

  ws.columns = COLUMNS.map((c) => ({
    key: c.key,
    header: c.header,
    width: c.width,
  }));

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: hex(THEME.headerBg) };
    cell.font = { bold: true, color: hex(THEME.headerFg), size: 10, name: "Calibri" };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
    cell.border = {
      bottom: { style: "thin", color: hex(THEME.accentGreen) },
    };
  });
  headerRow.height = 24;

  // Add data rows
  for (const r of reports) {
    const row = ws.addRow(reportToRow(r));
    row.font = { size: 10, name: "Calibri" };
    row.alignment = { vertical: "top" };
    row.height = 18;

    // Wrap long text columns
    COLUMNS.forEach((col, i) => {
      if (col.wrap) {
        const cell = row.getCell(i + 1);
        cell.alignment = { vertical: "top", wrapText: true };
      }
    });

    // Stripe alternate rows
    const rowIndex = row.number;
    if (rowIndex % 2 === 0) {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (!cell.fill || (cell.fill as ExcelJS.FillPattern).fgColor?.argb === `FF${THEME.headerBg}`) return;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: hex("F5F5FC") };
      });
    }
  }

  // Conditional formatting — Fit Category column (column 6 = index F)
  const fitColLetter = "F";
  const lastDataRow = reports.length + 1;

  const fitRules: Array<{ value: string; fontColor: string; bgColor: string }> = [
    { value: "strong",   fontColor: THEME.strong,   bgColor: THEME.strongBg },
    { value: "moderate", fontColor: THEME.moderate,  bgColor: THEME.moderateBg },
    { value: "weak",     fontColor: THEME.weak,      bgColor: THEME.weakBg },
    { value: "avoid",    fontColor: THEME.avoid,     bgColor: THEME.avoidBg },
  ];

  for (let ri = 0; ri < fitRules.length; ri++) {
    const rule = fitRules[ri];
    ws.addConditionalFormatting({
      ref: `${fitColLetter}2:${fitColLetter}${lastDataRow}`,
      rules: [
        {
          type: "containsText",
          operator: "containsText",
          text: rule.value,
          priority: ri + 1,
          style: {
            font: { bold: true, color: hex(rule.fontColor) },
            fill: { type: "pattern", pattern: "solid", fgColor: hex(rule.bgColor) },
          },
        },
      ],
    });
  }

  // Also directly color existing cells for immediate visibility (conditional formatting
  // previews inconsistently in some readers)
  const fitColIdx = COLUMNS.findIndex((c) => c.key === "fitCategory") + 1;
  for (let i = 2; i <= lastDataRow; i++) {
    const cell = ws.getCell(i, fitColIdx);
    const val = String(cell.value ?? "").toLowerCase();
    const rule = fitRules.find((r) => r.value === val);
    if (rule) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: hex(rule.bgColor) };
      cell.font = { bold: true, color: hex(rule.fontColor), size: 10, name: "Calibri" };
      cell.alignment = { horizontal: "center", vertical: "top" };
    }
  }

  // ── Sheet 2: Summary ─────────────────────────────────────────────────────
  const summary = wb.addWorksheet("Summary", {
    properties: { defaultRowHeight: 20 },
  });

  summary.columns = [
    { key: "metric", width: 36 },
    { key: "value",  width: 20 },
  ];

  const addSummaryHeader = (text: string) => {
    const r = summary.addRow({ metric: text, value: "" });
    r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: hex(THEME.summaryHeaderBg) };
    r.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: hex(THEME.summaryHeaderBg) };
    r.getCell(1).font = { bold: true, color: hex(THEME.accentGreen), size: 11, name: "Calibri" };
    r.getCell(2).font = { bold: true, color: hex(THEME.accentGreen), size: 11, name: "Calibri" };
    r.height = 26;
  };

  const addSummaryRow = (metric: string, value: string | number) => {
    const r = summary.addRow({ metric, value });
    r.getCell(1).font = { size: 10, name: "Calibri", color: hex("333355") };
    r.getCell(2).font = { bold: true, size: 11, name: "Calibri", color: hex("1A1A3A") };
    r.getCell(2).alignment = { horizontal: "left" };
    r.height = 20;
  };

  const addBlank = () => summary.addRow({});

  // Overview stats
  addSummaryHeader("OVERVIEW");
  addSummaryRow("Total Leads", reports.length);
  addSummaryRow("Export Date", new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }));

  const withScore = reports.filter((r) => r.varFitScore?.overallScore !== undefined);
  const avgOverall = withScore.length
    ? Math.round((withScore.reduce((s, r) => s + (r.varFitScore!.overallScore), 0) / withScore.length) * 10) / 10
    : "—";
  const withRel = reports.filter((r) => r.relevanceScore !== undefined);
  const avgRel = withRel.length
    ? Math.round((withRel.reduce((s, r) => s + r.relevanceScore!, 0) / withRel.length) * 10) / 10
    : "—";
  const withConf = reports.filter((r) => r.confidenceScore !== undefined);
  const avgConf = withConf.length
    ? Math.round((withConf.reduce((s, r) => s + r.confidenceScore!, 0) / withConf.length) * 10) / 10
    : "—";

  addSummaryRow("Avg Overall Score", avgOverall);
  addSummaryRow("Avg Relevance Score", avgRel);
  addSummaryRow("Avg Confidence Score", avgConf);

  addBlank();

  // Fit category breakdown
  addSummaryHeader("FIT CATEGORY BREAKDOWN");
  const categories = ["strong", "moderate", "weak", "avoid"] as const;
  for (const cat of categories) {
    const count = reports.filter((r) => r.varFitScore?.fitCategory === cat).length;
    const pct = reports.length > 0 ? Math.round((count / reports.length) * 100) : 0;
    const row = summary.addRow({ metric: cat.charAt(0).toUpperCase() + cat.slice(1), value: `${count} (${pct}%)` });
    row.getCell(1).font = { size: 10, name: "Calibri" };
    const colorMap: Record<string, string> = { strong: THEME.strong, moderate: THEME.moderate, weak: THEME.weak, avoid: THEME.avoid };
    row.getCell(1).font = { bold: true, color: hex(colorMap[cat]), size: 10, name: "Calibri" };
    row.getCell(2).font = { size: 10, name: "Calibri" };
    row.height = 20;
  }

  addBlank();

  // Top 5 by overall score
  addSummaryHeader("TOP 5 LEADS BY OVERALL SCORE");
  const top5 = [...reports]
    .filter((r) => r.varFitScore?.overallScore !== undefined)
    .sort((a, b) => (b.varFitScore!.overallScore) - (a.varFitScore!.overallScore))
    .slice(0, 5);

  for (let i = 0; i < top5.length; i++) {
    const r = top5[i];
    const row = summary.addRow({
      metric: `${i + 1}. ${r.companyName}`,
      value: `${r.varFitScore!.overallScore}/10 · ${r.varFitScore!.fitCategory}`,
    });
    row.getCell(1).font = { bold: true, size: 10, name: "Calibri" };
    row.getCell(2).font = { size: 10, name: "Calibri" };
    row.height = 20;
  }

  // Style all summary cells with a border
  summary.eachRow((row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (!cell.border) {
        cell.border = { bottom: { style: "hair", color: hex(THEME.border) } };
      }
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ─── ROUTE ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sessionId = extractSessionId(req);
  try {
    const reports = await runWithSession(sessionId, () => getReports());
    if (reports.length === 0) {
      return NextResponse.json({ error: "No reports to export" }, { status: 404 });
    }

    const buffer = await buildWorkbook(reports);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Cloudbox-VAR-Leads-${dateStr}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
