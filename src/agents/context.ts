// src/agents/context.ts — Institutional memory and intelligence layer.
// Every other agent consults this before making decisions.
// This is a reasoning and scoring agent — it does NOT search the web.
// It reads the live knowledge base produced by knowledge.ts to stay current.

import { askClaude } from "@/lib/claude";
import { getKnowledgeBase, KnowledgeBase } from "@/lib/store";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface VARFitScore {
  overallScore: number;
  fitCategory: "strong" | "moderate" | "weak" | "avoid";
  fitReasons: string[];
  redFlags: string[];
  deploymentEase: "easy" | "moderate" | "complex";
  estimatedDealSize: "small" | "mid" | "enterprise";
  strategicNotes: string;
}

export interface PitchContext {
  hookAngle: string;
  painPoints: string[];
  integrationAngle: string | null;
  toneRecommendation: "formal" | "casual" | "technical" | "executive";
  avoidMentioning: string[];
}

// Minimal subject needed by generateBriefing — avoids importing SalesmanResult (circular dep)
interface BriefingSubject {
  companyName: string;
  decisionMaker: string;
}

// ─── CLOUDBOX KNOWLEDGE BASE ─────────────────────────────────────────────────
// Ground truth about Cloudbox — hardcoded, not fetched. This is what the
// context agent uses as the lens through which it evaluates every lead.

const CLOUDBOX_KNOWLEDGE = {
  product: {
    tagline: "World's first real-time weight-based inventory management solution",
    mechanism:
      "IoT smart scales and sensors track inventory automatically by weight — no manual scanning, no barcodes, no human data entry",
    keyFeatures: [
      "Real-time inventory updates as weight changes on the scale",
      "Integrates with existing ERP, WMS, and POS systems",
      "Eliminates shrinkage and mystery stock loss",
      "Reduces labor cost of cycle counts and manual inventory tracking",
      "Prevents stockouts through automatic threshold alerts",
      "Full real-time stock visibility across locations",
    ],
    deploymentModel:
      "Low complexity — plug-and-play hardware, cloud software, no major IT infrastructure required",
    salesModel:
      "Hardware + SaaS bundle with recurring subscription revenue; strong margin potential for resellers",
    idealDeployments: [
      "Warehouses and distribution centers",
      "Manufacturers tracking raw materials and work-in-progress",
      "Food and beverage distributors",
      "Pharmacies and medical supply companies",
      "Restaurants and foodservice supply chains",
      "Laboratories managing chemical or reagent stock",
      "Any business managing physical goods by quantity",
    ],
  },
  idealVARProfile: {
    customerBase:
      "Already serves warehouse, manufacturing, distribution, or foodservice customers",
    bundlingCapability: "Has hardware + software bundling capability or a history of doing it",
    customerRelationships: "Manages ongoing customer relationships — MSP model or VAR with stickiness",
    technicalCapability: "Technical team capable of basic IoT sensor deployment and onboarding",
    growth:
      "Actively expanding their product portfolio or recently signed new vendor agreements",
    sizeSweetSpot:
      "10–500 employees (enterprise VARs move too slowly; micro VARs lack deployment capacity)",
  },
  strongFitVerticals: [
    "Food and beverage distribution",
    "Pharmaceutical and medical supply",
    "Auto parts and industrial distribution",
    "Restaurant and hospitality supply chains",
    "Third-party logistics (3PL)",
    "Electronics component distribution",
    "Chemical and raw materials",
  ],
  weakFitSignals: [
    "Pure software VARs with zero hardware sales or deployment experience",
    "Consumer IT resellers (retail-style, no B2B service layer)",
    "VARs exclusively focused on networking or cybersecurity with no inventory-adjacent customers",
    "Single-vendor resellers locked into a competing ecosystem",
  ],
  strategicPartners: {
    erp: ["NetSuite", "SAP Business One", "Microsoft Dynamics", "Odoo"],
    wms: ["Fishbowl", "inFlow", "Cin7", "Unleashed"],
    pos: ["Square", "Lightspeed", "Toast"],
    hardwareDistributors: ["Ingram Micro", "TD SYNNEX", "D&H"],
    note: "If a VAR already resells or integrates with any of these, it is a very strong signal for Cloudbox compatibility",
  },
} as const;

