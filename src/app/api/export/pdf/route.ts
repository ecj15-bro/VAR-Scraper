// src/app/api/export/pdf/route.ts
//
// Two-pass PDF renderer with full orphan prevention.
//
// Architecture:
//   Pass 1 (dry run)  — renders into a throwaway buffer, counts pageAdded events
//                       → gives totalPages
//   Pass 2 (real run) — same render logic, writes correct "Page X of Y" footer
//
// Page-break safety:
//   • Every section checks SECTION_GUARD (120px) before starting
//   • Short "keep-together" blocks measure total height first
//   • Long text (profiles, pitches) lets pdfkit auto-paginate after securing
//     at least the header + 2 lines on the current page
//   • pageAdded handler uses zero-margin mode so footer text never triggers
//     a recursive page break

import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getReports, ReportEntry } from "@/lib/store";
import { getBrandConfig } from "@/lib/brand";
import { extractSessionId, runWithSession } from "@/lib/session";

// ─── PAGE GEOMETRY ────────────────────────────────────────────────────────────

const PAGE_W     = 612;   // US Letter
const PAGE_H     = 792;
const ML         = 48;    // left margin
const MR         = 48;    // right margin
const CW         = PAGE_W - ML - MR;  // 516 — usable content width
const HEADER_H   = 54;
const FOOTER_H   = 30;
const CONTENT_TOP    = HEADER_H + 14;     // y=68  — where body starts
const CONTENT_BOT    = PAGE_H - FOOTER_H - 14;  // y=748 — where body ends
const SECTION_GUARD  = 120;  // min remaining space before starting any section

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────

const BG_DARK    = "#0a0a0f";
const GREEN      = "#00ff88";
const AMBER      = "#ffaa00";
const ORANGE_FIT = "#ff8800";
const RED_FIT    = "#ff4444";
const BODY      = "#111111";
const MUTED     = "#555566";
const SUBTLE    = "#999aaa";
const DIVIDER   = "#eeeeee";
const SURFACE   = "#f8f9fc";
const BRIEF_BG  = "#f5f0ff";
const HOOK_BG   = "#f0fff8";
const BRIEF_ACC = "#7c3aed";

function fitColor(cat?: string): string {
  if (cat === "strong")   return GREEN;
  if (cat === "moderate") return AMBER;
  if (cat === "weak")     return ORANGE_FIT;
  if (cat === "avoid")    return RED_FIT;
  return MUTED;
}

// ─── FONTS ───────────────────────────────────────────────────────────────────

const F = {
  reg:  "Helvetica",
  bold: "Helvetica-Bold",
  it:   "Helvetica-Oblique",
} as const;

// ─── DOC TYPE ────────────────────────────────────────────────────────────────

type Doc = InstanceType<typeof PDFDocument>;

// ─── CHROME: HEADER + FOOTER PER PAGE ────────────────────────────────────────
//
// IMPORTANT: called from inside pageAdded handler — must use zero-margin mode
// to prevent footer text at PAGE_H-18 from triggering another page break.

interface ChromeOptions {
  companyName: string;
  accentColor: string;
  logoDataUrl?: string;
  websiteLabel?: string;
}

