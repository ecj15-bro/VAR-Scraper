// src/agents/watchtower.ts — Stage 1: Find and score VAR partnership leads from the web

import { searchNews, SearchResult } from "@/lib/search";
import { askClaude } from "@/lib/claude";
import { hasSeenCompany } from "@/lib/store";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface ScoredLead {
  companyName: string;
  newsTitle: string;
  newsSnippet: string;
  newsUrl: string;
  newsSource: string;
  relevanceScore: number;
}

// ─── SEARCH CATEGORIES ──────────────────────────────────────────────────────

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

// ─── SUBAGENT ───────────────────────────────────────────────────────────────

// Handles one search category. Returns raw search results.
async function runWatchtowerSubagent(
  category: SearchCategory,
  backfill: boolean
): Promise<SearchResult[]> {
  const queries = backfill ? category.backfillQueries : category.dailyQueries;
  const results: SearchResult[] = [];

  for (const query of queries) {
    try {
      const r = await searchNews(query, 5);
      results.push(...r);
    } catch (e) {
      console.error(`[Watchtower:${category.name}] Search failed for "${query}":`, e);
    }
  }

  return results;
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

// ─── PARENT AGENT ───────────────────────────────────────────────────────────

// Spawns all category subagents in parallel, deduplicates, scores in batches,
// and returns only high-relevance leads not already in the store.
export async function runWatchtower(backfill: boolean): Promise<ScoredLead[]> {
  console.log(`🔭 WATCHTOWER: Starting ${backfill ? "backfill" : "daily"} scan across ${SEARCH_CATEGORIES.length} categories...`);

  // Spawn all category subagents in parallel
  const categoryResults = await Promise.all(
    SEARCH_CATEGORIES.map((cat) => runWatchtowerSubagent(cat, backfill))
  );

  // Flatten and deduplicate by URL
  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();
  for (const results of categoryResults) {
    for (const r of results) {
      if (!seenUrls.has(r.link)) {
        seenUrls.add(r.link);
        allResults.push(r);
      }
    }
  }

  console.log(`🔭 WATCHTOWER: Deduped to ${allResults.length} unique results, scoring...`);

  if (allResults.length === 0) return [];

  // Score in batches of 20
  const BATCH_SIZE = 20;
  const allScored: { index: number; companyName: string; relevanceScore: number }[] = [];

  for (let i = 0; i < allResults.length; i += BATCH_SIZE) {
    const batch = allResults.slice(i, i + BATCH_SIZE);
    try {
      const batchScores = await scoreBatch(batch);
      // Remap batch-local indices to global positions
      allScored.push(...batchScores.map((s) => ({ ...s, index: s.index + i })));
    } catch (e) {
      console.error(`[Watchtower] Failed to score batch starting at index ${i}:`, e);
    }
  }

  // Filter to score >= 6 and not already seen in the store
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

  console.log(`🔭 WATCHTOWER: ${leads.length} qualified leads (score ≥ 6, not previously seen)`);
  return leads;
}
