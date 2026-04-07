// src/agents/context.ts — Institutional memory and intelligence layer.
// Every other agent consults this before making decisions.
// This is a reasoning and scoring agent — it does NOT search the web.
// It reads the live knowledge base produced by knowledge.ts to stay current.

import { askClaude } from "@/lib/claude";
import {
  getKnowledgeBase,
  KnowledgeBase,
  SearchHistoryEntry,
  EvolvedSearchParams,
  WatchtowerConfig,
  WatchtowerSearchCategory,
} from "@/lib/store";
import { getBrandConfig } from "@/lib/brand";
import { getBusinessProfile, buildProductKnowledgeBlock, BusinessProfile } from "@/lib/business-profile";

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

interface BriefingSubject {
  companyName: string;
  decisionMaker: string;
}

export type { WatchtowerConfig, WatchtowerSearchCategory };

// ─── CLOUDBOX DEFAULTS ───────────────────────────────────────────────────────

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

// ─── KNOWLEDGE BLOCK BUILDERS ────────────────────────────────────────────────

function buildDefaultKnowledgeBlock(companyName: string): string {
  return `${companyName.toUpperCase()} PRODUCT OVERVIEW:
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

STRONG FIT VERTICALS (their customers are likely ${companyName} buyers):
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

function buildKnowledgeBlock(profile: BusinessProfile | null, companyName: string): string {
  const profileBlock = buildProductKnowledgeBlock(profile);
  return profileBlock || buildDefaultKnowledgeBlock(companyName);
}

function buildLiveIntelligenceBlock(kb: KnowledgeBase, companyName: string): string {
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
      `\nHOT VERTICALS right now (highest signal for ${companyName} VAR sales):\n` +
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

export async function scoreVARFit(
  companyName: string,
  companyProfile: string,
  personProfile: string,
  newsContext: string
): Promise<VARFitScore> {
  const [brand, profile, kb] = await Promise.all([
    getBrandConfig(),
    getBusinessProfile(),
    getKnowledgeBase(),
  ]);
  const knowledgeBlock = buildKnowledgeBlock(profile, brand.companyName);
  const liveBlock = kb ? buildLiveIntelligenceBlock(kb, brand.companyName) : "";

  const response = await askClaude(
    `You are the ${brand.companyName} Partner Intelligence System. Evaluate whether a company is a strong candidate to become a ${brand.companyName} VAR (Value Added Reseller). Use the knowledge base below as ground truth.

Never use em dashes (—) in any output. Use commas, periods, or restructure the sentence instead.

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
  "strategicNotes": "Context-specific strategic notes here"
}

fitCategory rules (must match overallScore range):
- "strong":   overallScore 8–10, clear VAR candidate with directly relevant customers and proven capability
- "moderate": overallScore 6–7, likely fit but with gaps that need qualification
- "weak":     overallScore 4–5, marginal fit, would require significant effort to qualify
- "avoid":    overallScore 0–3, wrong type of company or active disqualifiers present

deploymentEase: how easy would it be for this VAR to deploy ${brand.companyName} to their existing customers
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

export async function enrichPitchContext(
  companyName: string,
  companyProfile: string,
  personProfile: string,
  varFitScore: VARFitScore
): Promise<PitchContext> {
  const [brand, profile, kb] = await Promise.all([
    getBrandConfig(),
    getBusinessProfile(),
    getKnowledgeBase(),
  ]);
  const knowledgeBlock = buildKnowledgeBlock(profile, brand.companyName);
  const liveBlock = kb ? buildLiveIntelligenceBlock(kb, brand.companyName) : "";

  const response = await askClaude(
    `You are the ${brand.companyName} Pitch Intelligence System. Given a VAR candidate's profile and their fit assessment, generate the strategic pitch context that will make outreach most effective and human.

Never use em dashes (—) in any output. Use commas, periods, or restructure the sentence instead.

${knowledgeBlock}${liveBlock}

Return ONLY a JSON object (no markdown, no explanation):
{
  "hookAngle": "The single most compelling, specific reason this VAR should care about ${brand.companyName} right now — reference something concrete about their business",
  "painPoints": ["A specific pain point their customers likely experience that ${brand.companyName} directly solves", "..."],
  "integrationAngle": "If they work with a known partner technology, name it and explain the integration angle — or null if none identified",
  "toneRecommendation": "formal",
  "avoidMentioning": ["Aspects of ${brand.companyName} that are not relevant or could raise objections for this specific company type"]
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
    const brand = await getBrandConfig();
    return {
      hookAngle: `${companyName}'s customers could eliminate manual processes entirely with ${brand.companyName}`,
      painPoints: [
        "Manual processes consuming hours of staff time each week",
        "Lack of real-time visibility causing costly errors",
      ],
      integrationAngle: null,
      toneRecommendation: "formal",
      avoidMentioning: [],
    };
  }
}

// ─── FUNCTION 3: isWorthPursuing ─────────────────────────────────────────────

export function isWorthPursuing(varFitScore: VARFitScore): boolean {
  if (varFitScore.fitCategory === "avoid") return false;
  if (varFitScore.overallScore < 5) return false;
  return true;
}

