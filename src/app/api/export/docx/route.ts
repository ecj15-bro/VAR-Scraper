// src/app/api/export/docx/route.ts — Word document export for a single VAR report

import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ShadingType,
  TableRow,
  TableCell,
  Table,
  WidthType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  convertInchesToTwip,
  UnderlineType,
} from "docx";
import { getReports, ReportEntry } from "@/lib/store";

// ─── THEME ────────────────────────────────────────────────────────────────────

const T = {
  headerBg: "0D0D1A",
  accentGreen: "00CC66",
  accentPurple: "7C3AED",
  strong: "00AA55",
  moderate: "CC8800",
  weak: "CC5500",
  avoid: "CC2222",
  text: "1A1A2E",
  muted: "666680",
  surface: "F7F7FC",
  border: "D0D0EC",
};

function fitColor(cat: string | undefined): string {
  if (cat === "strong") return T.strong;
  if (cat === "moderate") return T.moderate;
  if (cat === "weak") return T.weak;
  if (cat === "avoid") return T.avoid;
  return T.muted;
}

// ─── PARAGRAPH HELPERS ───────────────────────────────────────────────────────

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 18,
        color: T.muted,
        characterSpacing: 80,
        font: "Calibri",
      }),
    ],
    spacing: { before: 280, after: 80 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: T.border, space: 4 },
    },
  });
}

function bodyText(text: string, opts?: { italic?: boolean; color?: string; size?: number }): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        size: opts?.size ?? 20,
        color: opts?.color ?? T.text,
        italics: opts?.italic,
        font: "Calibri",
      }),
    ],
    spacing: { after: 80 },
  });
}

function bulletItem(text: string, color?: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        size: 20,
        color: T.text,
        font: "Calibri",
      }),
    ],
    bullet: { level: 0 },
    spacing: { after: 40 },
  });
}

function labelValuePair(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20, color: T.muted, font: "Calibri" }),
      new TextRun({ text: value || "—", size: 20, color: T.text, font: "Calibri" }),
    ],
    spacing: { after: 60 },
  });
}

function pitchBlock(label: string, text: string, accentColor: string): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: label,
          bold: true,
          size: 18,
          color: accentColor,
          font: "Calibri",
          characterSpacing: 40,
        }),
      ],
      shading: { type: ShadingType.SOLID, color: T.surface, fill: T.surface },
      spacing: { before: 200, after: 80 },
      indent: { left: convertInchesToTwip(0.1), right: convertInchesToTwip(0.1) },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text,
          size: 20,
          color: T.text,
          font: "Calibri",
        }),
      ],
      shading: { type: ShadingType.SOLID, color: T.surface, fill: T.surface },
      spacing: { after: 80 },
      indent: { left: convertInchesToTwip(0.1), right: convertInchesToTwip(0.1) },
    }),
    new Paragraph({ children: [], spacing: { after: 60 } }),
  ];
}

function briefingBlock(text: string): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: "CONTEXT BRIEFING",
          bold: true,
          size: 18,
          color: T.accentPurple,
          font: "Calibri",
          characterSpacing: 80,
        }),
      ],
      shading: { type: ShadingType.SOLID, color: "F3EEFF", fill: "F3EEFF" },
      spacing: { before: 0, after: 80 },
      indent: { left: convertInchesToTwip(0.15), right: convertInchesToTwip(0.15) },
      border: { left: { style: BorderStyle.THICK, size: 12, color: T.accentPurple, space: 8 } },
    }),
    new Paragraph({
      children: [
        new TextRun({ text, size: 20, color: T.text, font: "Calibri" }),
      ],
      shading: { type: ShadingType.SOLID, color: "F3EEFF", fill: "F3EEFF" },
      spacing: { after: 200 },
      indent: { left: convertInchesToTwip(0.15), right: convertInchesToTwip(0.15) },
      border: { left: { style: BorderStyle.THICK, size: 12, color: T.accentPurple, space: 8 } },
    }),
  ];
}

function hookBlock(text: string): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new TextRun({ text: "HOOK ANGLE", bold: true, size: 18, color: T.accentGreen, font: "Calibri", characterSpacing: 80 }),
      ],
      shading: { type: ShadingType.SOLID, color: "E6F9EF", fill: "E6F9EF" },
      spacing: { before: 0, after: 80 },
      indent: { left: convertInchesToTwip(0.15), right: convertInchesToTwip(0.15) },
      border: { left: { style: BorderStyle.THICK, size: 12, color: T.accentGreen, space: 8 } },
    }),
    new Paragraph({
      children: [
        new TextRun({ text, size: 20, color: T.text, font: "Calibri" }),
      ],
      shading: { type: ShadingType.SOLID, color: "E6F9EF", fill: "E6F9EF" },
      spacing: { after: 200 },
      indent: { left: convertInchesToTwip(0.15), right: convertInchesToTwip(0.15) },
      border: { left: { style: BorderStyle.THICK, size: 12, color: T.accentGreen, space: 8 } },
    }),
  ];
}