// Build the compact text block that goes into every Claude system prompt
function buildKnowledgeBlock(): string {
  return `CLOUDBOX PRODUCT OVERVIEW:
Tagline: ${CLOUDBOX_KNOWLEDGE.product.tagline}
How it works: ${CLOUDBOX_KNOWLEDGE.product.mechanism}
Key selling points: ${CLOUDBOX_KNOWLEDGE.product.keyFeatures.join("; ")}
Deployment model: ${CLOUDBOX_KNOWLEDGE.product.deploymentModel}
Business model: ${CLOUDBOX_KNOWLEDGE.product.salesModel}
Ideal deployment environments: ${CLOUDBOX_KNOWLEDGE.product.idealDeployments.join(", ")}

IDEAL VAR PROFILE:
- ${CLOUDBOX_KNOWLEDGE.idealVARProfile.customerBase}
- ${CLOUDBOX_KNOWLEDGE.idealVARProfile.bundlingCapability}
- ${CLOUDBOX_KNOWLEDGE.idealVARProfile.customerRelationships}
- ${CLOUDBOX_KNOWLEDGE.idealVARProfile.technicalCapability}
- ${CLOUDBOX_KNOWLEDGE.idealVARProfile.sizeSweetSpot}

STRONG FIT VERTICALS (their customers are likely Cloudbox buyers):
${CLOUDBOX_KNOWLEDGE.strongFitVerticals.map((v) => `- ${v}`).join("\n")}

WEAK FIT / AVOID SIGNALS:
${CLOUDBOX_KNOWLEDGE.weakFitSignals.map((v) => `- ${v}`).join("\n")}

STRATEGIC TECHNOLOGY PARTNERS (working with any of these = strong signal):
- ERP: ${CLOUDBOX_KNOWLEDGE.strategicPartners.erp.join(", ")}
- WMS: ${CLOUDBOX_KNOWLEDGE.strategicPartners.wms.join(", ")}
- POS: ${CLOUDBOX_KNOWLEDGE.strategicPartners.pos.join(", ")}
- Hardware distributors: ${CLOUDBOX_KNOWLEDGE.strategicPartners.hardwareDistributors.join(", ")}
- ${CLOUDBOX_KNOWLEDGE.strategicPartners.note}`;
}

// Builds the live intelligence block from the most recent knowledge refresh.
// Returns empty string when no knowledge base exists yet (first run).
function buildLiveIntelligenceBlock(kb: KnowledgeBase): string {
  const age = Math.round(
    (Date.now() - new Date(kb.lastRefreshed).getTime()) / 3600000
  );
  const ageLabel = age < 24 ? `${age}h ago` : `${Math.round(age / 24)}d ago`;

  const lines: string[] = [
    `\nLIVE MARKET INTELLIGENCE (last refreshed ${ageLabel}):`,
    `Executive summary: ${kb.lastInsights}`,
  ];

  if (kb.hotVerticals.length > 0) {
    lines.push(
      `\nHOT VERTICALS right now (highest signal for Cloudbox VAR sales):\n` +
      kb.hotVerticals.map((v) => `- ${v}`).join("\n")
    );
    lines.push(
      `SCORING RULE: If this company's existing customers operate in any hot vertical above, ` +
      `add 1 point to overallScore. Note this in fitReasons.`
    );
  }

  if (kb.coldVerticals.length > 0) {
    lines.push(
      `\nCOLD VERTICALS right now (weak signals, budget freezes, or saturation):\n` +
      kb.coldVerticals.map((v) => `- ${v}`).join("\n")
    );
    lines.push(
      `SCORING RULE: If this company's existing customers operate primarily in a cold vertical, ` +
      `add a red flag noting current market conditions.`
    );
  }

  if (kb.refinedIdealVARProfile) {
    lines.push(`\nCURRENT IDEAL VAR PROFILE (evolving):\n${kb.refinedIdealVARProfile}`);
  }

  if (kb.varMarketSignals.length > 0) {
    lines.push(
      `\nVAR MARKET SIGNALS:\n` +
      kb.varMarketSignals.slice(0, 3).map((s) => `- ${s}`).join("\n")
    );
  }

  if (kb.partnerEcosystem.length > 0) {
    lines.push(
      `\nPARTNER ECOSYSTEM NEWS:\n` +
      kb.partnerEcosystem.slice(0, 3).map((p) => `- ${p}`).join("\n")
    );
  }

  return lines.join("\n");
}