// ─── FUNCTION 4: generateBriefing ────────────────────────────────────────────

export async function generateBriefing(
  subject: BriefingSubject,
  varFitScore: VARFitScore,
  pitchContext: PitchContext
): Promise<string> {
  const [brand, kb] = await Promise.all([getBrandConfig(), getKnowledgeBase()]);

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

  let marketNote = "";
  if (kb) {
    const ageHours = (Date.now() - new Date(kb.lastRefreshed).getTime()) / 3600000;
    if (ageHours < 48 && kb.lastInsights) {
      marketNote = ` Market context: ${kb.lastInsights.split(".")[0]}.`;
    }
  }

  return (
    `Why this matters: ${subject.companyName} is a ${varFitScore.fitCategory} ${brand.companyName} VAR fit ` +
    `(${varFitScore.overallScore}/10). ${topReason}.${integrationNote} ` +
    `Recommended approach: ${pitchContext.toneRecommendation} tone, targeting ${subject.decisionMaker}. ` +
    `Estimated deal size: ${dealSizeLabel}. ` +
    `Deployment complexity for their customers: ${varFitScore.deploymentEase}.${marketNote}`
  );
}

// ─── FUNCTION 5: evolveSearchParameters ──────────────────────────────────────

export async function evolveSearchParameters(
  currentQueries: string[],
  searchHistory: SearchHistoryEntry[],
  knowledgeBase: KnowledgeBase | null,
  seenCompanies: string[]
): Promise<EvolvedSearchParams> {
  const [brand, profile] = await Promise.all([getBrandConfig(), getBusinessProfile()]);
  const knowledgeBlock = buildKnowledgeBlock(profile, brand.companyName);

  const queryStats = new Map<string, { runs: number; totalResults: number; totalLeads: number; totalScore: number; companies: Set<string> }>();
  for (const entry of searchHistory) {
    const s = queryStats.get(entry.query) ?? { runs: 0, totalResults: 0, totalLeads: 0, totalScore: 0, companies: new Set() };
    s.runs++;
    s.totalResults += entry.resultsCount;
    s.totalLeads += entry.qualifiedLeadsCount;
    s.totalScore += entry.avgRelevanceScore;
    entry.companiesFound.forEach((c) => s.companies.add(c));
    queryStats.set(entry.query, s);
  }

  const sortedByLeads = Array.from(queryStats.entries()).sort((a, b) => b[1].totalLeads - a[1].totalLeads);
  const topQueries = sortedByLeads.slice(0, 10).map(([q, s]) =>
    `"${q}" — ${s.totalLeads} qualified leads over ${s.runs} runs, avg ${s.totalResults > 0 ? Math.round(s.totalLeads / s.runs * 10) / 10 : 0} leads/run`
  ).join("\n");

  const zeroQueries = sortedByLeads.slice(-10).filter(([, s]) => s.totalLeads === 0).map(([q, s]) =>
    `"${q}" — 0 leads over ${s.runs} runs (${s.totalResults} total raw results)`
  ).join("\n");

  const saturatedCandidates = Array.from(queryStats.entries())
    .filter(([, s]) => s.companies.size > 0 && s.runs >= 3)
    .map(([q, s]) => ({ q, companies: Array.from(s.companies), runs: s.runs }))
    .filter(({ companies, runs }) => companies.length > 0 && companies.length / runs < 0.5)
    .map(({ q, companies }) => `"${q}" — repeatedly finds: ${companies.slice(0, 3).join(", ")}`)
    .join("\n");

  const kbBlock = knowledgeBase
    ? `CURRENT KNOWLEDGE BASE:
Hot verticals: ${knowledgeBase.hotVerticals.join(", ") || "none yet"}
Cold verticals: ${knowledgeBase.coldVerticals.join(", ") || "none yet"}
Executive insights: ${knowledgeBase.lastInsights}
Partner ecosystem signals: ${knowledgeBase.partnerEcosystem.slice(0, 3).join("; ") || "none"}`
    : "No knowledge base yet — generate queries based on product knowledge only.";

  const recentSeenSample = seenCompanies.slice(-30).join(", ") || "none yet";

  const response = await askClaude(
    `You are a search strategy analyst for ${brand.companyName}'s VAR prospecting pipeline. Your job is to evolve the search query set to find better leads over time.

Never use em dashes (—) in any output. Use commas, periods, or restructure the sentence instead.

${knowledgeBlock}

${kbBlock}

RECENTLY PROCESSED COMPANIES (do not target these again):
${recentSeenSample}

PERFORMANCE DATA (${searchHistory.length} total query runs in the last 90 days):

Best performing queries (most qualified leads):
${topQueries || "No history yet — this may be the first run."}

Zero-result queries (consistently no qualified leads):
${zeroQueries || "None identified yet."}

Queries showing saturation (same companies repeatedly):
${saturatedCandidates || "None identified yet."}

CURRENT ACTIVE QUERIES (${currentQueries.length} total):
${currentQueries.map((q) => `"${q}"`).join("\n")}

YOUR TASK:
1. RETIRE queries that have run 3+ times and produced zero qualified leads — these are wasted API calls.
2. Generate 5-10 NEW queries targeting angles not yet covered (check the current query list for gaps).
3. Generate 2-3 HOT VERTICAL queries directly tied to the hot verticals in the knowledge base.
4. Generate 1-2 ECOSYSTEM queries targeting partner ecosystem companies.
5. Flag any query showing saturation (same companies every run) as saturated — still run them but note it.

Query writing rules:
- Queries should be 4-10 words, natural search engine style
- Include year (2026) where relevant to get fresh results
- Target specific business types, not generic terms

Return ONLY a JSON object (no markdown):
{
  "retireQueries": ["exact query string to retire", ...],
  "addQueries": ["new query 1", ..., "new query 10"],
  "hotVerticalQueries": ["query targeting hot vertical 1", ...],
  "ecosystemQueries": ["ecosystem query 1", "ecosystem query 2"],
  "saturatedQueries": ["saturated query 1", ...],
  "evolutionRationale": "2-3 sentences explaining what changed and why, no em dashes"
}`,
    `Evolve the search parameters based on the data above. Current query count: ${currentQueries.length}. History entries: ${searchHistory.length}.`
  );

  try {
    const cleaned = response.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as EvolvedSearchParams;
  } catch {
    console.error("[Context] Failed to parse evolveSearchParameters response");
    return {
      retireQueries: [],
      addQueries: [],
      hotVerticalQueries: [],
      ecosystemQueries: [],
      saturatedQueries: [],
      evolutionRationale: "Search evolution parsing failed — using current query set unchanged.",
    };
  }
}