function drawChrome(doc: Doc, pageNum: number, totalPages: number, opts: ChromeOptions) {
  const saved = { ...doc.page.margins };
  doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };

  const accent = opts.accentColor || GREEN;

  // ── Header bar ──
  doc.rect(0, 0, PAGE_W, HEADER_H).fill(BG_DARK);

  let headerTextX = ML;

  // Logo (if available)
  if (opts.logoDataUrl) {
    try {
      const base64Data = opts.logoDataUrl.includes(",")
        ? opts.logoDataUrl.split(",")[1]
        : opts.logoDataUrl;
      const logoBuffer = Buffer.from(base64Data, "base64");
      const logoSize = 32;
      doc.image(logoBuffer, ML, (HEADER_H - logoSize) / 2, {
        fit: [logoSize, logoSize],
      });
      headerTextX = ML + logoSize + 10;
    } catch {
      // Logo decode failed — fall through to text-only header
    }
  }

  // Company name split at last space for accent colouring
  const name = (opts.companyName || "VAR HUNTER").toUpperCase();
  const parts = name.lastIndexOf(" ") > 0
    ? [name.slice(0, name.lastIndexOf(" ")), name.slice(name.lastIndexOf(" ") + 1)]
    : [name, ""];

  doc.font(F.bold).fontSize(11).fillColor("#ffffff")
     .text(parts[0] + (parts[1] ? " " : ""), headerTextX, 18, { lineBreak: false });

  if (parts[1]) {
    const off = headerTextX + doc.widthOfString(parts[0] + " ");
    doc.font(F.bold).fontSize(11).fillColor(accent)
       .text(parts[1], off, 18, { lineBreak: false });
  }

  const subLabel = opts.websiteLabel
    ? `Intelligence Report  ·  ${opts.websiteLabel}`
    : "Intelligence Report";
  doc.font(F.reg).fontSize(7.5).fillColor(SUBTLE)
     .text(subLabel, headerTextX, 35, { lineBreak: false });

  // ── Footer bar ──
  const fy = PAGE_H - FOOTER_H;
  doc.rect(0, fy, PAGE_W, FOOTER_H).fill(BG_DARK);

  const footerLabel = opts.websiteLabel
    ? `${opts.companyName} VAR Hunter  ·  ${opts.websiteLabel}`
    : `${opts.companyName} VAR Hunter`;
  doc.font(F.reg).fontSize(7.5).fillColor(SUBTLE)
     .text(footerLabel, ML, fy + 10, { lineBreak: false });

  const pageLabel = totalPages > 0
    ? `Page ${pageNum} of ${totalPages}`
    : `Page ${pageNum}`;
  doc.font(F.reg).fontSize(7.5).fillColor("#ffffff")
     .text(pageLabel, ML, fy + 10, { width: CW, align: "right", lineBreak: false });

  doc.page.margins = saved;
  doc.x = ML;
  doc.y = CONTENT_TOP;
}

// ─── LAYOUT ENGINE ───────────────────────────────────────────────────────────
//
// Wraps a PDFDocument instance and provides:
//   • Manual Y tracking (this.y) — always authoritative
//   • ensureSpace(n)  — adds a page if fewer than n points remain
//   • divider()       — thin horizontal rule + gap
//   • sectionHeader() — label + accent bar, with orphan guard
//   • Various block drawers that measure before committing

class Layout {
  doc:        Doc;
  y:          number = CONTENT_TOP;
  pageNum:    number = 1;
  totalPages: number;
  chromeOpts: ChromeOptions;

  constructor(doc: Doc, totalPages: number, chromeOpts: ChromeOptions) {
    this.doc        = doc;
    this.totalPages = totalPages;
    this.chromeOpts = chromeOpts;

    // Hook into auto-pagination (pdfkit-initiated page breaks mid-text-flow)
    doc.on("pageAdded", () => {
      this.pageNum++;
      drawChrome(doc, this.pageNum, this.totalPages, this.chromeOpts);
      // doc.y is reset to margins.top by pdfkit after pageAdded; our tracking
      // is synced below via sync() after every doc.text() call.
    });

    // Draw first page chrome
    drawChrome(doc, 1, this.totalPages, this.chromeOpts);
  }

  // Sync our Y tracker from pdfkit's cursor (call after any doc.text())
  sync() {
    this.y = this.doc.y;
  }

  // Add a new page explicitly (for our own break decisions, not pdfkit auto)
  newPage() {
    this.doc.addPage();
    // pageAdded listener fires, increments pageNum, draws chrome, resets cursor
    this.y = CONTENT_TOP;
  }

  // Ensure at least `needed` points remain before rendering a block.
  // If not, start a new page.
  ensureSpace(needed: number) {
    if (this.y + needed > CONTENT_BOT) {
      this.newPage();
    }
  }

  // Measure text height without drawing anything
  measure(text: string, width: number, fontSize: number, lineGap = 2): number {
    this.doc.font(F.reg).fontSize(fontSize);
    return this.doc.heightOfString(text, { width, lineGap });
  }

  measureBold(text: string, width: number, fontSize: number, lineGap = 2): number {
    this.doc.font(F.bold).fontSize(fontSize);
    return this.doc.heightOfString(text, { width, lineGap });
  }

  // Thin divider line + vertical gap
  divider(gapBefore = 14, gapAfter = 14) {
    this.y += gapBefore;
    this.doc.moveTo(ML, this.y)
      .lineTo(ML + CW, this.y)
      .lineWidth(0.5)
      .strokeColor(DIVIDER)
      .stroke();
    this.y += gapAfter;
  }