// ─── FUNCTION 1: scoreVARFit ─────────────────────────────────────────────────
// Evaluates how well a company fits as a Cloudbox VAR.
// Can be called twice: first with name+news only (pre-detective), then with full profiles.

export async function scoreVARFit(
  companyName: string,
  companyProfile: string,
  personProfile: string,
  newsContext: string
): Promise<VARFitScore> {
  const knowledgeBlock = buildKnowledgeBlock();
  const kb = getKnowledgeBase();
  const liveBlock = kb ? buildLiveIntelligenceBlock(kb) : "";

  const response = await askClaude(
    `You are the Cloudbox Partner Intelligence System. Evaluate whether a company is a strong candidate to become a Cloudbox VAR (Value Added Reseller). Use the Cloudbox knowledge base below as ground truth.

${knowledgeBlock}${liveBlock}

Evaluate the company honestly and critically — a conservative score now saves wasted effort later. If you have limited data, score conservatively. Apply any SCORING RULES from the live intelligence section above.

Return ONLY a JSON object (no markdown, no explanation):
{
  "overallScore": 7,
  "fitCategory": "moderate",
  "fitReasons": ["Has existing distribution customer base that needs inventory tracking", "..."],
  "redFlags": ["No hardware deployment history found", "..."],
  "deploymentEase": "easy",
  "estimatedDealSize": "mid",
  "strategicNotes": "Already works with NetSuite customers — Cloudbox integration would be seamless for their installs"
}

fitCategory rules (must match overallScore range):
- "strong":   overallScore 8–10, clear VAR candidate with directly relevant customers and proven capability
- "moderate": overallScore 6–7, likely fit but with gaps that need qualification
- "weak":     overallScore 4–5, marginal fit, would require significant effort to qualify
- "avoid":    overallScore 0–3, wrong type of company or active disqualifiers present

deploymentEase: how easy would it be for this VAR to deploy Cloudbox to their existing customers
estimatedDealSize: "small" = sub-$10k ARR, "mid" = $10k–$100k ARR, "enterprise" = $100k+ ARR

fitReasons: list specific, evidence-backed reasons they are a good fit (not generic)
redFlags: honest concerns or disqualifiers — empty array [] if none found`,
    `Company: ${companyName}
${companyProfile ? `Company profile:\n${companyProfile}` : "(No company profile available — scoring from name and news context only)"}
${personProfile ? `\nDecision maker profile:\n${personProfile}` : ""}
\nNews context: ${newsContext}`
  );

  try {
    const cleaned = response.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as VARFitScore;
  } catch {
    console.error(`[Context] Failed to parse scoreVARFit for ${companyName}`);
    return {
      overallScore: 5,
      fitCategory: "moderate",
      fitReasons: ["Insufficient data to fully evaluate — manual review recommended"],
      redFlags: ["Scoring response could not be parsed"],
      deploymentEase: "moderate",
      estimatedDealSize: "small",
      strategicNotes: "Context agent could not score this lead — proceed with manual review.",
    };
  }
}

// ─── FUNCTION 2: enrichPitchContext ──────────────────────────────────────────
// Generates strategic pitch guidance for the Salesman agent.
// Called after Detective has produced full profiles and after scoreVARFit.

