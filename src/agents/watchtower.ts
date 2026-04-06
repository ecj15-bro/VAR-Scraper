// src/agents/watchtower.ts — Stage 1: Find and score VAR partnership leads from the web

import { searchNews, SearchResult } from "@/lib/search";
import { askClaude } from "@/lib/claude";
import {
  hasSeenCompany,
  getSearchHistory,
  getSeenCompanies,
  saveSearchHistory,
  saveSearchEvolution,
  getKnowledgeBase,
  EvolvedSearchParams,
} from "@/lib/store";
import { evolveSearchParameters } from "./context";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface ScoredLead {
  companyName: string;
  newsTitle: string;
  newsSnippet: string;
  newsUrl: string;
  newsSource: string;
  relevanceScore: number;
}

export interface WatchtowerResult {
  leads: ScoredLead[];
  searchEvolution: EvolvedSearchParams;
  queriesRetired: number;
  queriesAdded: number;
}

interface ActiveQuery {
  query: string;
  category: string;
  saturated: boolean;
}

// ─── SEARCH CATEGORY DEFINITIONS ─────────────────────────────────────────────

interface SearchCategory {
  name: string;
  dailyQueries: string[];
  backfillQueries: string[];
}

// Daily queries total: 1+1+1+1+2+2 = 8
// Backfill queries total: 3+3+2+2+3+2 = 15
const SEARCH_CATEGORIES: SearchCategory[] = [
  {
    name: "IT/MSP partnerships",
    dailyQueries: [
      "IT reseller MSP partnership announcement 2026",
    ],
    backfillQueries: [
      "IT reseller MSP partnership announcement March 2026",
      "MSP technology partner program expansion February 2026",
      "IT managed services reseller deal Q1 2026",
    ],
  },
  {
    name: "Cloud reseller deals",
    dailyQueries: [
      "cloud reseller distributor partnership deal 2026",
    ],
    backfillQueries: [
      "cloud solutions reseller new partnership March 2026",
      "cloud distributor vendor agreement February 2026",
      "SaaS cloud reseller channel deal Q1 2026",
    ],
  },
  {
    name: "Inventory and warehouse tech",
    dailyQueries: [
      "inventory warehouse technology partnership reseller",
    ],
    backfillQueries: [
      "inventory management technology partnership 2026",
      "warehouse tech reseller agreement March 2026",
    ],
  },
  {
    name: "Supply chain tech resellers",
    dailyQueries: [
      "supply chain technology reseller news 2026",
    ],
    backfillQueries: [
      "supply chain technology reseller partnership March 2026",
      "logistics tech reseller agreement February 2026",
    ],
  },
  {
    name: "VAR/channel partner programs",
    dailyQueries: [
      "VAR channel partner program expansion 2026",
      "value added reseller new vendor program announcement",
    ],
    backfillQueries: [
      "VAR value added reseller program expansion March 2026",
      "channel partner new vendor agreement February 2026",
      "reseller partner program launch Q1 2026",
    ],
  },
  {
    name: "Hardware/software reseller agreements",
    dailyQueries: [
      "hardware software reseller vendor agreement 2026",
      "technology reseller distributor new deal announcement",
    ],
    backfillQueries: [
      "hardware reseller vendor agreement March 2026",
      "software distributor reseller deal February 2026",
    ],
  },
];

// ─── CONCURRENCY LIMITER ─────────────────────────────────────────────────────

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
      if (running < max) { running++; resolve(); }
      else { queue.push(resolve); }
    });
    try { return await fn(); }
    finally { running--; next(); }
  };
}

// ─── SCORING ────────────────────────────────────────────────────────────────

