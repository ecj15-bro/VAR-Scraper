// lib/store.ts — Simple file-based store for seen companies & report history
// In production on Vercel, use Vercel KV or a DB. This uses /tmp for now.

import fs from "fs";
import path from "path";
import os from "os";

const STORE_PATH = path.join(os.tmpdir(), "var-hunter-store.json");

// ─── SEARCH HISTORY ──────────────────────────────────────────────────────────

export interface SearchHistoryEntry {
  id: string;
  timestamp: string;
  query: string;
  category: string;
  resultsCount: number;
  qualifiedLeadsCount: number;
  avgRelevanceScore: number;
  companiesFound: string[];
}

export interface EvolvedSearchParams {
  retireQueries: string[];
  addQueries: string[];
  hotVerticalQueries: string[];
  ecosystemQueries: string[];
  saturatedQueries: string[];
  evolutionRationale: string;
}

// ─── KNOWLEDGE BASE ──────────────────────────────────────────────────────────

export interface KnowledgeBase {
  lastRefreshed: string; // ISO timestamp
  cloudboxUpdates: string[];
  industryTrends: string[];
  competitorIntel: string[];
  partnerEcosystem: string[];
  varMarketSignals: string[];
  refinedIdealVARProfile: string;
  hotVerticals: string[];
  coldVerticals: string[];
  lastInsights: string;
}

// ─── STORE SHAPE ─────────────────────────────────────────────────────────────

interface Store {
  seenCompanies: string[]; // normalized company names already processed
  reports: ReportEntry[];
  knowledgeBase?: KnowledgeBase;
  searchHistory?: SearchHistoryEntry[];
  lastSearchEvolution?: EvolvedSearchParams;
}

export interface ReportEntry {
  id: string;
  timestamp: string;
  companyName: string;
  decisionMaker: string;
  title: string;
  linkedinUrl?: string;
  companyWebsite?: string;
  companyProfile: string;
  personProfile: string;
  pitch: string;
  newsTitle: string;
  newsSource: string;
  // Added by multi-agent pipeline
  pitchVariants?: {
    cold_email: string;
    linkedin_message: string;
    followup_email: string;
    text_message: string;
    executive_brief: string;
  };
  relevanceScore?: number;
  confidenceScore?: number;
  // Added by ContextAgent
  // Inline types mirror VARFitScore and PitchContext from agents/context.ts
  // (not imported to avoid lib/ → agents/ circular dependency)
  varFitScore?: {
    overallScore: number;
    fitCategory: "strong" | "moderate" | "weak" | "avoid";
    fitReasons: string[];
    redFlags: string[];
    deploymentEase: "easy" | "moderate" | "complex";
    estimatedDealSize: "small" | "mid" | "enterprise";
    strategicNotes: string;
  };
  pitchContext?: {
    hookAngle: string;
    painPoints: string[];
    integrationAngle: string | null;
    toneRecommendation: "formal" | "casual" | "technical" | "executive";
    avoidMentioning: string[];
  };
  briefing?: string;
}

function loadStore(): Store {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    }
  } catch {}
  return { seenCompanies: [], reports: [] };
}

function saveStore(store: Store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

export function hasSeenCompany(name: string): boolean {
  const store = loadStore();
  return store.seenCompanies.includes(name.toLowerCase().trim());
}

export function markCompanySeen(name: string) {
  const store = loadStore();
  const key = name.toLowerCase().trim();
  if (!store.seenCompanies.includes(key)) {
    store.seenCompanies.push(key);
  }
  saveStore(store);
}

export function saveReport(report: Omit<ReportEntry, "id" | "timestamp">) {
  const store = loadStore();
  store.reports.unshift({
    ...report,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  });
  // Keep last 100 reports
  store.reports = store.reports.slice(0, 100);
  saveStore(store);
}

export function getReports(): ReportEntry[] {
  return loadStore().reports;
}

export function deleteReport(id: string): boolean {
  const store = loadStore();
  const before = store.reports.length;
  store.reports = store.reports.filter((r) => r.id !== id);
  if (store.reports.length === before) return false;
  saveStore(store);
  return true;
}

export function clearReports(): void {
  const store = loadStore();
  store.reports = [];
  store.seenCompanies = [];
  saveStore(store);
}

export function getSeenCompanies(): string[] {
  return loadStore().seenCompanies;
}

export function saveSearchHistory(entry: SearchHistoryEntry): void {
  const store = loadStore();
  if (!store.searchHistory) store.searchHistory = [];
  store.searchHistory.push(entry);
  // Prune to last 90 days and max 1000 entries
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  store.searchHistory = store.searchHistory
    .filter((e) => e.timestamp >= cutoff)
    .slice(-1000);
  saveStore(store);
}

export function getSearchHistory(): SearchHistoryEntry[] {
  const store = loadStore();
  if (!store.searchHistory) return [];
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  return store.searchHistory.filter((e) => e.timestamp >= cutoff);
}

export function getUniqueQueryCount(): number {
  const store = loadStore();
  const queries = new Set((store.searchHistory ?? []).map((e) => e.query));
  return queries.size;
}

export function saveSearchEvolution(evolution: EvolvedSearchParams): void {
  const store = loadStore();
  store.lastSearchEvolution = evolution;
  saveStore(store);
}

export function getSearchEvolution(): EvolvedSearchParams | null {
  return loadStore().lastSearchEvolution ?? null;
}

export function saveKnowledgeBase(kb: KnowledgeBase): void {
  const store = loadStore();
  store.knowledgeBase = kb;
  saveStore(store);
}

export function getKnowledgeBase(): KnowledgeBase | null {
  return loadStore().knowledgeBase ?? null;
}