export async function enrichPitchContext(
  companyName: string,
  companyProfile: string,
  personProfile: string,
  varFitScore: VARFitScore
): Promise<PitchContext> {
  const knowledgeBlock = buildKnowledgeBlock();
  const kb = getKnowledgeBase();
  const liveBlock = kb ? buildLiveIntelligenceBlock(kb) : "";

  const response = await askClaude(
    `You are the Cloudbox Pitch Intelligence System. Given a VAR candidate's profile and their fit assessment, generate the strategic pitch context that will make outreach most effective and human.

${knowledgeBlock}${liveBlock}

Return ONLY a JSON object (no markdown, no explanation):
{
  "hookAngle": "The single most compelling, specific reason this VAR should care about Cloudbox right now — reference something concrete about their business",
  "painPoints": ["A specific pain point their customers likely experience that Cloudbox directly solves", "..."],
  "integrationAngle": "If they work with a known partner technology from the list above, name it and explain the integration angle — or null if none identified",
  "toneRecommendation": "formal",
  "avoidMentioning": ["Aspects of Cloudbox that are not relevant or could raise objections for this specific company type"]
}

toneRecommendation guidelines:
- "executive": CRO/CEO-level contact at a larger company — focus on revenue impact and strategic differentiation
- "formal": VP or Director level — structured, professional, data-focused
- "technical": IT/solutions architect contact — can reference integration, deployment, and technical specs
- "casual": Founder/owner of a smaller company — direct, conversational, no fluff`,
    `Company: ${companyName}
Company profile: ${companyProfile}
Decision maker profile: ${personProfile}

VAR fit assessment:
- Overall score: ${varFitScore.overallScore}/10 (${varFitScore.fitCategory})
- Fit reasons: ${varFitScore.fitReasons.join("; ")}
- Red flags: ${varFitScore.redFlags.length > 0 ? varFitScore.redFlags.join("; ") : "none"}
- Deployment ease: ${varFitScore.deploymentEase}
- Strategic notes: ${varFitScore.strategicNotes}`
  );

  try {
    const cleaned = response.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as PitchContext;
  } catch {
    console.error(`[Context] Failed to parse enrichPitchContext for ${companyName}`);
    return {
      hookAngle: `${companyName}'s customers could eliminate manual inventory tracking entirely with Cloudbox`,
      painPoints: [
        "Manual cycle counts consume hours of warehouse staff time each week",
        "Stockouts and overstock situations caused by inaccurate real-time visibility",
      ],
      integrationAngle: null,
      toneRecommendation: "formal",
      avoidMentioning: [],
    };
  }
}

// ─── FUNCTION 3: isWorthPursuing ─────────────────────────────────────────────
// Gate function used by the orchestrator to drop weak leads before expensive
// Detective and Salesman API calls are made.

export function isWorthPursuing(varFitScore: VARFitScore): boolean {
  if (varFitScore.overallScore < 5) return false;
  if (varFitScore.fitCategory === "avoid") return false;
  if (varFitScore.redFlags.length > 2) return false;
  return true;
}

// ─── FUNCTION 4: generateBriefing ────────────────────────────────────────────
// Builds a 1-paragraph executive briefing from structured pipeline data.
// Synchronous — no Claude call. Uses data already produced by the pipeline.

export function generateBriefing(
  subject: BriefingSubject,
  varFitScore: VARFitScore,
  pitchContext: PitchContext
): string {
  const topReason =
    varFitScore.fitReasons.length > 0
      ? varFitScore.fitReasons[0]
      : varFitScore.strategicNotes;

  const integrationNote = pitchContext.integrationAngle
    ? ` ${pitchContext.integrationAngle}.`
    : "";

  const dealSizeLabel =
    varFitScore.estimatedDealSize === "small"
      ? "small (<$10k ARR)"
      : varFitScore.estimatedDealSize === "mid"
      ? "mid-market ($10k–$100k ARR)"
      : "enterprise ($100k+ ARR)";

  // Pull in live market context if the KB is fresh (< 48 hours old)
  const kb = getKnowledgeBase();
  let marketNote = "";
  if (kb) {
    const ageHours =
      (Date.now() - new Date(kb.lastRefreshed).getTime()) / 3600000;
    if (ageHours < 48 && kb.lastInsights) {
      marketNote = ` Market context: ${kb.lastInsights.split(".")[0]}.`;
    }
  }

  return (
    `Why this matters: ${subject.companyName} is a ${varFitScore.fitCategory} Cloudbox VAR fit ` +
    `(${varFitScore.overallScore}/10). ${topReason}.${integrationNote} ` +
    `Recommended approach: ${pitchContext.toneRecommendation} tone, targeting ${subject.decisionMaker}. ` +
    `Estimated deal size: ${dealSizeLabel}. ` +
    `Deployment complexity for their customers: ${varFitScore.deploymentEase}.${marketNote}`
  );
}
