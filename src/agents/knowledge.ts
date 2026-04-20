// src/agents/knowledge.ts — Self-updating knowledge agent.
// Maintains a persistent, auto-updating brief about the company, its industry,
// competitors, and the VAR market. Runs on its own 6am cron and can be
// triggered manually from the dashboard.
//
// Other agents do NOT call this — they read the persisted output via getKnowledgeBase().

import { searchNews, searchWeb, SearchResult } from "@/lib/search";
import { askClaude } from "@/lib/claude";
import { saveKnowledgeBase, getKnowledgeBase, KnowledgeBase } from "@/lib/data";
import { getBrandConfig } from "@/lib/brand";
import { getBusinessProfile } from "@/lib/business-profile";

// ─── SEARCH CATEGORY DEFINITIONS ─────────────────────────────────────────────

interface ResearchCategory {
  name: string;
  newsQueries: string[];
  webQueries: string[];
  fetchUrls?: string[];
}

async function buildResearchCategories(): Promise<ResearchCategory[]> {
  const [brand, profile] = await Promise.all([getBrandConfig(), getBusinessProfile()]);
  const companyName = brand.companyName;
  const websiteUrl = profile?.websiteUrl;

  const brandCategory: ResearchCategory = {
    name: "brand_research",
    newsQueries: [
      `${companyName} news 2026`,
      `${companyName} new features 2026`,
      `${companyName} press release`,
    ],
    webQueries: [
      `${companyName} ${profile?.whatYouSell ?? "product"} review`,
    ],
    fetchUrls: websiteUrl
      ? [`https://${websiteUrl}`, `https://${websiteUrl}/blog`]
      : [],
  };

  return [
    brandCategory,
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
}

// ─── WEB PAGE FETCHER ────────────────────────────────────────────────────────

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
  previousKB: KnowledgeBase | null,
  companyName: string,
  productContext: string
): Promise<KnowledgeBase> {
  const researchText = formatResultsForSynthesis(subagentResults);
  const prevSummary = previousKB
    ? `Previous knowledge base (from ${previousKB.lastRefreshed}):\n` +
      `- Last insights: ${previousKB.lastInsights}\n` +
      `- Hot verticals: ${previousKB.hotVerticals.join(", ")}\n` +
      `- Cold verticals: ${previousKB.coldVerticals.join(", ")}\n` +
      `- Brand updates count: ${previousKB.cloudboxUpdates.length} items`
    : "No previous knowledge base — this is the first refresh.";

  const response = await askClaude(
    `You are a market intelligence analyst for ${companyName}. Your job is to synthesize web research into a living intelligence brief that helps the ${companyName} sales team find and target VAR (Value Added Reseller) partners more effectively.

Never use em dashes (—) in any output. Use commas, periods, or restructure the sentence instead.

${companyName} context: ${productContext}

${prevSummary}

INSTRUCTIONS:
- Extract and synthesize the most relevant insights from the research below
- Explicitly note what appears NEW or CHANGED compared to the previous cycle
- hotVerticals: verticals showing the STRONGEST current signals for VAR sales (active news, growth, partner activity)
- coldVerticals: verticals showing WEAK signals, oversaturation, or budget freeze signals
- refinedIdealVARProfile: an evolving description of the ideal VAR partner based on all current data
- lastInsights: 3-4 sentence executive summary of what changed this cycle and what it means for VAR outreach

Return ONLY a JSON object (no markdown, no explanation). All arrays must have at least 1 item:
{
  "lastRefreshed": "${new Date().toISOString()}",
  "cloudboxUpdates": ["Any new features, customer wins, press releases, or positioning changes found"],
  "industryTrends": ["Key industry trends that affect sales opportunities"],
  "competitorIntel": ["What competitors are doing, new products, pricing moves, positioning"],
  "partnerEcosystem": ["Updates on key integration partners and distributors"],
  "varMarketSignals": ["Signals about the VAR market — new practices being added, budget trends, hiring signals"],
  "refinedIdealVARProfile": "2-3 sentence description of the ideal VAR partner right now based on current market data",
  "hotVerticals": ["Vertical 1", "Vertical 2"],
  "coldVerticals": ["Vertical A"],
  "lastInsights": "3-4 sentence executive summary of what changed this cycle and what it means for outreach"
}`,
    `Here is the research gathered this cycle:\n\n${researchText}`
  );

  try {
    const cleaned = response.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as KnowledgeBase;
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

export async function runKnowledgeRefresh(): Promise<KnowledgeBase> {
  console.log("📚 KNOWLEDGE: Starting market intelligence refresh...");

  const [brand, profile] = await Promise.all([getBrandConfig(), getBusinessProfile()]);
  const productContext = profile?.whatYouSell
    ? `${brand.companyName} offers: ${profile.whatYouSell}. It sells through VARs and resellers.`
    : "Offers the world's first real-time weight-based inventory management solution using IoT smart scales. Sells through VARs and resellers who serve warehouses, manufacturers, distributors, and physical goods businesses.";

  const [previousKB, categories] = await Promise.all([
    getKnowledgeBase(),
    buildResearchCategories(),
  ]);

  const subagentResults = await Promise.all(
    categories.map((cat) => runKnowledgeSubagent(cat))
  );

  const totalResults = subagentResults.reduce(
    (sum, r) => sum + r.searchResults.length,
    0
  );
  console.log(
    `📚 KNOWLEDGE: Gathered ${totalResults} search results across ${categories.length} categories. Synthesizing...`
  );

  const kb = await synthesizeKnowledgeBase(subagentResults, previousKB, brand.companyName, productContext);

  await saveKnowledgeBase(kb);

  console.log(
    `📚 KNOWLEDGE: Refresh complete. Hot verticals: ${kb.hotVerticals.join(", ") || "none"}. ` +
    `Cold verticals: ${kb.coldVerticals.join(", ") || "none"}.`
  );

  return kb;
}