async function scoreBatch(
  batch: SearchResult[]
): Promise<{ index: number; companyName: string; relevanceScore: number }[]> {
  const snippets = batch
    .map(
      (r, i) =>
        `[${i}] TITLE: ${r.title}\nSOURCE: ${r.source ?? r.link}\nSNIPPET: ${r.snippet}\nURL: ${r.link}`
    )
    .join("\n\n");

  const response = await askClaude(
    `You are a business development analyst for Cloudbox (cloudboxapp.com), which offers the world's first real-time weight-based inventory management solution using IoT smart scales — no manual scanning, no human error. Ideal for warehouses, manufacturers, distributors, and physical goods businesses.

Score each news article for VAR (Value Added Reseller) partnership relevance. High-scoring companies are:
- IT/MSP companies (Managed Service Providers) expanding their offering
- Cloud solutions resellers or distributors
- Technology distributors dealing in hardware/software
- Companies handling physical inventory, warehousing, or supply chain tech
- Hardware/software resellers who could bundle Cloudbox into their offering
- Companies forming new vendor relationships or expanding their product portfolio

Score 0-10 where:
- 8-10: Clearly a VAR candidate actively expanding offerings or forming reseller partnerships
- 6-7: Likely a reseller/MSP/distributor with relevant context
- 4-5: Possibly relevant but unclear business model
- 0-3: Not a VAR candidate (news outlet, end-user company, consumer brand, unrelated business)

Return ONLY a JSON array (no markdown, no explanation). Include an entry for every index provided:
[{"index": 0, "companyName": "Acme IT Solutions", "relevanceScore": 8}]`,
    `Score these news results for Cloudbox VAR partnership relevance:\n\n${snippets}`
  );

  try {
    const cleaned = response.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    console.error("[Watchtower] Failed to parse scoring response");
    return [];
  }
}

// ─── DEFAULT EVOLUTION ────────────────────────────────────────────────────────

const DEFAULT_EVOLUTION: EvolvedSearchParams = {
  retireQueries: [],
  addQueries: [],
  hotVerticalQueries: [],
  ecosystemQueries: [],
  saturatedQueries: [],
  evolutionRationale: "Search evolution skipped this run.",
};

// ─── PARENT AGENT ────────────────────────────────────────────────────────────

