// src/agents/detective.ts — Stage 2: Profile each lead and identify the best decision maker

import { searchWeb, SearchResult } from "@/lib/search";
import { askClaude } from "@/lib/claude";
import { getBrandConfig } from "@/lib/brand";
import { getBusinessProfile } from "@/lib/business-profile";
import { createConcurrencyLimiter } from "@/lib/concurrency";
import { ScoredLead } from "./watchtower";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface DetectiveResult {
  // Carried forward from the lead
  companyName: string;
  newsTitle: string;
  newsSnippet: string;
  newsUrl: string;
  newsSource: string;
  relevanceScore: number;
  // Extracted by detective
  decisionMaker: string;
  title: string;
  linkedinUrl: string | null;
  companyWebsite: string | null;
  companyProfile: string;
  personProfile: string;
  confidenceScore: number;
}

// ─── PROFILE EXTRACTION ─────────────────────────────────────────────────────

interface SearchSets {
  company: SearchResult[];
  leadership: SearchResult[];
  linkedin: SearchResult[];
  news: SearchResult[];
}

async function extractProfile(
  lead: ScoredLead,
  searchSets: SearchSets,
  companyName: string,
  productSummary: string
): Promise<Omit<DetectiveResult, "companyName" | "newsTitle" | "newsSnippet" | "newsUrl" | "newsSource" | "relevanceScore"> | null> {
  const companySnippets = searchSets.company
    .map((r) => `${r.title}: ${r.snippet}`)
    .join("\n");
  const leaderSnippets = searchSets.leadership
    .map((r) => `${r.title}: ${r.snippet}`)
    .join("\n");
  const linkedinSnippets = searchSets.linkedin
    .map((r) => `${r.title} | ${r.link}\n${r.snippet}`)
    .join("\n");
  const newsSnippets = searchSets.news
    .map((r) => `${r.title}: ${r.snippet}`)
    .join("\n");

  const response = await askClaude(
    `You are a business intelligence detective for ${companyName}. ${productSummary} Extract structured information about a company and identify the best decision maker to contact for a VAR/reseller partnership discussion.

Return ONLY a JSON object (no markdown, no explanation):
{
  "decisionMaker": "Full Name — never leave blank; if unknown, infer a plausible name from LinkedIn or write 'Head of Partnerships at [Company]'",
  "title": "Their exact job title",
  "linkedinUrl": "https://linkedin.com/in/username or null",
  "companyWebsite": "domain.com (no https://, no path) or null",
  "companyProfile": "3-4 sentences: what they do, estimated size, focus areas, and specifically why they would make an ideal VAR partner",
  "personProfile": "3-4 sentences: this person's background, what they have accomplished, what professional goals they likely care about, and what messaging angle would resonate with them",
  "confidenceScore": 7
}

confidenceScore (0-10):
- 8-10: Named decision maker confirmed with job title and strong company context
- 5-7: Person inferred from partial data with good company understanding
- 0-4: Very limited data, mostly estimated`,
    `Company: ${lead.companyName}
News trigger: ${lead.newsTitle} — ${lead.newsSnippet}

Company overview results:
${companySnippets || "(no results)"}

Leadership search results:
${leaderSnippets || "(no results)"}

LinkedIn results:
${linkedinSnippets || "(no results)"}

Recent news context:
${newsSnippets || "(no results)"}`
  );

  try {
    const cleaned = response.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    console.error(`[Detective] Failed to parse profile for ${lead.companyName}`);
    return null;
  }
}

// ─── SUBAGENT ───────────────────────────────────────────────────────────────

// Handles one company. Runs 4 searches in parallel, then calls Claude once.
// If confidenceScore < 4, runs a targeted second-pass before giving up.
async function runDetectiveSubagent(
  lead: ScoredLead,
  companyName: string,
  productSummary: string
): Promise<DetectiveResult | null> {
  console.log(`🕵️ DETECTIVE: Profiling ${lead.companyName}...`);

  try {
    // Run all 4 searches in parallel
    const [company, leadership, linkedin, news] = await Promise.all([
      searchWeb(`${lead.companyName} technology reseller company overview`, 5),
      searchWeb(
        `${lead.companyName} CEO OR "VP Sales" OR "Channel Director" OR "VP Partnerships" OR "Head of Channels"`,
        5
      ),
      searchWeb(`site:linkedin.com/in ${lead.companyName} CEO OR VP OR Director`, 5),
      searchWeb(`${lead.companyName} recent news partnerships 2026`, 5),
    ]);

    let profile = await extractProfile(lead, { company, leadership, linkedin, news }, companyName, productSummary);

    // Second-pass if confidence is too low
    if (profile !== null && profile.confidenceScore < 4) {
      console.log(`🕵️ DETECTIVE: Low confidence (${profile.confidenceScore}) for ${lead.companyName}, running second-pass...`);

      const [secondLeadership, secondCompany] = await Promise.all([
        searchWeb(`"${lead.companyName}" executive director president founder`, 5),
        searchWeb(`"${lead.companyName}" reseller distributor technology channel partner`, 5),
      ]);

      profile = await extractProfile(lead, {
        company: [...company, ...secondCompany],
        leadership: [...leadership, ...secondLeadership],
        linkedin,
        news,
      }, companyName, productSummary);
    }

    if (!profile) return null;

    return {
      companyName: lead.companyName,
      newsTitle: lead.newsTitle,
      newsSnippet: lead.newsSnippet,
      newsUrl: lead.newsUrl,
      newsSource: lead.newsSource,
      relevanceScore: lead.relevanceScore,
      ...profile,
    };
  } catch (e) {
    console.error(`[Detective] Error profiling ${lead.companyName}:`, e);
    return null;
  }
}

// ─── PARENT AGENT ───────────────────────────────────────────────────────────

// Processes leads with a max of 3 concurrent subagents to respect Serper rate limits.
export async function runDetective(leads: ScoredLead[]): Promise<DetectiveResult[]> {
  console.log(`🕵️ DETECTIVE: Processing ${leads.length} leads (max 3 concurrent)...`);

  const [brand, profile] = await Promise.all([getBrandConfig(), getBusinessProfile()]);
  const productSummary = profile?.whatYouSell
    ? `We are looking for VAR partners for: ${profile.whatYouSell}`
    : "We offer the world's first real-time weight-based inventory management solution using IoT smart scales.";

  const limit = createConcurrencyLimiter(3);

  const results = await Promise.all(
    leads.map((lead) =>
      limit(() => runDetectiveSubagent(lead, brand.companyName, productSummary))
    )
  );

  const valid = results.filter((r): r is DetectiveResult => r !== null);
  console.log(`🕵️ DETECTIVE: Successfully profiled ${valid.length}/${leads.length} leads`);
  return valid;
}