  // Section header: accent bar + small bold uppercase label.
  // Guards: requires SECTION_GUARD remaining space (120px) OR the passed minContent.
  // This ensures the header + at least the first chunk of content always stay together.
  sectionHeader(label: string, minContentAfter = 40) {
    const LABEL_H = 20;
    this.ensureSpace(Math.max(LABEL_H + minContentAfter, SECTION_GUARD));

    // Accent bar — uses brand accent color
    const accent = this.chromeOpts.accentColor || GREEN;
    this.doc.rect(ML, this.y, 3, 13).fill(accent);

    // Label text
    this.doc.font(F.bold).fontSize(8)
       .fillColor(MUTED)
       .text(label, ML + 10, this.y + 2, { characterSpacing: 1, lineBreak: false });

    this.y += LABEL_H;
  }

  // Draw a thin label + value pair
  factRow(label: string, value: string, x = ML, width = CW) {
    this.doc.font(F.bold).fontSize(7.5).fillColor(MUTED)
       .text(label, x, this.y, { lineBreak: false });
    this.y += 11;
    this.doc.font(F.reg).fontSize(10).fillColor(BODY)
       .text(value, x, this.y, { width, lineBreak: false });
    this.sync();
    this.y += 4;
  }

  // Short text block — keep on one page if possible
  shortText(
    text: string,
    opts: { fontSize?: number; color?: string; width?: number; bold?: boolean; lineGap?: number }
  ) {
    const fs   = opts.fontSize ?? 10;
    const clr  = opts.color ?? BODY;
    const w    = opts.width ?? CW;
    const lg   = opts.lineGap ?? 2;
    const font = opts.bold ? F.bold : F.reg;

    const h = this.measure(text, w, fs, lg);
    this.ensureSpace(h);

    this.doc.font(font).fontSize(fs).fillColor(clr)
       .text(text, ML, this.y, { width: w, lineGap: lg });
    this.sync();
    this.y += 4;
  }

  // Long text block — may auto-paginate across multiple pages.
  // Before starting, ensures at least `guardLines` lines (≈ guardLines × 16px)
  // remain so the section header is never the last thing on a page.
  longText(
    text: string,
    opts: { fontSize?: number; color?: string; width?: number; lineGap?: number; guardLines?: number }
  ) {
    const fs  = opts.fontSize  ?? 10;
    const clr = opts.color     ?? BODY;
    const w   = opts.width     ?? CW;
    const lg  = opts.lineGap   ?? 2;
    const gl  = opts.guardLines ?? 2;

    this.ensureSpace(gl * (fs + lg + 4));

    this.doc.font(F.reg).fontSize(fs).fillColor(clr)
       .text(text, ML, this.y, { width: w, lineGap: lg });
    this.sync();
    this.y += 4;
  }
}

// ─── SECTION RENDERERS ───────────────────────────────────────────────────────

function renderTitleBlock(l: Layout, report: ReportEntry) {
  const fc     = report.varFitScore?.fitCategory;
  const fcolor = fitColor(fc);

  // Company name — large title
  l.doc.font(F.bold).fontSize(22).fillColor(BODY)
     .text(report.companyName, ML, l.y, { width: CW });
  l.sync();
  l.y += 8;

  // Badge row — all on one horizontal line
  // Badges: FIT CATEGORY · SCORE · RELEVANCE · CONFIDENCE
  const badges: Array<{ text: string; bg: string; fg: string }> = [];
  if (fc) {
    const bg = fcolor + "22";
    badges.push({ text: `${fc.toUpperCase()} FIT`, bg, fg: fcolor });
  }
  if (report.varFitScore?.overallScore !== undefined) {
    badges.push({ text: `${report.varFitScore.overallScore}/10`, bg: fcolor + "14", fg: fcolor });
  }
  if (report.relevanceScore !== undefined) {
    badges.push({ text: `RELEVANCE ${report.relevanceScore}/10`, bg: GREEN + "14", fg: GREEN });
  }
  if (report.confidenceScore !== undefined) {
    badges.push({ text: `CONFIDENCE ${report.confidenceScore}/10`, bg: BRIEF_ACC + "22", fg: BRIEF_ACC });
  }

  if (badges.length > 0) {
    const BADGE_H = 16;
    const BADGE_PAD = 7;
    const BADGE_GAP = 6;
    const RADIUS = 4;

    l.doc.font(F.bold).fontSize(8);
    let bx = ML;
    for (const b of badges) {
      const tw = l.doc.widthOfString(b.text);
      const bw = tw + BADGE_PAD * 2;
      l.doc.roundedRect(bx, l.y, bw, BADGE_H, RADIUS).fill(b.bg);
      l.doc.fillColor(b.fg).text(b.text, bx + BADGE_PAD, l.y + 3.5, { lineBreak: false });
      bx += bw + BADGE_GAP;
    }
    l.y += BADGE_H + 8;
  }

  // Meta row: deployment · deal size · tone
  const metas: Array<[string, string]> = [];
  if (report.varFitScore?.deploymentEase)    metas.push(["DEPLOYMENT", report.varFitScore.deploymentEase.toUpperCase()]);
  if (report.varFitScore?.estimatedDealSize) metas.push(["DEAL SIZE",  report.varFitScore.estimatedDealSize.toUpperCase()]);
  if (report.pitchContext?.toneRecommendation) metas.push(["TONE",     report.pitchContext.toneRecommendation.toUpperCase()]);

  if (metas.length > 0) {
    let mx = ML;
    const my = l.y;
    l.doc.font(F.bold).fontSize(7.5);
    for (const [label, val] of metas) {
      const lw = l.doc.widthOfString(label);
      const vw = l.doc.widthOfString(val);
      const colW = Math.max(lw, vw) + 20;
      l.doc.fillColor(MUTED).text(label, mx, my, { lineBreak: false });
      l.doc.font(F.bold).fontSize(10).fillColor(BODY)
         .text(val, mx, my + 11, { lineBreak: false });
      mx += colW;
    }
    l.y = my + 26;
  }

  // Timestamp
  l.doc.font(F.reg).fontSize(8).fillColor(SUBTLE)
     .text(`Detected ${new Date(report.timestamp).toLocaleString()}`, ML, l.y, { lineBreak: false });
  l.y += 16;
}