export async function runWatchtower(backfill: boolean): Promise<WatchtowerResult> {
  console.log(`🔭 WATCHTOWER: Starting ${backfill ? "backfill" : "daily"} scan across ${SEARCH_CATEGORIES.length} categories...`);

  // ── Load context for evolution ───────────────────────────────────────────
  const searchHistory = getSearchHistory();
  const kb = getKnowledgeBase();
  const seenCompanies = getSeenCompanies();

  // ── Build current query list from SEARCH_CATEGORIES ──────────────────────
  const currentQueries: string[] = [];
  for (const cat of SEARCH_CATEGORIES) {
    const qs = backfill ? cat.backfillQueries : cat.dailyQueries;
    currentQueries.push(...qs);
  }

  // ── Evolve search parameters ──────────────────────────────────────────────
  let evolution = DEFAULT_EVOLUTION;
  try {
    evolution = await evolveSearchParameters(currentQueries, searchHistory, kb, seenCompanies);
    const added = evolution.addQueries.length + evolution.hotVerticalQueries.length + evolution.ecosystemQueries.length;
    console.log(`🔭 WATCHTOWER [evolution]: ${added} queries added, ${evolution.retireQueries.length} retired, ${evolution.saturatedQueries.length} saturating`);
    if (evolution.evolutionRationale) {
      console.log(`🔭 WATCHTOWER [evolution]: ${evolution.evolutionRationale}`);
    }
    saveSearchEvolution(evolution);
  } catch (e) {
    console.error("[Watchtower] Search evolution failed, using current queries:", e);
  }

  // ── Build active query list ───────────────────────────────────────────────
  const retireSet = new Set(evolution.retireQueries);
  const saturatedSet = new Set(evolution.saturatedQueries);
  const activeQueries: ActiveQuery[] = [];

  for (const cat of SEARCH_CATEGORIES) {
    const qs = backfill ? cat.backfillQueries : cat.dailyQueries;
    for (const q of qs) {
      if (!retireSet.has(q)) {
        activeQueries.push({ query: q, category: cat.name, saturated: saturatedSet.has(q) });
      }
    }
  }

  const existingSet = new Set(activeQueries.map((q) => q.query));
  const evolvedToAdd = [
    ...evolution.addQueries,
    ...evolution.hotVerticalQueries,
    ...evolution.ecosystemQueries,
  ];
  for (const q of evolvedToAdd) {
    if (!existingSet.has(q)) {
      activeQueries.push({ query: q, category: "evolved", saturated: false });
      existingSet.add(q);
    }
  }

  const currentSet = new Set(currentQueries);
  const queriesRetired = evolution.retireQueries.filter((q) => currentSet.has(q)).length;
  const queriesAdded = evolvedToAdd.filter((q) => !currentSet.has(q)).length;

  if (saturatedSet.size > 0) {
    console.log(`🔭 WATCHTOWER [evolution]: Saturating queries (still running): ${Array.from(saturatedSet).join(", ")}`);
  }

  console.log(`🔭 WATCHTOWER: Running ${activeQueries.length} active queries (${queriesRetired} retired, ${queriesAdded} added by evolution)`);

  if (activeQueries.length === 0) {
    return { leads: [], searchEvolution: evolution, queriesRetired, queriesAdded };
  }

  // ── Run all queries with concurrency limit ────────────────────────────────
  const limitSearch = createConcurrencyLimiter(5);

  const queryRuns: { aq: ActiveQuery; results: SearchResult[] }[] = await Promise.all(
    activeQueries.map((aq) =>
      limitSearch(async () => {
        try {
          const results = await searchNews(aq.query, 5);
          return { aq, results };
        } catch (e) {
          console.error(`[Watchtower] Search failed for "${aq.query}":`, e);
          return { aq, results: [] as SearchResult[] };
        }
      })
    )
  );

  // ── Build URL attribution map and deduplicate ─────────────────────────────
  const urlToQueries = new Map<string, string[]>();
  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const { aq, results } of queryRuns) {
    for (const r of results) {
      if (!urlToQueries.has(r.link)) urlToQueries.set(r.link, []);
      urlToQueries.get(r.link)!.push(aq.query);
      if (!seenUrls.has(r.link)) {
        seenUrls.add(r.link);
        allResults.push(r);
      }
    }
  }

  console.log(`🔭 WATCHTOWER: Deduped to ${allResults.length} unique results, scoring...`);

  if (allResults.length === 0) {
    return { leads: [], searchEvolution: evolution, queriesRetired, queriesAdded };
  }

  // ── Score in batches of 20 ────────────────────────────────────────────────
  const BATCH_SIZE = 20;
  const allScored: { index: number; companyName: string; relevanceScore: number }[] = [];

  for (let i = 0; i < allResults.length; i += BATCH_SIZE) {
    const batch = allResults.slice(i, i + BATCH_SIZE);
    try {
      const batchScores = await scoreBatch(batch);
      allScored.push(...batchScores.map((s) => ({ ...s, index: s.index + i })));
    } catch (e) {
      console.error(`[Watchtower] Failed to score batch starting at index ${i}:`, e);
    }
  }

  // ── Filter qualified leads ────────────────────────────────────────────────
  const leads: ScoredLead[] = allScored
    .filter((s) => s.relevanceScore >= 6 && s.index < allResults.length)
    .filter((s) => !hasSeenCompany(s.companyName))
    .map((s) => {
      const r = allResults[s.index];
      return {
        companyName: s.companyName,
        newsTitle: r.title,
        newsSnippet: r.snippet,
        newsUrl: r.link,
        newsSource: r.source ?? r.link,
        relevanceScore: s.relevanceScore,
      };
    });

  console.log(`🔭 WATCHTOWER: ${leads.length} qualified leads (score >= 6, not previously seen)`);

  // ── Save search history per query ─────────────────────────────────────────
  const now = new Date().toISOString();

  for (const { aq, results } of queryRuns) {
    const queryUrlSet = new Set(results.map((r) => r.link));
    const attributedLeads = leads.filter((l) => queryUrlSet.has(l.newsUrl));
    const avgScore =
      attributedLeads.length > 0
        ? Math.round(
            (attributedLeads.reduce((sum, l) => sum + l.relevanceScore, 0) / attributedLeads.length) * 10
          ) / 10
        : 0;

    saveSearchHistory({
      id: crypto.randomUUID(),
      timestamp: now,
      query: aq.query,
      category: aq.category,
      resultsCount: results.length,
      qualifiedLeadsCount: attributedLeads.length,
      avgRelevanceScore: avgScore,
      companiesFound: attributedLeads.map((l) => l.companyName),
    });
  }

  return { leads, searchEvolution: evolution, queriesRetired, queriesAdded };
}