// ─── FUNCTION 6: translateBusinessContext ────────────────────────────────────

export async function translateBusinessContext(profile: BusinessProfile): Promise<WatchtowerConfig> {
  const profileBlock = buildProductKnowledgeBlock(profile);

  const response = await askClaude(
    `You are a channel sales strategist specializing in building VAR (Value Added Reseller) and reseller partner networks.

A company has described their business. Your job is to translate this into a precise, actionable search and partner strategy for their VAR prospecting pipeline.

Never use em dashes (—) in any output. Use commas, periods, or restructure the sentence instead.

${profileBlock}

Return ONLY a JSON object (no markdown, no explanation). The object must exactly match this shape:
{
  "searchCategories": [
    {
      "name": "Category name",
      "description": "What kind of companies this targets",
      "queries": ["3-5 specific Google-style search queries for this category"],
      "priority": "high"
    }
  ],
  "idealVARProfile": "A paragraph describing the ideal VAR or reseller partner for this specific business — what they sell, who their customers are, their size, and what makes them a perfect fit",
  "targetVerticals": ["Industry vertical 1", "Industry vertical 2"],
  "avoidVerticals": ["Vertical to avoid 1"],
  "partnerEcosystem": ["Complementary technology 1", "Complementary technology 2"],
  "dealSizeGuidance": "Guidance on deal sizing for VARs selling this product",
  "pitchTone": "formal",
  "keyValueProps": ["Why a VAR should care #1", "Why a VAR should care #2", "Why a VAR should care #3"],
  "redFlagPatterns": ["Pattern that suggests a bad VAR fit", "..."]
}

Rules:
- Generate 4-6 search categories, each with 3-5 unique queries
- Queries must be natural search engine style, 4-10 words, usable in Google News
- Include year (2026) in at least half the queries to get fresh results
- targetVerticals: 5-8 specific industries where this product would sell well through a VAR
- avoidVerticals: 2-4 industries that are unlikely fits (too small, wrong model, etc.)
- partnerEcosystem: 4-8 technologies/platforms a good VAR would already sell or integrate with
- pitchTone: one of "formal", "casual", "technical", "executive" — based on typical buyer profile
- keyValueProps: exactly 3-5 sharp bullet points on why a VAR should add this product
- redFlagPatterns: 3-6 patterns that indicate a VAR is unlikely to be a good fit`,
    `Translate this business profile into a VAR partner strategy for ${profile.companyName}.`
  );

  try {
    const cleaned = response.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as WatchtowerConfig;
  } catch {
    console.error("[Context] Failed to parse translateBusinessContext response");
    return {
      searchCategories: [
        {
          name: "General partner search",
          description: "Broad search for potential VAR partners",
          queries: [
            `${profile.companyName} reseller partnership 2026`,
            "VAR channel partner program expansion 2026",
            "technology reseller new vendor agreement",
          ],
          priority: "high",
        },
      ],
      idealVARProfile: `A partner that sells complementary solutions to ${profile.companyName}'s target customers and is actively expanding their product portfolio.`,
      targetVerticals: [],
      avoidVerticals: [],
      partnerEcosystem: [],
      dealSizeGuidance: "Evaluate deal size based on the VAR's existing customer base size and buying power.",
      pitchTone: "formal",
      keyValueProps: [profile.whyChooseYou || "Strong value proposition for VAR's existing customer base"],
      redFlagPatterns: ["No existing customer base in target verticals"],
    };
  }
}
