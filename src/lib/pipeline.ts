// lib/pipeline.ts — The full VAR Hunter pipeline: Watchtower → Detective → Reporter

import { searchWeb, searchNews, SearchResult } from "./search";
import { askClaude } from "./claude";
import { sendToTeams, VARReport } from "./teams";
import { hasSeenCompany, markCompanySeen, saveReport } from "./store";

// ─── STAGE 1: WATCHTOWER ────────────────────────────────────────────────────

const WATCHTOWER_QUERIES = [
  "IT reseller partnership announcement 2024",
  "MSP cloud reseller new partnership agreement",
  "technology distributor inventory management partnership",
  "cloud solutions reseller channel partner news",
  "warehouse inventory tech reseller partnership",
  "IT VAR value added reseller new deal announcement",
  "supply chain technology reseller agreement",
  "SaaS inventory solution channel partner",
];

interface PartnershipLead {
  companyName: string;
  newsTitle: string;
  newsSnippet: string;
  newsUrl: string;
  newsSource: string;
}

async function runWatchtower(): Promise<PartnershipLead[]> {
  console.log("🔭 WATCHTOWER: Scanning for partnership news...");
  const allResults: SearchResult[] = [];

  for (const query of WATCHTOWER_QUERIES) {
    try {
      const results = await searchNews(query, 5);
      allResults.push(...results);
    } catch (e) {
      console.error(`Search failed for: ${query}`, e);
    }
  }

  if (allResults.length === 0) return [];

  // Use Claude to filter for relevant VAR/reseller partnerships
  const snippets = allResults
    .slice(0, 30)
    .map((r, i) => `[${i}] TITLE: ${r.title}\nSOURCE: ${r.source}\nSNIPPET: ${r.snippet}\nURL: ${r.link}`)
    .join("\n\n");

  const filterPrompt = await askClaude(
    `You are a business development analyst for Cloudbox (cloudboxapp.com), which offers the world's first real-time weight-based inventory management solution. 
    
Your job is to identify news stories about companies that would make great Value Added Resellers (VARs) for Cloudbox. 

Ideal VAR candidates are:
- IT/MSP companies (Managed Service Providers)
- Cloud solutions resellers
- Technology distributors
- Companies that deal with physical inventory, warehousing, supply chain tech
- Hardware/software resellers who could bundle Cloudbox into their offering

Return ONLY a JSON array of objects with this shape (no markdown, no explanation):
[{"index": 0, "companyName": "Acme IT Solutions", "reason": "brief reason"}]

If no results are relevant, return an empty array: []`,
    `Here are today's news results. Identify which ones involve companies that could be Cloudbox VARs:\n\n${snippets}`
  );

  let leads: { index: number; companyName: string }[] = [];
  try {
    const cleaned = filterPrompt.replace(/```json|```/g, "").trim();
    leads = JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse watchtower response");
    return [];
  }

  return leads
    .filter((l) => l.index < allResults.length)
    .map((l) => ({
      companyName: l.companyName,
      newsTitle: allResults[l.index].title,
      newsSnippet: allResults[l.index].snippet,
      newsUrl: allResults[l.index].link,
      newsSource: allResults[l.index].source ?? allResults[l.index].link,
    }));
}

// ─── STAGE 2: DETECTIVE ─────────────────────────────────────────────────────

interface DetectiveResult {
  decisionMaker: string;
  title: string;
  linkedinUrl?: string;
  companyWebsite?: string;
  companyContext: string;
  personContext: string;
}

