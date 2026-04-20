// src/agents/salesman.ts — Stage 3: Generate personalized pitches and deliver the final report

import { askClaude } from "@/lib/claude";
import { deliverReport } from "@/lib/deliver";
import { saveReport, markCompanySeen } from "@/lib/data";
import { getBrandConfig, BrandConfig } from "@/lib/brand";
import { getBusinessProfile, getWatchtowerConfig, buildProductKnowledgeBlock, BusinessProfile, WatchtowerConfig } from "@/lib/business-profile";
import { createConcurrencyLimiter } from "@/lib/concurrency";
import { DetectiveResult } from "./detective";
import { VARFitScore, PitchContext } from "./context";

export interface PitchVariants {
  cold_email: string;
  linkedin_message: string;
  followup_email: string;
  text_message: string;
  executive_brief: string;
}

export interface SalesmanResult extends DetectiveResult {
  pitchVariants: PitchVariants;
  selectedPitch: string;
  varFitScore: VARFitScore;
  pitchContext: PitchContext;
  briefing: string;
}

function buildProductBlock(
  brand: BrandConfig,
  profile: BusinessProfile | null,
  watchtowerConfig: WatchtowerConfig | null,
  pitchTone: string
): string {
  if (profile?.whatYouSell) {
    const keyProps = watchtowerConfig?.keyValueProps?.length
      ? `KEY VALUE PROPS FOR VARs:\n${watchtowerConfig.keyValueProps.map((p) => `- ${p}`).join("\n")}`
      : "";
    return `${brand.companyName.toUpperCase()} PRODUCT CONTEXT:
${buildProductKnowledgeBlock(profile)}

${keyProps}

Recommended pitch tone for this business: ${pitchTone}`.trim();
  }

  return `${brand.companyName.toUpperCase()} PRODUCT CONTEXT:
${brand.companyName} is the world's first real-time weight-based inventory management solution. It uses IoT smart scales to automatically track inventory by weight. No manual scanning, no barcodes, no human error. Integrates into existing ERP and WMS workflows. Ideal for warehouses, manufacturers, distributors, and physical goods businesses. VARs who add ${brand.companyName} gain a differentiated hardware+software product with strong recurring IoT subscription revenue.`;
}

