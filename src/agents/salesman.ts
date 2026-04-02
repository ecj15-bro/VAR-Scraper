// src/agents/salesman.ts — Stage 3: Generate personalized pitches and deliver the final report

import { askClaude } from "@/lib/claude";
import { sendReport } from "@/lib/email";
import { saveReport, markCompanySeen } from "@/lib/store";
import { DetectiveResult } from "./detective";
import { VARFitScore, PitchContext } from "./context";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface PitchVariants {
  cold_email: string;
  linkedin_message: string;
  followup_email: string;
}

export interface SalesmanResult extends DetectiveResult {
  pitchVariants: PitchVariants;
  selectedPitch: string;
  varFitScore: VARFitScore;
  pitchContext: PitchContext;
  briefing: string;
}

// ─── CONCURRENCY LIMITER ─────────────────────────────────────────────────────

// Limits how many subagents run simultaneously to avoid Claude rate limits.
function createConcurrencyLimiter(max: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  function next() {
    if (queue.length > 0 && running < max) {
      running++;
      queue.shift()!();
    }
  }

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      if (running < max) {
        running++;
        resolve();
      } else {
        queue.push(resolve);
      }
    });

    try {
      return await fn();
    } finally {
      running--;
      next();
    }
  };
}

// ─── SUBAGENT ───────────────────────────────────────────────────────────────

// Handles one profile: generates 3 pitch variants using ContextAgent guidance,
// saves to store, and delivers the report.
async function runSalesmanSubagent(
  result: DetectiveResult,
  pitchContext: PitchContext,
  varFitScore: VARFitScore,
  briefing: string
): Promise<SalesmanResult | null> {
  console.log(`💼 SALESMAN: Generating pitches for ${result.companyName} (fit: ${varFitScore.fitCategory} ${varFitScore.overallScore}/10)...`);

  try {
    const isHighConfidence = result.confidenceScore >= 7;

    const response = await askClaude(
      `You are a senior business development strategist for Cloudbox (cloudboxapp.com).

CLOUDBOX PRODUCT CONTEXT:
Cloudbox is the world's first real-time weight-based inventory management solution. It uses IoT smart scales to automatically track inventory by weight — no manual scanning, no barcodes, no human error. Integrates into existing ERP and WMS workflows. Ideal for warehouses, manufacturers, distributors, and physical goods businesses. VARs who add Cloudbox gain a differentiated hardware+software product with strong recurring IoT subscription revenue.

STRATEGIC PITCH GUIDANCE (from Cloudbox context intelligence):
Hook angle: ${pitchContext.hookAngle}
Customer pain points to reference: ${pitchContext.painPoints.join("; ")}
${pitchContext.integrationAngle ? `Integration angle: ${pitchContext.integrationAngle}` : ""}
Tone: ${pitchContext.toneRecommendation}
${pitchContext.avoidMentioning.length > 0 ? `Do NOT mention: ${pitchContext.avoidMentioning.join(", ")}` : ""}

VAR FIT ASSESSMENT: ${varFitScore.fitCategory.toUpperCase()} (${varFitScore.overallScore}/10)
Why they fit: ${varFitScore.fitReasons.slice(0, 2).join("; ")}
Strategic context: ${varFitScore.strategicNotes}

YOUR TASK:
Generate THREE outreach pitch variants for ${result.decisionMaker}, ${result.title} at ${result.companyName}.

${
  isHighConfidence
    ? "You have HIGH CONFIDENCE verified data — be highly specific and personalized in all three variants."
    : "You have MODERATE CONFIDENCE data — stay grounded in what is known about the company type; do not fabricate specifics."
}

PERSON CONTEXT:
${result.personProfile}

COMPANY CONTEXT:
${result.companyProfile}

NEWS TRIGGER (what surfaced this lead):
"${result.newsTitle}" — ${result.newsSnippet}

PITCH RULES — all three must:
- Sound like a sharp, experienced human wrote them — not a bot or template
- Reference something specific and real about ${result.companyName} or the news trigger
- Use the hook angle from the strategic guidance above
- NEVER start with "I hope this message finds you well", "I wanted to reach out", "touching base", or any filler
- NEVER use buzzwords: "synergy", "leverage", "deep dive", "circle back", "game-changer"
- Match the tone recommendation: ${pitchContext.toneRecommendation}
- End with a clear, low-pressure, specific CTA

VARIANTS TO GENERATE:

1. cold_email: 4–5 sentence cold email opening. Lead with the hook angle or something specific from the news trigger. Explain the Cloudbox fit for their specific book of business. Close with a specific, low-pressure ask.

2. linkedin_message: 2–3 sentence LinkedIn connection request. Ultra concise — no setup, no fluff. One hook, one line on Cloudbox, one soft implied ask.

3. followup_email: Follow-up assuming no response after one week. Different angle or new value prop not in the cold email. 3–4 sentences. Not apologetic.

Return ONLY a JSON object (no markdown, no explanation):
{
  "cold_email": "...",
  "linkedin_message": "...",
  "followup_email": "..."
}`,
      `Generate pitches for ${result.companyName} — ${result.decisionMaker}`
    );

    let variants: PitchVariants;
    try {
      const cleaned = response.replace(/```json|```/g, "").trim();
      variants = JSON.parse(cleaned);
    } catch {
      console.error(`[Salesman] Failed to parse pitch variants for ${result.companyName}`);
      return null;
    }

    // cold_email is the default selected pitch; user can switch in the UI
    const selectedPitch = variants.cold_email;

    const salesmanResult: SalesmanResult = {
      ...result,
      pitchVariants: variants,
      selectedPitch,
      varFitScore,
      pitchContext,
      briefing,
    };

    // Persist to store before delivery — data is never lost if the send fails
    saveReport({
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

    markCompanySeen(result.companyName);

    // Deliver report — include briefing at the top of the pitch for Teams visibility
    try {
      const pitchWithBriefing = `${briefing}\n\n---\n\n${selectedPitch}`;
      await sendReport({
        companyName: result.companyName,
        decisionMaker: result.decisionMaker,
        title: result.title,
        linkedinUrl: result.linkedinUrl ?? undefined,
        companyWebsite: result.companyWebsite ?? undefined,
        companyProfile: result.companyProfile,
        personProfile: result.personProfile,
        pitch: pitchWithBriefing,
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

// ─── PARENT AGENT ───────────────────────────────────────────────────────────

export interface SalesmanInput {
  lead: DetectiveResult;
  varFitScore: VARFitScore;
  pitchContext: PitchContext;
  briefing: string;
}

// Spawns all salesman subagents in parallel with a concurrency cap of 5.
export async function runSalesman(items: SalesmanInput[]): Promise<SalesmanResult[]> {
  console.log(`💼 SALESMAN: Generating pitches for ${items.length} profiles (max 5 concurrent)...`);

  const limit = createConcurrencyLimiter(5);

  const salesResults = await Promise.all(
    items.map(({ lead, varFitScore, pitchContext, briefing }) =>
      limit(() => runSalesmanSubagent(lead, pitchContext, varFitScore, briefing))
    )
  );

  const valid = salesResults.filter((r): r is SalesmanResult => r !== null);
  console.log(`💼 SALESMAN: Generated ${valid.length}/${items.length} pitch sets`);
  return valid;
}