function renderBriefingBlock(l: Layout, text: string) {
  const innerW = CW - 20;
  const textH  = l.measure(text, innerW, 10, 2);
  const blockH = textH + 30;

  // Keep together if it fits; otherwise start new page
  l.ensureSpace(Math.min(blockH + 8, CONTENT_BOT - CONTENT_TOP));

  const sy = l.y;
  l.doc.rect(ML, sy, CW, blockH).fill(BRIEF_BG);
  l.doc.rect(ML, sy, 3, blockH).fill(BRIEF_ACC);

  l.doc.font(F.bold).fontSize(8).fillColor(BRIEF_ACC)
     .text("CONTEXT BRIEFING", ML + 12, sy + 8, { characterSpacing: 1, lineBreak: false });

  l.doc.font(F.reg).fontSize(10).fillColor(BODY)
     .text(text, ML + 12, sy + 22, { width: innerW, lineGap: 2 });

  l.sync();
  l.y = Math.max(l.y, sy + blockH) + 12;
}

function renderDecisionMaker(l: Layout, report: ReportEntry) {
  l.sectionHeader("KEY DECISION MAKER", 80);

  const HALF = (CW - 20) / 2;
  const RX   = ML + HALF + 20;
  const sy   = l.y;

  // Left col: name + title
  l.doc.font(F.bold).fontSize(7.5).fillColor(MUTED).text("NAME", ML, sy, { lineBreak: false });
  l.doc.font(F.bold).fontSize(11).fillColor(BODY).text(report.decisionMaker, ML, sy + 11, { width: HALF });
  const afterName = l.doc.y;
  l.doc.font(F.bold).fontSize(7.5).fillColor(MUTED).text("TITLE", ML, afterName + 4, { lineBreak: false });
  l.doc.font(F.reg).fontSize(10).fillColor(BODY).text(report.title, ML, afterName + 15, { width: HALF });
  const leftEnd = l.doc.y + 4;

  // Right col: website + LinkedIn
  let ry = sy;
  if (report.companyWebsite) {
    l.doc.font(F.bold).fontSize(7.5).fillColor(MUTED).text("WEBSITE", RX, ry, { lineBreak: false });
    ry += 11;
    l.doc.font(F.reg).fontSize(9).fillColor(BODY).text(report.companyWebsite, RX, ry, { width: HALF });
    ry = l.doc.y + 4;
  }
  if (report.linkedinUrl) {
    l.doc.font(F.bold).fontSize(7.5).fillColor(MUTED).text("LINKEDIN", RX, ry, { lineBreak: false });
    ry += 11;
    l.doc.font(F.reg).fontSize(9).fillColor("#0a66c2")
       .text(report.linkedinUrl, RX, ry, { width: HALF, link: report.linkedinUrl, underline: true });
    ry = l.doc.y + 4;
  }

  l.y = Math.max(leftEnd, ry) + 4;
}

