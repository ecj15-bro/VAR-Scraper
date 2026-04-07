// src/agents/orchestrator.ts — Top-level coordinator. Replaces runPipeline().
// All API routes import runOrchestrator from here.
//
// Pipeline flow:
//   Watchtower → Context (pre-filter) → Detective → Context (re-score + enrich) → Salesman

import { runWatchtower, ScoredLead, WatchtowerResult } from "./watchtower";
import { EvolvedSearchParams } from "@/lib/store";
import { runDetective, DetectiveResult } from "./detective";
import { runSalesman, SalesmanResult, SalesmanInput } from "./salesman";
import { createConcurrencyLimiter } from "@/lib/concurrency";
import {
  scoreVARFit,
  enrichPitchContext,
  isWorthPursuing,
  generateBriefing,
  VARFitScore,
  PitchContext,
} from "./context";

// ─── TYPES ──────────────────────────────────────────────────────────────────

const DEFAULT_EVOLUTION: EvolvedSearchParams = {
  retireQueries: [],
  addQueries: [],
  hotVerticalQueries: [],
  ecosystemQueries: [],
  saturatedQueries: [],
  evolutionRationale: "Search evolution unavailable this run.",
};

export interface OrchestratorResult {
  processed: number;
  skipped: number;
  contextFiltered: number;
  errors: number;
  reports: SalesmanResult[];
  totalLeadsFound: number;
  avgRelevanceScore: number;
  searchEvolution: EvolvedSearchParams;
  queriesRetired: number;
  queriesAdded: number;
}

// ─── ORCHESTRATOR ───────────────────────────────────────────────────────────

