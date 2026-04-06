// src/app/api/export/pdf/route.ts — Generate and return a PDF for a single VAR report

import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getReports, ReportEntry } from "@/lib/store";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────

const C = {
  headerBg:    "#0d0d1a",
  footerBg:    "#0d0d1a",
  accentGreen: "#00cc66",
  accentPurple:"#7c3aed",
  text:        "#1a1a2e",
  muted:       "#666680",
  subtle:      "#999aaa",
  border:      "#dddded",
  surface:     "#f7f7fc",
  surfaceAlt:  "#f0f0f8",
  strong:      "#00aa55",
  moderate:    "#cc8800",
  weak:        "#cc5500",
  avoid:       "#cc2222",
  pitchBg:     "#f4fff9",
  briefingBg:  "#f5f0ff",
};

const FONT = {
  reg:    "Helvetica",
  bold:   "Helvetica-Bold",
  italic: "Helvetica-Oblique",
  boldIt: "Helvetica-BoldOblique",
} as const;

function fitColor(cat: string | undefined): string {
  if (cat === "strong")   return C.strong;
  if (cat === "moderate") return C.moderate;
  if (cat === "weak")     return C.weak;
  if (cat === "avoid")    return C.avoid;
  return C.muted;
}

// ─── LAYOUT CONSTANTS ─────────────────────────────────────────────────────────

const PAGE_W   = 612; // Letter
const PAGE_H   = 792;
const MARGIN   = 56;
const CONTENT  = PAGE_W - MARGIN * 2;
const HEADER_H = 64;
const FOOTER_H = 36;

// ─── DRAWING PRIMITIVES ───────────────────────────────────────────────────────

type Doc = InstanceType<typeof PDFDocument>;

function hline(doc: Doc, y?: number, color = C.border) {
  const yy = y ?? doc.y;
  doc.moveTo(MARGIN, yy).lineTo(MARGIN + CONTENT, yy)
    .lineWidth(0.5).strokeColor(color).stroke();
}

function labelTag(doc: Doc, text: string, x: number, y: number, bgColor: string, fgColor: string) {
  const pad = 6;
  doc.font(FONT.bold).fontSize(8);
  const tw = doc.widthOfString(text);
  const w = tw + pad * 2;
  const h = 15;
  doc.roundedRect(x, y, w, h, 3).fill(bgColor);
  doc.fillColor(fgColor).text(text, x + pad, y + 3, { lineBreak: false });
  return w;
}

function accentBar(doc: Doc, y: number, h: number, color: string) {
  doc.rect(MARGIN, y, 3, h).fill(color);
}

function sectionLabel(doc: Doc, text: string) {
  doc.moveDown(0.1);
  const y = doc.y;
  doc.font(FONT.bold).fontSize(8).fillColor(C.muted)
    .text(text, MARGIN, y, { characterSpacing: 1.2, width: CONTENT });
  doc.y = y + 14;
  hline(doc, doc.y);
  doc.y += 10;
}

// ─── CONTENT BLOCKS ──────────────────────────────────────────────────────────

function drawBriefingBlock(doc: Doc, text: string) {
  const startY = doc.y;
  // Measure text height first
  doc.font(FONT.reg).fontSize(10);
  const textH = doc.heightOfString(text, { width: CONTENT - 20 });
  const blockH = textH + 30;

  doc.rect(MARGIN, startY, CONTENT, blockH).fill(C.briefingBg);
  accentBar(doc, startY, blockH, C.accentPurple);

  doc.font(FONT.bold).fontSize(8).fillColor(C.accentPurple)
    .text("CONTEXT BRIEFING", MARGIN + 12, startY + 8, { characterSpacing: 1 });

  doc.font(FONT.reg).fontSize(10).fillColor(C.text)
    .text(text, MARGIN + 12, startY + 22, { width: CONTENT - 20, lineGap: 2 });

  doc.y = startY + blockH + 16;
}