// ─── FIT ASSESSMENT TABLE ─────────────────────────────────────────────────────

function fitTable(report: ReportEntry): Table {
  const fc = report.varFitScore?.fitCategory ?? "—";
  const fcolor = fitColor(fc);

  const makeCell = (label: string, value: string, labelColor?: string): TableCell =>
    new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: label + ": ", bold: true, size: 18, color: labelColor ?? T.muted, font: "Calibri" }),
            new TextRun({ text: value, bold: true, size: 18, color: T.text, font: "Calibri" }),
          ],
        }),
      ],
      width: { size: 50, type: WidthType.PERCENTAGE },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      shading: { type: ShadingType.SOLID, color: T.surface, fill: T.surface },
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          makeCell("Category", fc.toUpperCase(), fcolor),
          makeCell(
            "Score",
            report.varFitScore?.overallScore !== undefined ? `${report.varFitScore.overallScore}/10` : "—"
          ),
        ],
      }),
      new TableRow({
        children: [
          makeCell("Deployment", report.varFitScore?.deploymentEase ?? "—"),
          makeCell("Deal Size", report.varFitScore?.estimatedDealSize ?? "—"),
        ],
      }),
      new TableRow({
        children: [
          makeCell("Tone", report.pitchContext?.toneRecommendation ?? "formal"),
          makeCell(
            "Relevance",
            report.relevanceScore !== undefined ? `${report.relevanceScore}/10` : "—"
          ),
        ],
      }),
    ],
  });
}

// ─── DOCUMENT BUILDER ────────────────────────────────────────────────────────