export async function runOrchestrator(
  options: { dryRun?: boolean; backfill?: boolean } = {}
): Promise<OrchestratorResult> {
  const { dryRun = false, backfill = false } = options;

  console.log(
    `🎯 ORCHESTRATOR: Starting ${backfill ? "backfill" : "daily"} run${dryRun ? " (DRY RUN)" : ""}...`
  );

  let contextFiltered = 0;

  // ── Stage 1: Watchtower ──────────────────────────────────────────────────
  let watchtowerResult: WatchtowerResult = {
    leads: [],
    searchEvolution: DEFAULT_EVOLUTION,
    queriesRetired: 0,
    queriesAdded: 0,
  };
  try {
    watchtowerResult = await runWatchtower(backfill);
  } catch (e) {
    console.error("[Orchestrator] Watchtower stage failed:", e);
  }
  const { leads, searchEvolution, queriesRetired, queriesAdded } = watchtowerResult;

  const totalLeadsFound = leads.length;
  const avgRelevanceScore =
    leads.length > 0
      ? Math.round(
          (leads.reduce((sum, l) => sum + l.relevanceScore, 0) / leads.length) * 10
        ) / 10
      : 0;

  console.log(
    `🎯 ORCHESTRATOR: ${totalLeadsFound} leads found, avg relevance score ${avgRelevanceScore}`
  );
  leads.forEach((l) =>
    console.log(`  • ${l.companyName} (relevance: ${l.relevanceScore})`)
  );

  if (leads.length === 0) {
    return {
      processed: 0, skipped: 0, contextFiltered: 0, errors: 0,
      reports: [], totalLeadsFound: 0, avgRelevanceScore: 0,
      searchEvolution, queriesRetired, queriesAdded,
    };
  }

  if (dryRun) {
    console.log("[Orchestrator] Dry run — stopping after Watchtower");
    return {
      processed: 0, skipped: leads.length, contextFiltered: 0, errors: 0,
      reports: [], totalLeadsFound, avgRelevanceScore,
      searchEvolution, queriesRetired, queriesAdded,
    };
  }

  // ── Context Gate 1: Pre-filter before Detective ──────────────────────────
  // Score from name + news only — saves Detective API calls on obvious misses.
  console.log(`⚡ CONTEXT: Pre-scoring ${leads.length} leads before Detective...`);

  const prescore = createConcurrencyLimiter(5);
  const preFitScores = await Promise.all(
    leads.map((lead) =>
      prescore(() =>
        scoreVARFit(
          lead.companyName,
          "",
          "",
          `${lead.newsTitle}: ${lead.newsSnippet}`
        )
      ).catch((e) => {
        console.error(`[Orchestrator] Pre-score failed for ${lead.companyName}:`, e);
        return null;
      })
    )
  );

  const qualifiedLeads = leads.filter((lead, i) => {
    const score = preFitScores[i];
    if (!score) return true; // If scoring failed, give it the benefit of the doubt
    const pass = isWorthPursuing(score);
    if (!pass) {
      console.log(
        `⚡ CONTEXT [gate 1]: Dropping ${lead.companyName} — score ${score.overallScore}/10 (${score.fitCategory})`
      );
      contextFiltered++;
    }
    return pass;
  });

  console.log(
    `⚡ CONTEXT [gate 1]: ${qualifiedLeads.length} leads pass, ${contextFiltered} dropped`
  );

  if (qualifiedLeads.length === 0) {
    return {
      processed: 0, skipped: 0, contextFiltered, errors: 0,
      reports: [], totalLeadsFound, avgRelevanceScore,
      searchEvolution, queriesRetired, queriesAdded,
    };
  }

  // ── Stage 2: Detective ───────────────────────────────────────────────────
  let detectiveResults: DetectiveResult[] = [];
  try {
    detectiveResults = await runDetective(qualifiedLeads);
  } catch (e) {
    console.error("[Orchestrator] Detective stage failed:", e);
  }

  const detectiveErrors = qualifiedLeads.length - detectiveResults.length;

  // ── Context Gate 2: Re-score with full profiles + enrich pitch context ───
  // Now we have companyProfile and personProfile — this is a much richer scoring pass.
  console.log(`⚡ CONTEXT: Re-scoring ${detectiveResults.length} leads with full profiles...`);

  const enrich = createConcurrencyLimiter(5);
  const enrichedItems = await Promise.all(
    detectiveResults.map(
      (result): Promise<SalesmanInput | null> => enrich(async () => {
        try {
          // Re-score with full data
          const varFitScore = await scoreVARFit(
            result.companyName,
            result.companyProfile,
            result.personProfile,
            `${result.newsTitle}: ${result.newsSnippet}`
          );

          if (!isWorthPursuing(varFitScore)) {
            console.log(
              `⚡ CONTEXT [gate 2]: Dropping ${result.companyName} — score ${varFitScore.overallScore}/10 (${varFitScore.fitCategory})`
            );
            contextFiltered++;
            return null;
          }

          // Enrich pitch context (requires varFitScore result)
          const pitchContext = await enrichPitchContext(
            result.companyName,
            result.companyProfile,
            result.personProfile,
            varFitScore
          );

          // Generate briefing synchronously — no extra API call needed
          const briefing = generateBriefing(
            { companyName: result.companyName, decisionMaker: result.decisionMaker },
            varFitScore,
            pitchContext
          );

          console.log(
            `⚡ CONTEXT: ${result.companyName} — ${varFitScore.fitCategory} fit (${varFitScore.overallScore}/10), tone: ${pitchContext.toneRecommendation}`
          );

          return { lead: result, varFitScore, pitchContext, briefing };
        } catch (e) {
          console.error(
            `[Orchestrator] Context enrichment failed for ${result.companyName}:`,
            e
          );
          return null;
        }
      })
    )
  );

  const salesmanItems = enrichedItems.filter(
    (item): item is SalesmanInput => item !== null
  );

  console.log(
    `⚡ CONTEXT [gate 2]: ${salesmanItems.length} leads pass, ${detectiveResults.length - salesmanItems.length} dropped`
  );

  if (salesmanItems.length === 0) {
    return {
      processed: 0, skipped: 0, contextFiltered, errors: detectiveErrors,
      reports: [], totalLeadsFound, avgRelevanceScore,
      searchEvolution, queriesRetired, queriesAdded,
    };
  }

  // ── Stage 3: Salesman ────────────────────────────────────────────────────
  let salesmanResults: SalesmanResult[] = [];
  try {
    salesmanResults = await runSalesman(salesmanItems);
  } catch (e) {
    console.error("[Orchestrator] Salesman stage failed:", e);
  }

  const salesmanErrors = salesmanItems.length - salesmanResults.length;

  const result: OrchestratorResult = {
    processed: salesmanResults.length,
    skipped: 0,
    contextFiltered,
    errors: detectiveErrors + salesmanErrors,
    reports: salesmanResults,
    totalLeadsFound,
    avgRelevanceScore,
    searchEvolution,
    queriesRetired,
    queriesAdded,
  };

  console.log(
    `🎯 ORCHESTRATOR: Done. ${result.processed} reports generated, ${result.contextFiltered} filtered by context gate, ${result.errors} errors.`
  );
  return result;
}
