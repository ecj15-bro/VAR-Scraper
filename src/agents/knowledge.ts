// src/agents/knowledge.ts — Self-updating knowledge agent.
// Maintains a persistent, auto-updating brief about Cloudbox, its industry,
// competitors, and the VAR market. Runs on its own 6am cron and can be
// triggered manually from the dashboard.
//
// Other agents do NOT call this — they read the persisted output via getKnowledgeBase().

import { searchNews, searchWeb, SearchResult } from "@/lib/search";
import { askClaude } from "@/lib/claude";
import { saveKnowledgeBase, getKnowledgeBase, KnowledgeBase } from "@/lib/store";

// ─── SEARCH CATEGORY DEFINITIONS ─────────────────────────────────────────────

interface ResearchCategory {
  name: string;
  newsQueries: string[];
  webQueries: string[];
  fetchUrls?: string[];
}

const RESEARCH_CATEGORIES: ResearchCategory[] = [
  {
    name: "cloudbox_brand",
    newsQueries: [
      "cloudboxapp.com news 2026",
      "Cloudbox inventory management new features 2026",
      "Cloudbox weight based inventory press release",
    ],
    webQueries: [
      "Cloudbox IoT smart scales inventory management review",
    ],
    fetchUrls: [
      "https://cloudboxapp.com",
      "https://cloudboxapp.com/blog",
    ],
  },
  {
    name: "industry_trends",
    newsQueries: [
      "inventory management technology trends 2026",
      "warehouse IoT sensor market growth 2026",
      "real time inventory tracking industry news",
      "smart warehouse technology adoption 2026",
    ],
    webQueries: [],
  },
  {
    name: "competitor_intel",
    newsQueries: [
      "weight based inventory management competitors 2026",
      "automated inventory tracking solutions 2026",
      "IoT inventory management new products 2026",
    ],
    webQueries: [],
  },
  {
    name: "partner_ecosystem",
    newsQueries: [
      "NetSuite partner program new resellers 2026",
      "Fishbowl inventory reseller news 2026",
      "Cin7 channel partner announcements 2026",
      "Ingram Micro TD SYNNEX new vendor 2026",
      "Microsoft Dynamics reseller partnership 2026",
    ],
    webQueries: [],
  },
  {
    name: "var_market",
    newsQueries: [
      "IT channel partner trends 2026",
      "MSP expanding services inventory 2026",
      "VAR adding hardware IoT practice 2026",
    ],
    webQueries: [],
  },
];

// ─── WEB PAGE FETCHER ────────────────────────────────────────────────────────

// Fetches a URL and strips HTML to plain text. Used for cloudboxapp.com pages.
async function fetchPageText(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CloudboxIntelligence/1.0; research bot)",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return "";

    const html = await res.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 2000);

    return text;
  } catch {
    return "";
  }
}

// ─── SUBAGENT ────────────────────────────────────────────────────────────────

interface SubagentResult {
  category: string;
  searchResults: SearchResult[];
  pageTexts: string[];
}

async function runKnowledgeSubagent(
  category: ResearchCategory
): Promise<SubagentResult> {
  console.log(`📚 KNOWLEDGE [${category.name}]: Researching...`);

  const searchResults: SearchResult[] = [];

  // Run all searches in parallel within this category
  const newsPromises = category.newsQueries.map((q) =>
    searchNews(q, 5).catch((e) => {
      console.error(`[Knowledge:${category.name}] News search failed for "${q}":`, e);
      return [] as SearchResult[];
    })
  );

  const webPromises = category.webQueries.map((q) =>
    searchWeb(q, 5).catch((e) => {
      console.error(`[Knowledge:${category.name}] Web search failed for "${q}":`, e);
      return [] as SearchResult[];
    })
  );

  const fetchPromises = (category.fetchUrls ?? []).map((url) =>
    fetchPageText(url)
  );

  const [newsResults, webResults, pageTexts] = await Promise.all([
    Promise.all(newsPromises),
    Promise.all(webPromises),
    Promise.all(fetchPromises),
  ]);

  for (const r of newsResults) searchResults.push(...r);
  for (const r of webResults) searchResults.push(...r);

  console.log(
    `📚 KNOWLEDGE [${category.name}]: ${searchResults.length} results, ${pageTexts.filter(Boolean).length} pages fetched`
  );

  return { category: category.name, searchResults, pageTexts: pageTexts.filter(Boolean) };
}

// ─── SYNTHESIS ───────────────────────────────────────────────────────────────

// Formats research results into a prompt-friendly block, capped per category
// to keep the synthesis prompt within Claude's context window.
function formatResultsForSynthesis(subagentResults: SubagentResult[]): string {
  return subagentResults
    .map(({ category, searchResults, pageTexts }) => {
      const resultsText = searchResults
        .slice(0, 15)
        .map(
          (r) => `  • [${r.source ?? r.link}] ${r.title}\n    ${r.snippet}`
        )
        .join("\n");

      const pagesText = pageTexts
        .map((t, i) => `  [Page ${i + 1}]: ${t.slice(0, 800)}`)
        .join("\n");

      return (
        `=== ${category.toUpperCase().replace("_", " ")} ===\n` +
        (resultsText || "  (no results)") +
        (pagesText ? `\n\nFETCHED PAGE CONTENT:\n${pagesText}` : "")
      );
    })
    .join("\n\n");
}