async function runSalesmanSubagent(
  result: DetectiveResult,
  pitchContext: PitchContext,
  varFitScore: VARFitScore,
  briefing: string,
  brand: BrandConfig,
  productBlock: string
): Promise<SalesmanResult | null> {
  console.log(`💼 SALESMAN: Generating pitches for ${result.companyName} (fit: ${varFitScore.fitCategory} ${varFitScore.overallScore}/10)...`);

  try {
    const isHighConfidence = result.confidenceScore >= 7;

    const response = await askClaude(
      `You are a senior business development strategist for ${brand.companyName}.

${productBlock}

STRATEGIC PITCH GUIDANCE (from ${brand.companyName} context intelligence):
Hook angle: ${pitchContext.hookAngle}
Customer pain points to reference: ${pitchContext.painPoints.join("; ")}
${pitchContext.integrationAngle ? `Integration angle: ${pitchContext.integrationAngle}` : ""}
Tone: ${pitchContext.toneRecommendation}
${pitchContext.avoidMentioning.length > 0 ? `Do NOT mention: ${pitchContext.avoidMentioning.join(", ")}` : ""}

VAR FIT ASSESSMENT: ${varFitScore.fitCategory.toUpperCase()} (${varFitScore.overallScore}/10)
Why they fit: ${varFitScore.fitReasons.slice(0, 2).join("; ")}
Strategic context: ${varFitScore.strategicNotes}

YOUR TASK:
Generate FIVE outreach pitch variants for ${result.decisionMaker}, ${result.title} at ${result.companyName}.

${isHighConfidence
  ? "You have HIGH CONFIDENCE verified data — be highly specific and personalized in all five variants."
  : "You have MODERATE CONFIDENCE data — stay grounded in what is known about the company type; do not fabricate specifics."}

PERSON CONTEXT:
${result.personProfile}

COMPANY CONTEXT:
${result.companyProfile}

NEWS TRIGGER (what surfaced this lead):
"${result.newsTitle}" — ${result.newsSnippet}

PITCH RULES — all five must:
- Sound like a sharp, experienced human wrote them — not a bot or template
- Reference something specific and real about ${result.companyName} or the news trigger
- Use the hook angle from the strategic guidance above
- NEVER start with "I hope this message finds you well", "I wanted to reach out", "touching base", or any filler
- NEVER use buzzwords: "synergy", "leverage", "deep dive", "circle back", "game-changer"
- Never use em dashes (—) in any output. Use commas, periods, or restructure the sentence instead.
- Match the tone recommendation: ${pitchContext.toneRecommendation}
- End with a clear, low-pressure, specific CTA
- Sign off as ${brand.companyName} (not "Cloudbox" unless that is the company name)

VARIANTS TO GENERATE:

1. cold_email: 4–5 sentence cold email opening. Lead with the hook angle or something specific from the news trigger. Explain the ${brand.companyName} fit for their specific book of business. Close with a specific, low-pressure ask.

2. linkedin_message: 2–3 sentence LinkedIn connection request. Ultra concise, no setup, no fluff. One hook, one line on ${brand.companyName}, one soft implied ask.

3. followup_email: Follow-up assuming no response after one week. Different angle or new value prop not in the cold email. 3–4 sentences. Not apologetic.

4. text_message: 1–2 sentences max. SMS style. Casual and direct, assumes a warm intro context. No formal sign-off. Just the hook and a question.

5. executive_brief: 3 bullet points max. Boardroom style. Leads with the business case and ROI angle. Zero fluff, zero pleasantries. Each bullet is one punchy sentence. Format as plain text bullets starting with "•".

Return ONLY a JSON object (no markdown, no explanation):
{
  "cold_email": "...",
  "linkedin_message": "...",
  "followup_email": "...",
  "text_message": "...",
  "executive_brief": "..."
}`,
      `Generate pitches for ${result.companyName} — ${result.decisionMaker}`
    );

    let variants: PitchVariants;
    try {
      variants = JSON.parse(response.replace(/```json|```/g, "").trim());
    } catch {
      console.error(`[Salesman] Failed to parse pitch variants for ${result.companyName}`);
      return null;
    }

    const selectedPitch = variants.cold_email;

    const salesmanResult: SalesmanResult = {
      ...result,
      pitchVariants: variants,
      selectedPitch,
      varFitScore,
      pitchContext,
      briefing,
    };

    await saveReport({
      companyName: result.companyName,
      decisionMaker: result.decisionMaker,
      title: result.title,
      linkedinUrl: result.linkedinUrl ?? undefined,
      companyWebsite: result.companyWebsite ?? undefined,
      companyProfile: result.companyProfile,
      personProfile: result.personProfile,
      pitch: selectedPitch,
      newsTitle: result.newsTitle,
      newsSource: result.newsUrl,
      pitchVariants: variants,
      relevanceScore: result.relevanceScore,
      confidenceScore: result.confidenceScore,
      varFitScore,
      pitchContext,
      briefing,
    });

    await markCompanySeen(result.companyName);

    try {
      await deliverReport({
        companyName: result.companyName,
        decisionMaker: result.decisionMaker,
        title: result.title,
        linkedinUrl: result.linkedinUrl ?? undefined,
        companyWebsite: result.companyWebsite ?? undefined,
        companyProfile: result.companyProfile,
        personProfile: result.personProfile,
        pitch: `${briefing}\n\n---\n\n${selectedPitch}`,
        newsTitle: result.newsTitle,
        newsSource: result.newsUrl,
      });
    } catch (e) {
      console.error(`[Salesman] Failed to send report for ${result.companyName}:`, e);
    }

    return salesmanResult;
  } catch (e) {
    console.error(`[Salesman] Error processing ${result.companyName}:`, e);
    return null;
  }
}

export interface SalesmanInput {
  lead: DetectiveResult;
  varFitScore: VARFitScore;
  pitchContext: PitchContext;
  briefing: string;
}

export async function runSalesman(items: SalesmanInput[]): Promise<SalesmanResult[]> {
  console.log(`💼 SALESMAN: Generating pitches for ${items.length} profiles (max 5 concurrent)...`);

  // Hoist store reads: single read per run rather than per lead
  const [brand, profile, watchtowerConfig] = await Promise.all([
    getBrandConfig(),
    getBusinessProfile(),
    getWatchtowerConfig(),
  ]);
  const pitchTone = watchtowerConfig?.pitchTone ?? "formal";
  const productBlock = buildProductBlock(brand, profile, watchtowerConfig, pitchTone);

  const limit = createConcurrencyLimiter(5);

  const results = await Promise.all(
    items.map(({ lead, varFitScore, pitchContext, briefing }) =>
      limit(() => runSalesmanSubagent(lead, pitchContext, varFitScore, briefing, brand, productBlock))
    )
  );

  const valid = results.filter((r): r is SalesmanResult => r !== null);
  console.log(`💼 SALESMAN: Generated ${valid.length}/${items.length} pitch sets`);
  return valid;
}