function drawHookBlock(doc: Doc, text: string) {
  const startY = doc.y;
  doc.font(FONT.reg).fontSize(10);
  const textH = doc.heightOfString(text, { width: CONTENT - 20 });
  const blockH = textH + 30;

  doc.rect(MARGIN, startY, CONTENT, blockH).fill(C.pitchBg);
  accentBar(doc, startY, blockH, C.accentGreen);

  doc.font(FONT.bold).fontSize(8).fillColor(C.accentGreen)
    .text("HOOK ANGLE", MARGIN + 12, startY + 8, { characterSpacing: 1 });

  doc.font(FONT.reg).fontSize(10).fillColor(C.text)
    .text(text, MARGIN + 12, startY + 22, { width: CONTENT - 20, lineGap: 2 });

  doc.y = startY + blockH + 16;
}

function drawPitchVariant(doc: Doc, label: string, text: string) {
  const startY = doc.y;
  doc.font(FONT.reg).fontSize(10);
  const textH = doc.heightOfString(text, { width: CONTENT - 24 });
  const blockH = textH + 42;

  doc.rect(MARGIN, startY, CONTENT, blockH).fill(C.surface);
  doc.rect(MARGIN, startY, CONTENT, 22).fill(C.surfaceAlt);

  doc.font(FONT.bold).fontSize(8.5).fillColor(C.accentGreen)
    .text(label, MARGIN + 12, startY + 7, { characterSpacing: 0.8 });

  doc.font(FONT.reg).fontSize(10).fillColor(C.text)
    .text(text, MARGIN + 12, startY + 28, { width: CONTENT - 24, lineGap: 2.5 });

  doc.y = startY + blockH + 10;
}

function drawFitColumns(doc: Doc, report: ReportEntry) {
  const reasons = report.varFitScore?.fitReasons ?? [];
  const flags   = report.varFitScore?.redFlags   ?? [];
  const halfW   = (CONTENT - 24) / 2;
  const startY  = doc.y;

  // Left: why it fits
  let ly = startY;
  doc.font(FONT.bold).fontSize(8).fillColor(C.strong).text("WHY IT FITS", MARGIN, ly, { characterSpacing: 0.8 });
  ly += 14;
  for (const r of reasons) {
    doc.font(FONT.reg).fontSize(9.5).fillColor(C.text)
      .text(`• ${r}`, MARGIN, ly, { width: halfW, lineGap: 1.5 });
    ly = doc.y + 3;
  }
  if (report.varFitScore?.strategicNotes) {
    doc.font(FONT.italic).fontSize(9).fillColor(C.muted)
      .text(report.varFitScore.strategicNotes, MARGIN, ly + 4, { width: halfW });
    ly = doc.y;
  }

  // Right: red flags
  if (flags.length > 0) {
    const rx = MARGIN + halfW + 24;
    let ry = startY;
    doc.font(FONT.bold).fontSize(8).fillColor(C.moderate).text("RED FLAGS", rx, ry, { characterSpacing: 0.8 });
    ry += 14;
    for (const f of flags) {
      doc.font(FONT.reg).fontSize(9.5).fillColor(C.text)
        .text(`• ${f}`, rx, ry, { width: halfW, lineGap: 1.5 });
      ry = doc.y + 3;
    }
    doc.y = Math.max(ly, ry);
  } else {
    doc.y = ly;
  }

  doc.y += 8;
}

function drawMetaRow(doc: Doc, report: ReportEntry) {
  const items: Array<{ label: string; value: string }> = [];
  if (report.varFitScore?.deploymentEase)   items.push({ label: "DEPLOYMENT", value: report.varFitScore.deploymentEase.toUpperCase() });
  if (report.varFitScore?.estimatedDealSize) items.push({ label: "DEAL SIZE",  value: report.varFitScore.estimatedDealSize.toUpperCase() });
  if (report.pitchContext?.toneRecommendation) items.push({ label: "TONE",     value: report.pitchContext.toneRecommendation.toUpperCase() });
  if (report.relevanceScore !== undefined)  items.push({ label: "RELEVANCE",  value: `${report.relevanceScore}/10` });
  if (report.confidenceScore !== undefined) items.push({ label: "CONFIDENCE", value: `${report.confidenceScore}/10` });

  let x = MARGIN;
  const y = doc.y;
  for (const item of items) {
    doc.font(FONT.reg).fontSize(9);
    const valW = doc.widthOfString(item.value);
    const colW = doc.widthOfString(item.label) + valW + 24;

    doc.font(FONT.bold).fontSize(7.5).fillColor(C.muted)
      .text(item.label, x, y, { lineBreak: false });
    doc.font(FONT.bold).fontSize(9.5).fillColor(C.text)
      .text(item.value, x, y + 10, { lineBreak: false });
    x += colW;
  }
  doc.y = y + 26;
}