function renderFitAssessment(l: Layout, report: ReportEntry) {
  const reasons = report.varFitScore?.fitReasons ?? [];
  const flags   = report.varFitScore?.redFlags   ?? [];
  if (reasons.length === 0 && flags.length === 0) return;

  const accent = l.chromeOpts.accentColor || GREEN;

  l.sectionHeader("FIT ASSESSMENT");

  // WHY IT FITS
  if (reasons.length > 0) {
    l.ensureSpace(30);
    l.doc.rect(ML, l.y, 3, 13).fill(accent);
    l.doc.font(F.bold).fontSize(8).fillColor(GREEN)
       .text("WHY IT FITS", ML + 10, l.y + 2, { characterSpacing: 0.8, lineBreak: false });
    l.y += 18;
    for (const r of reasons) {
      l.doc.font(F.reg).fontSize(9.5).fillColor(BODY)
         .text(`• ${r}`, ML, l.y, { width: CW, lineGap: 1.5 });
      l.sync();
      l.y += 3;
    }
    if (report.varFitScore?.strategicNotes) {
      l.y += 4;
      l.doc.font(F.it).fontSize(9).fillColor(MUTED)
         .text(report.varFitScore.strategicNotes, ML, l.y, { width: CW, lineGap: 2 });
      l.sync();
    }
    l.y += 10;
  }

  // RED FLAGS
  if (flags.length > 0) {
    l.ensureSpace(30);
    l.doc.rect(ML, l.y, 3, 13).fill(AMBER);
    l.doc.font(F.bold).fontSize(8).fillColor(AMBER)
       .text("RED FLAGS", ML + 10, l.y + 2, { characterSpacing: 0.8, lineBreak: false });
    l.y += 18;
    for (const f of flags) {
      l.doc.font(F.reg).fontSize(9.5).fillColor(BODY)
         .text(`• ${f}`, ML, l.y, { width: CW, lineGap: 1.5 });
      l.sync();
      l.y += 3;
    }
    l.y += 4;
  }
}

function renderHookBlock(l: Layout, text: string) {
  const innerW = CW - 20;
  const textH  = l.measure(text, innerW, 10, 2);
  const blockH = textH + 30;

  l.ensureSpace(Math.min(blockH + 8, CONTENT_BOT - CONTENT_TOP));
  const sy = l.y;

  l.doc.rect(ML, sy, CW, blockH).fill(HOOK_BG);
  l.doc.rect(ML, sy, 3, blockH).fill(GREEN);

  l.doc.font(F.bold).fontSize(8).fillColor(GREEN)
     .text("HOOK ANGLE", ML + 12, sy + 8, { characterSpacing: 1, lineBreak: false });

  l.doc.font(F.reg).fontSize(10).fillColor(BODY)
     .text(text, ML + 12, sy + 22, { width: innerW, lineGap: 2 });

  l.sync();
  l.y = Math.max(l.y, sy + blockH) + 12;
}

function renderPitchVariant(l: Layout, label: string, text: string) {
  const LABEL_H  = 20;
  const TEXT_PAD = 12;
  const innerW   = CW - TEXT_PAD * 2;

  // Ensure label + at least 2 lines of pitch text stay together
  l.ensureSpace(LABEL_H + 34);

  const sy = l.y;
  // Label bar
  l.doc.rect(ML, sy, CW, LABEL_H).fill(SURFACE);
  l.doc.font(F.bold).fontSize(8.5).fillColor(GREEN)
     .text(label, ML + TEXT_PAD, sy + 6, { characterSpacing: 0.8, lineBreak: false });
  l.y = sy + LABEL_H + 6;

  // Body — may auto-paginate for long pitches
  l.doc.font(F.reg).fontSize(10).fillColor(BODY)
     .text(text, ML + TEXT_PAD, l.y, { width: innerW, lineGap: 2 });
  l.sync();
  l.y += 10;
}