async function runDetective(lead: PartnershipLead): Promise<DetectiveResult | null> {
  console.log(`🕵️ DETECTIVE: Profiling ${lead.companyName}...`);

  // Search for company info
  const [companyResults, leaderResults, linkedinResults] = await Promise.all([
    searchWeb(`${lead.companyName} company profile technology reseller`, 5),
    searchWeb(`${lead.companyName} CEO "VP Sales" "Channel Director" "VP Partnerships" contact`, 5),
    searchWeb(`site:linkedin.com ${lead.companyName} CEO OR "VP Sales" OR "Channel Director" OR "VP Partnerships"`, 5),
  ]);

  const companySnippets = companyResults.map((r) => `${r.title}: ${r.snippet}`).join("\n");
  const leaderSnippets = leaderResults.map((r) => `${r.title}: ${r.snippet}`).join("\n");
  const linkedinSnippets = linkedinResults
    .map((r) => `${r.title} | ${r.link}\n${r.snippet}`)
    .join("\n");

  const detectivePrompt = await askClaude(
    `You are a business intelligence detective. Extract structured information from web search results about a company and identify the best decision maker to contact for a VAR/reseller partnership discussion.

Return ONLY a JSON object (no markdown, no explanation):
{
  "decisionMaker": "Full Name",
  "title": "Their Job Title",
  "linkedinUrl": "https://linkedin.com/in/... or null",
  "companyWebsite": "domain.com or null",
  "companyContext": "2-3 sentence summary of what the company does, their size, focus areas, and why they'd be a good VAR",
  "personContext": "2-3 sentence summary of who this person is, their background, what they care about professionally"
}

If you cannot identify a specific person, use your best inference from available data. Never leave decisionMaker blank — estimate based on company type if needed.`,
    `Company: ${lead.companyName}
News context: ${lead.newsSnippet}

Company search results:
${companySnippets}

Leadership search results:
${leaderSnippets}

LinkedIn results:
${linkedinSnippets}`
  );

  try {
    const cleaned = detectivePrompt.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    console.error(`Failed to parse detective result for ${lead.companyName}`);
    return null;
  }
}

// ─── STAGE 3: REPORTER ──────────────────────────────────────────────────────

async function runReporter(
  lead: PartnershipLead,
  detective: DetectiveResult
): Promise<string> {
  console.log(`📋 REPORTER: Generating pitch for ${detective.decisionMaker}...`);

  return await askClaude(
    `You are a senior business development strategist for Cloudbox (cloudboxapp.com).

Cloudbox offers the world's first real-time weight-based inventory management solution. It uses smart scales and IoT sensors to track inventory automatically by weight — no manual scanning, no human error. It's ideal for warehouses, manufacturers, distributors, and any business managing physical goods.

Your job is to write a SHORT, personalized outreach pitch (3-5 sentences max) for a VAR partner conversation. The pitch should:
1. Reference something specific about their company or recent news
2. Explain why Cloudbox fits their book of business
3. Suggest a clear, low-pressure next step
4. Sound like a real human wrote it — no corporate fluff

Write ONLY the pitch text, nothing else.`,
    `Contact: ${detective.decisionMaker}, ${detective.title} at ${lead.companyName}
Company context: ${detective.companyContext}
Person context: ${detective.personContext}
Recent news: ${lead.newsTitle} — ${lead.newsSnippet}`
  );
}

// ─── MAIN PIPELINE ──────────────────────────────────────────────────────────

export interface PipelineResult {
  processed: number;
  skipped: number;
  errors: number;
  reports: VARReport[];
}

export async function runPipeline(options?: { dryRun?: boolean }): Promise<PipelineResult> {
  const result: PipelineResult = { processed: 0, skipped: 0, errors: 0, reports: [] };

  // Stage 1
  const leads = await runWatchtower();
  console.log(`🔭 Watchtower found ${leads.length} leads`);

  for (const lead of leads) {
    // Dedup check
    if (hasSeenCompany(lead.companyName)) {
      console.log(`⏭️ Skipping already-processed: ${lead.companyName}`);
      result.skipped++;
      continue;
    }

    try {
      // Stage 2
      const detective = await runDetective(lead);
      if (!detective) {
        result.errors++;
        continue;
      }

      // Stage 3
      const pitch = await runReporter(lead, detective);

      const report: VARReport = {
        companyName: lead.companyName,
        decisionMaker: detective.decisionMaker,
        title: detective.title,
        linkedinUrl: detective.linkedinUrl,
        companyWebsite: detective.companyWebsite,
        companyProfile: detective.companyContext,
        personProfile: detective.personContext,
        pitch,
        newsTitle: lead.newsTitle,
        newsSource: lead.newsUrl,
      };

      // Save to local store
      saveReport(report);
      markCompanySeen(lead.companyName);

      // Send to Teams (unless dry run)
      if (!options?.dryRun) {
        await sendToTeams(report);
      }

      result.reports.push(report);
      result.processed++;

      // Rate limit — avoid hammering APIs
      await new Promise((r) => setTimeout(r, 1500));
    } catch (e) {
      console.error(`Pipeline error for ${lead.companyName}:`, e);
      result.errors++;
    }
  }

  return result;
}