// ─── HEADER & FOOTER ──────────────────────────────────────────────────────────

function drawPageHeader(doc: Doc) {
  doc.rect(0, 0, PAGE_W, HEADER_H).fill(C.headerBg);
  doc.font(FONT.bold).fontSize(15).fillColor("#ffffff")
    .text("CLOUDBOX ", MARGIN, 20, { continued: true })
    .fillColor(C.accentGreen).text("VAR HUNTER", { continued: false });
  doc.font(FONT.reg).fontSize(8.5).fillColor("#8888aa")
    .text("Intelligence Report  ·  cloudboxapp.com", MARGIN, 41);
}

function drawPageFooter(doc: Doc) {
  doc.rect(0, PAGE_H - FOOTER_H, PAGE_W, FOOTER_H).fill(C.footerBg);
  doc.font(FONT.reg).fontSize(8).fillColor("#8888aa")
    .text(
      `Generated by Cloudbox VAR Hunter  ·  ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
      MARGIN, PAGE_H - 22,
      { width: CONTENT, align: "center" }
    );
}

// ─── MAIN BUILDER ────────────────────────────────────────────────────────────

function buildPDF(report: ReportEntry): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: HEADER_H + 18, bottom: FOOTER_H + 18, left: MARGIN, right: MARGIN },
      autoFirstPage: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    // Draw first-page header immediately
    drawPageHeader(doc);

    const fc = report.varFitScore?.fitCategory;
    const fcolor = fitColor(fc);

    // ── Company title + fit badges ──────────────────────────────────────────
    doc.font(FONT.bold).fontSize(26).fillColor(C.text)
      .text(report.companyName, MARGIN, doc.y);

    doc.moveDown(0.35);

    // Score + fit badges
    let bx = MARGIN;
    const by = doc.y;
    if (fc) {
      bx += labelTag(doc, `${fc.toUpperCase()} FIT`, bx, by, `${fcolor}18`, fcolor) + 6;
    }
    if (report.varFitScore?.overallScore !== undefined) {
      bx += labelTag(doc, `${report.varFitScore.overallScore}/10`, bx, by, `${fcolor}12`, fcolor) + 6;
    }
    doc.y = by + 20;

    // Meta row (deployment, deal size, tone, scores)
    doc.y += 8;
    drawMetaRow(doc, report);

    doc.font(FONT.reg).fontSize(8.5).fillColor(C.muted)
      .text(`Detected ${new Date(report.timestamp).toLocaleString()}`, MARGIN);

    doc.y += 16;
    hline(doc);
    doc.y += 16;

    // ── Context briefing ───────────────────────────────────────────────────
    if (report.briefing) {
      drawBriefingBlock(doc, report.briefing);
    }

    // ── Decision maker ─────────────────────────────────────────────────────
    sectionLabel(doc, "KEY DECISION MAKER");

    const halfW = (CONTENT - 20) / 2;
    const dmStartY = doc.y;

    // Left col
    doc.font(FONT.bold).fontSize(8).fillColor(C.muted).text("NAME", MARGIN, dmStartY);
    doc.font(FONT.bold).fontSize(11).fillColor(C.text).text(report.decisionMaker, MARGIN, doc.y);
    doc.font(FONT.bold).fontSize(8).fillColor(C.muted).text("TITLE", MARGIN, doc.y + 6);
    doc.font(FONT.reg).fontSize(10).fillColor(C.text).text(report.title, MARGIN, doc.y + 2, { width: halfW });
    const lEnd = doc.y;

    // Right col
    let ry = dmStartY;
    if (report.companyWebsite) {
      doc.font(FONT.bold).fontSize(8).fillColor(C.muted).text("WEBSITE", MARGIN + halfW + 20, ry);
      ry = doc.y;
      doc.font(FONT.reg).fontSize(10).fillColor(C.text).text(report.companyWebsite, MARGIN + halfW + 20, ry, { width: halfW });
      ry = doc.y + 4;
    }
    if (report.linkedinUrl) {
      doc.font(FONT.bold).fontSize(8).fillColor(C.muted).text("LINKEDIN", MARGIN + halfW + 20, ry);
      ry = doc.y;
      doc.font(FONT.reg).fontSize(9).fillColor("#0a66c2").text(report.linkedinUrl, MARGIN + halfW + 20, ry, {
        width: halfW,
        link: report.linkedinUrl,
        underline: true,
      });
    }

    doc.y = Math.max(lEnd, doc.y) + 16;
    hline(doc);
    doc.y += 16;

    // ── Fit assessment ─────────────────────────────────────────────────────
    if (report.varFitScore) {
      sectionLabel(doc, "FIT ASSESSMENT");
      drawFitColumns(doc, report);
      hline(doc);
      doc.y += 16;
    }

    // ── Company + person profiles ──────────────────────────────────────────
    sectionLabel(doc, "COMPANY PROFILE");
    doc.font(FONT.reg).fontSize(10).fillColor(C.text)
      .text(report.companyProfile, MARGIN, doc.y, { width: CONTENT, lineGap: 2.5 });
    doc.y += 14;

    sectionLabel(doc, "PERSON CONTEXT");
    doc.font(FONT.reg).fontSize(10).fillColor(C.text)
      .text(report.personProfile, MARGIN, doc.y, { width: CONTENT, lineGap: 2.5 });
    doc.y += 14;

    hline(doc);
    doc.y += 16;

    // ── Hook angle ─────────────────────────────────────────────────────────
    if (report.pitchContext?.hookAngle) {
      drawHookBlock(doc, report.pitchContext.hookAngle);
    }

    // ── Pitch variants ─────────────────────────────────────────────────────
    sectionLabel(doc, "PERSONALIZED PITCHES");

    const pitches: Array<{ label: string; text: string }> = [];
    if (report.pitchVariants) {
      if (report.pitchVariants.cold_email)       pitches.push({ label: "COLD EMAIL",       text: report.pitchVariants.cold_email });
      if (report.pitchVariants.linkedin_message) pitches.push({ label: "LINKEDIN MESSAGE", text: report.pitchVariants.linkedin_message });
      if (report.pitchVariants.followup_email)   pitches.push({ label: "FOLLOW-UP EMAIL",  text: report.pitchVariants.followup_email });
      if (report.pitchVariants.text_message)     pitches.push({ label: "TEXT MESSAGE",     text: report.pitchVariants.text_message });
      if (report.pitchVariants.executive_brief)  pitches.push({ label: "EXECUTIVE BRIEF",  text: report.pitchVariants.executive_brief });
    } else if (report.pitch) {
      pitches.push({ label: "PITCH", text: report.pitch });
    }

    for (const p of pitches) {
      drawPitchVariant(doc, p.label, p.text);
    }

    hline(doc);
    doc.y += 14;

    // ── News trigger ───────────────────────────────────────────────────────
    sectionLabel(doc, "NEWS TRIGGER");
    doc.font(FONT.bold).fontSize(10.5).fillColor(C.text)
      .text(report.newsTitle, MARGIN, doc.y, { width: CONTENT });
    doc.moveDown(0.3);
    doc.font(FONT.bold).fontSize(8.5).fillColor(C.muted).text("Source:", MARGIN, doc.y);
    doc.font(FONT.reg).fontSize(8.5).fillColor("#0a66c2")
      .text(report.newsSource, MARGIN, doc.y, { width: CONTENT, link: report.newsSource, underline: true });

    // Footer on last page
    drawPageFooter(doc);

    doc.end();
  });
}

// ─── ROUTE ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing report id" }, { status: 400 });

    const report = getReports().find((r) => r.id === id);
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    const buffer = await buildPDF(report);
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeName = report.companyName.replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-");
    const filename = `VAR-${safeName}-${dateStr}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