async function buildDocx(report: ReportEntry): Promise<Buffer> {
  const fc = report.varFitScore?.fitCategory;
  const fcolor = fitColor(fc);
  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const children: (Paragraph | Table)[] = [];

  // ── Document title ───────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "CLOUDBOX ",
          bold: true,
          size: 28,
          color: T.text,
          font: "Calibri",
        }),
        new TextRun({
          text: "VAR HUNTER",
          bold: true,
          size: 28,
          color: T.accentGreen,
          font: "Calibri",
        }),
      ],
      spacing: { after: 40 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `VAR Opportunity Report  ·  Generated ${generatedDate}`,
          size: 18,
          color: T.muted,
          font: "Calibri",
        }),
      ],
      spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: T.border, space: 8 } },
    })
  );

  // ── Company name + fit badge ──────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: report.companyName,
          bold: true,
          size: 40,
          color: T.text,
          font: "Calibri",
        }),
      ],
      spacing: { after: 80 },
    })
  );

  if (fc) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${fc.toUpperCase()} FIT`,
            bold: true,
            size: 20,
            color: fcolor,
            font: "Calibri",
          }),
          report.varFitScore?.overallScore !== undefined
            ? new TextRun({
                text: `   ${report.varFitScore.overallScore}/10`,
                bold: true,
                size: 20,
                color: fcolor,
                font: "Calibri",
              })
            : new TextRun({ text: "" }),
          report.relevanceScore !== undefined
            ? new TextRun({
                text: `   Relevance: ${report.relevanceScore}/10`,
                size: 18,
                color: T.muted,
                font: "Calibri",
              })
            : new TextRun({ text: "" }),
        ],
        spacing: { after: 60 },
      })
    );
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Detected ${new Date(report.timestamp).toLocaleString()}`,
          size: 18,
          color: T.muted,
          font: "Calibri",
        }),
      ],
      spacing: { after: 240 },
    })
  );

  // ── Context briefing ─────────────────────────────────────────────────────
  if (report.briefing) {
    children.push(...briefingBlock(report.briefing));
  }

  // ── Decision maker ───────────────────────────────────────────────────────
  children.push(sectionHeading("Key Decision Maker"));
  children.push(labelValuePair("Name", report.decisionMaker));
  children.push(labelValuePair("Title", report.title));
  if (report.companyWebsite) children.push(labelValuePair("Website", report.companyWebsite));
  if (report.linkedinUrl) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "LinkedIn: ", bold: true, size: 20, color: T.muted, font: "Calibri" }),
          new TextRun({
            text: report.linkedinUrl,
            size: 20,
            color: "0A66C2",
            underline: { type: UnderlineType.SINGLE },
            font: "Calibri",
          }),
        ],
        spacing: { after: 60 },
      })
    );
  }

  // ── Fit assessment ───────────────────────────────────────────────────────
  if (report.varFitScore) {
    children.push(sectionHeading("Fit Assessment"));
    children.push(fitTable(report));
    children.push(new Paragraph({ children: [], spacing: { after: 120 } }));

    if (report.varFitScore.fitReasons.length > 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "Why it fits", bold: true, size: 20, color: T.strong, font: "Calibri" })],
          spacing: { before: 80, after: 60 },
        })
      );
      for (const r of report.varFitScore.fitReasons) {
        children.push(bulletItem(r));
      }
    }

    if (report.varFitScore.redFlags.length > 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "Red flags", bold: true, size: 20, color: T.moderate, font: "Calibri" })],
          spacing: { before: 120, after: 60 },
        })
      );
      for (const f of report.varFitScore.redFlags) {
        children.push(bulletItem(f));
      }
    }

    if (report.varFitScore.strategicNotes) {
      children.push(bodyText(report.varFitScore.strategicNotes, { italic: true, color: T.muted }));
    }
  }

  // ── Company + person profiles ────────────────────────────────────────────
  children.push(sectionHeading("Company Profile"));
  children.push(bodyText(report.companyProfile));

  children.push(sectionHeading("Person Context"));
  children.push(bodyText(report.personProfile));

  // ── Hook angle ───────────────────────────────────────────────────────────
  if (report.pitchContext?.hookAngle) {
    children.push(sectionHeading("Pitch Context"));
    children.push(...hookBlock(report.pitchContext.hookAngle));
  }

  // ── Pitch variants ───────────────────────────────────────────────────────
  children.push(sectionHeading("Personalized Pitches"));

  const pitchVariants: Array<{ label: string; text: string; color: string }> = [];
  if (report.pitchVariants) {
    if (report.pitchVariants.cold_email)       pitchVariants.push({ label: "COLD EMAIL",       text: report.pitchVariants.cold_email,       color: T.accentGreen });
    if (report.pitchVariants.linkedin_message) pitchVariants.push({ label: "LINKEDIN MESSAGE", text: report.pitchVariants.linkedin_message, color: "0A66C2" });
    if (report.pitchVariants.followup_email)   pitchVariants.push({ label: "FOLLOW-UP EMAIL",  text: report.pitchVariants.followup_email,   color: T.accentGreen });
    if (report.pitchVariants.text_message)     pitchVariants.push({ label: "TEXT MESSAGE",     text: report.pitchVariants.text_message,     color: T.muted });
    if (report.pitchVariants.executive_brief)  pitchVariants.push({ label: "EXECUTIVE BRIEF",  text: report.pitchVariants.executive_brief,  color: T.accentPurple });
  } else if (report.pitch) {
    pitchVariants.push({ label: "PITCH", text: report.pitch, color: T.accentGreen });
  }

  for (const pv of pitchVariants) {
    children.push(...pitchBlock(pv.label, pv.text, pv.color));
  }

  // ── News trigger ─────────────────────────────────────────────────────────
  children.push(sectionHeading("News Trigger"));
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: report.newsTitle, bold: true, size: 20, color: T.text, font: "Calibri" }),
      ],
      spacing: { after: 60 },
    })
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Source: ", bold: true, size: 18, color: T.muted, font: "Calibri" }),
        new TextRun({
          text: report.newsSource,
          size: 18,
          color: "0A66C2",
          underline: { type: UnderlineType.SINGLE },
          font: "Calibri",
        }),
      ],
      spacing: { after: 240 },
    })
  );

  // ── Build document ───────────────────────────────────────────────────────
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "default-bullets",
          levels: [
            {
              level: 0,
              format: NumberFormat.BULLET,
              text: "\u2022",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) } },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.1),
              right: convertInchesToTwip(1.1),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "CLOUDBOX VAR HUNTER  ·  ", size: 16, color: T.muted, font: "Calibri" }),
                  new TextRun({ text: report.companyName, bold: true, size: 16, color: T.text, font: "Calibri" }),
                ],
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: T.border, space: 4 } },
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Generated by Cloudbox VAR Hunter  ·  cloudboxapp.com  ·  Page ", size: 16, color: T.muted, font: "Calibri" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: T.muted, font: "Calibri" }),
                  new TextRun({ text: " of ", size: 16, color: T.muted, font: "Calibri" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: T.muted, font: "Calibri" }),
                ],
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: T.border, space: 4 } },
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

// ─── ROUTE ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing report id" }, { status: 400 });

    const report = getReports().find((r) => r.id === id);
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    const buffer = await buildDocx(report);
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeName = report.companyName.replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-");
    const filename = `VAR-${safeName}-${dateStr}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