async function synthesizeKnowledgeBase(
  subagentResults: SubagentResult[],
  previousKB: KnowledgeBase | null
): Promise<KnowledgeBase> {
  const researchText = formatResultsForSynthesis(subagentResults);
  const prevSummary = previousKB
    ? `Previous knowledge base (from ${previousKB.lastRefreshed}):\n` +
      `- Last insights: ${previousKB.lastInsights}\n` +
      `- Hot verticals: ${previousKB.hotVerticals.join(", ")}\n` +
      `- Cold verticals: ${previousKB.coldVerticals.join(", ")}\n` +
      `- Cloudbox updates count: ${previousKB.cloudboxUpdates.length} items`
    : "No previous knowledge base — this is the first refresh.";

  const response = await askClaude(
    `You are a Cloudbox market intelligence analyst. Your job is to synthesize web research into a living intelligence brief that helps the Cloudbox sales team find and target VAR (Value Added Reseller) partners more effectively.

Cloudbox context: Cloudbox offers the world's first real-time weight-based inventory management solution using IoT smart scales. It sells through VARs and resellers who serve warehouses, manufacturers, distributors, and physical goods businesses.

${prevSummary}

INSTRUCTIONS:
- Extract and synthesize the most relevant insights from the research below
- Explicitly note what appears NEW or CHANGED compared to the previous cycle
- hotVerticals: verticals showing the STRONGEST current signals for VAR sales (active news, growth, partner activity)
- coldVerticals: verticals showing WEAK signals, oversaturation, or budget freeze signals
- refinedIdealVARProfile: an evolving description of the ideal Cloudbox VAR based on all current data
- lastInsights: 3-4 sentence executive summary of what changed this cycle and what it means for Cloudbox VAR outreach

Return ONLY a JSON object (no markdown, no explanation). All arrays must have at least 1 item:
{
  "lastRefreshed": "${new Date().toISOString()}",
  "cloudboxUpdates": ["Any new features, customer wins, press releases, or positioning changes found"],
  "industryTrends": ["Key industry trends that affect Cloudbox sales opportunities"],
  "competitorIntel": ["What competitors are doing, new products, pricing moves, positioning"],
  "partnerEcosystem": ["Updates on NetSuite, Fishbowl, Ingram Micro and other key partners"],
  "varMarketSignals": ["Signals about the VAR market — new practices being added, budget trends, hiring signals"],
  "refinedIdealVARProfile": "2-3 sentence description of the ideal Cloudbox VAR right now based on current market data",
  "hotVerticals": ["Vertical 1", "Vertical 2"],
  "coldVerticals": ["Vertical A"],
  "lastInsights": "3-4 sentence executive summary of what changed this cycle and what it means for outreach"
}`,
    `Here is the research gathered this cycle:\n\n${researchText}`
  );

  try {
    const cleaned = response.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as KnowledgeBase;
    // Ensure timestamp is always fresh
    parsed.lastRefreshed = new Date().toISOString();
    return parsed;
  } catch {
    console.error("[Knowledge] Failed to parse synthesis response — returning minimal KB");
    return {
      lastRefreshed: new Date().toISOString(),
      cloudboxUpdates: ["Knowledge refresh synthesis failed — raw data was collected but could not be parsed"],
      industryTrends: [],
      competitorIntel: [],
      partnerEcosystem: [],
      varMarketSignals: [],
      refinedIdealVARProfile:
        "Could not synthesize VAR profile — default knowledge base in use.",
      hotVerticals: [],
      coldVerticals: [],
      lastInsights:
        "Knowledge refresh ran but the synthesis step failed to parse. Raw research was collected. Please retry or check logs.",
    };
  }
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

// Runs all research subagents in parallel, synthesizes with Claude, persists the result.
// Called by the 6am cron and the manual dashboard Refresh Now button.
export async function runKnowledgeRefresh(): Promise<KnowledgeBase> {
  console.log("📚 KNOWLEDGE: Starting market intelligence refresh...");

  const previousKB = getKnowledgeBase();

  // Spawn all category subagents in parallel
  const subagentResults = await Promise.all(
    RESEARCH_CATEGORIES.map((cat) => runKnowledgeSubagent(cat))
  );

  const totalResults = subagentResults.reduce(
    (sum, r) => sum + r.searchResults.length,
    0
  );
  console.log(
    `📚 KNOWLEDGE: Gathered ${totalResults} search results across ${RESEARCH_CATEGORIES.length} categories. Synthesizing...`
  );

  const kb = await synthesizeKnowledgeBase(subagentResults, previousKB);

  saveKnowledgeBase(kb);

  console.log(
    `📚 KNOWLEDGE: Refresh complete. Hot verticals: ${kb.hotVerticals.join(", ") || "none"}. ` +
    `Cold verticals: ${kb.coldVerticals.join(", ") || "none"}.`
  );

  return kb;
}