function renderNewsTrigger(l: Layout, report: ReportEntry) {
  // Measure full block so we can keep it together
  const titleH  = l.measureBold(report.newsTitle, CW, 10.5);
  const sourceH = 14;
  const blockH  = 28 + titleH + sourceH + 8;  // section label + content

  l.ensureSpace(blockH);
  l.sectionHeader("NEWS TRIGGER", titleH + sourceH + 4);

  l.doc.font(F.bold).fontSize(10.5).fillColor(BODY)
     .text(report.newsTitle, ML, l.y, { width: CW });
  l.sync();
  l.y += 4;

  l.doc.font(F.bold).fontSize(8).fillColor(MUTED)
     .text("Source: ", ML, l.y, { lineBreak: false });
  const labelW = l.doc.widthOfString("Source: ");
  l.doc.font(F.reg).fontSize(8).fillColor("#0a66c2")
     .text(report.newsSource, ML + labelW, l.y, {
       width: CW - labelW,
       link: report.newsSource,
       underline: true,
       lineBreak: false,
     });
  l.y += 14;
}

// ─── FULL REPORT RENDER ───────────────────────────────────────────────────────

function renderReport(doc: Doc, report: ReportEntry, totalPages: number, chromeOpts: ChromeOptions) {
  const l = new Layout(doc, totalPages, chromeOpts);

  // 1. Title block (company name, badges, meta row, timestamp)
  renderTitleBlock(l, report);
  l.divider(8, 12);

  // 2. Context briefing
  if (report.briefing) {
    renderBriefingBlock(l, report.briefing);
    l.divider(4, 12);
  }

  // 3. Decision maker
  renderDecisionMaker(l, report);
  l.divider(12, 12);

  // 4. Fit assessment (two-column)
  if (report.varFitScore) {
    renderFitAssessment(l, report);
    l.divider(8, 12);
  }

  // 5. Company profile
  l.sectionHeader("COMPANY PROFILE", 40);
  l.longText(report.companyProfile, { guardLines: 3 });
  l.y += 4;

  // 6. Person context
  l.divider(4, 12);
  l.sectionHeader("PERSON CONTEXT", 40);
  l.longText(report.personProfile, { guardLines: 3 });
  l.y += 4;

  // 7. Hook angle
  if (report.pitchContext?.hookAngle) {
    l.divider(4, 12);
    renderHookBlock(l, report.pitchContext.hookAngle);
  }

  // 8. Pitch variants — each kept together (label + first lines)
  l.divider(4, 12);
  l.sectionHeader("PERSONALIZED PITCHES", 60);

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

  for (let i = 0; i < pitches.length; i++) {
    renderPitchVariant(l, pitches[i].label, pitches[i].text);
    if (i < pitches.length - 1) l.y += 4;
  }

  // 9. News trigger (kept together)
  l.divider(8, 12);
  renderNewsTrigger(l, report);
}

// ─── TWO-PASS BUILDER ────────────────────────────────────────────────────────

function makeDoc(): Doc {
  return new PDFDocument({
    size: "LETTER",
    margins: {
      top:    CONTENT_TOP,
      bottom: PAGE_H - CONTENT_BOT,
      left:   ML,
      right:  MR,
    },
    autoFirstPage: true,
    compress: false,
  });
}

async function collectBuffer(doc: Doc): Promise<Buffer> {
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  return new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
}

async function buildPDF(report: ReportEntry): Promise<Buffer> {
  const brand = await getBrandConfig();
  const chromeOpts: ChromeOptions = {
    companyName: brand.companyName,
    accentColor: brand.primaryColor,
    logoDataUrl: brand.logoDataUrl,
    websiteLabel: undefined,
  };

  // ── Pass 1: dry run to count total pages ──────────────────────────────────
  const dryDoc = makeDoc();
  let dryPageCount = 1;
  dryDoc.on("pageAdded", () => { dryPageCount++; });
  const dryBuf = collectBuffer(dryDoc);
  renderReport(dryDoc, report, 0, chromeOpts); // totalPages=0 → footer shows "Page X"
  dryDoc.end();
  await dryBuf;

  const totalPages = dryPageCount;

  // ── Pass 2: real render with correct page numbers ─────────────────────────
  const realDoc = makeDoc();
  const realBuf = collectBuffer(realDoc);
  renderReport(realDoc, report, totalPages, chromeOpts);
  realDoc.end();
  return realBuf;
}

// ─── ROUTE ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const sessionId = extractSessionId(req);
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing report id" }, { status: 400 });

    const reports = await runWithSession(sessionId, () => getReports());
    const report = reports.find((r) => r.id === id);
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    const buffer = await buildPDF(report);
    const dateStr  = new Date().toISOString().slice(0, 10);
    const safeName = report.companyName.replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-");
    const filename = `VAR-${safeName}-${dateStr}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length":      String(buffer.length),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
