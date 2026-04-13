// lib/store.ts — File-based storage for local/Electron mode.
// All data is persisted to a single JSON file in os.tmpdir().

import fs from "fs";
import path from "path";
import os from "os";

const STORE_PATH = path.join(os.tmpdir(), "var-hunter-store.json");

// ─── TYPES ───────────────────────────────────────────────────────────────────

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

export interface KnowledgeBase {
  lastRefreshed: string;
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

export interface BrandConfig {
  companyName: string;
  tagline: string;
  primaryColor: string;
  logoDataUrl?: string;
}

export interface BusinessProfile {
  companyName: string;
  websiteUrl: string;
  whatYouSell: string;
  whoBuysFromYou: string;
  whyChooseYou: string;
  avgDealSize: "under10k" | "10k-50k" | "50k-100k" | "100k+" | "enterprise";
  salesCycleLength: "days" | "weeks" | "1-3months" | "3-6months" | "6months+";
  distributionModel: string[];
  lookingFor: string[];
}

export interface WatchtowerSearchCategory {
  name: string;
  description: string;
  queries: string[];
  priority: "high" | "medium" | "low";
}

export interface WatchtowerConfig {
  searchCategories: WatchtowerSearchCategory[];
  idealVARProfile: string;
  targetVerticals: string[];
  avoidVerticals: string[];
  partnerEcosystem: string[];
  dealSizeGuidance: string;
  pitchTone: "formal" | "casual" | "technical" | "executive";
  keyValueProps: string[];
  redFlagPatterns: string[];
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
  pitchVariants?: {
    cold_email: string;
    linkedin_message: string;
    followup_email: string;
    text_message: string;
    executive_brief: string;
  };
  relevanceScore?: number;
  confidenceScore?: number;
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

// ─── FILE STORE ───────────────────────────────────────────────────────────────

interface FileStore {
  seenCompanies: string[];
  reports: ReportEntry[];
  knowledgeBase?: KnowledgeBase;
  searchHistory?: SearchHistoryEntry[];
  lastSearchEvolution?: EvolvedSearchParams;
  brandConfig?: BrandConfig;
  businessProfile?: BusinessProfile;
  watchtowerConfig?: WatchtowerConfig;
}

let _cache: FileStore | null = null;

function fileLoad(): FileStore {
  if (_cache) return _cache;
  try {
    if (fs.existsSync(STORE_PATH)) {
      _cache = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as FileStore;
      return _cache;
    }
  } catch {}
  _cache = { seenCompanies: [], reports: [] };
  return _cache;
}

function fileSave(store: FileStore) {
  _cache = store;
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export async function hasSeenCompany(name: string): Promise<boolean> {
  return fileLoad().seenCompanies.includes(name.toLowerCase().trim());
}

export async function markCompanySeen(name: string): Promise<void> {
  const store = fileLoad();
  const key = name.toLowerCase().trim();
  if (!store.seenCompanies.includes(key)) store.seenCompanies.push(key);
  fileSave(store);
}

export async function getSeenCompanies(): Promise<string[]> {
  return fileLoad().seenCompanies;
}

export async function saveReport(report: Omit<ReportEntry, "id" | "timestamp">): Promise<void> {
  const store = fileLoad();
  store.reports.unshift({
    ...report,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  });
  store.reports = store.reports.slice(0, 100);
  fileSave(store);
}

export async function getReports(): Promise<ReportEntry[]> {
  return fileLoad().reports;
}

export async function deleteReport(id: string): Promise<boolean> {
  const store = fileLoad();
  const before = store.reports.length;
  store.reports = store.reports.filter((r) => r.id !== id);
  if (store.reports.length === before) return false;
  fileSave(store);
  return true;
}

export async function clearReports(): Promise<void> {
  const store = fileLoad();
  store.reports = [];
  store.seenCompanies = [];
  fileSave(store);
}

export async function saveSearchHistory(entry: SearchHistoryEntry): Promise<void> {
  const store = fileLoad();
  if (!store.searchHistory) store.searchHistory = [];
  store.searchHistory.push(entry);
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  store.searchHistory = store.searchHistory.filter((e) => e.timestamp >= cutoff).slice(-1000);
  fileSave(store);
}

export async function getSearchHistory(): Promise<SearchHistoryEntry[]> {
  const store = fileLoad();
  if (!store.searchHistory) return [];
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  return store.searchHistory.filter((e) => e.timestamp >= cutoff);
}

export async function getUniqueQueryCount(): Promise<number> {
  const store = fileLoad();
  return new Set((store.searchHistory ?? []).map((e) => e.query)).size;
}

export async function saveSearchEvolution(evolution: EvolvedSearchParams): Promise<void> {
  const store = fileLoad();
  store.lastSearchEvolution = evolution;
  fileSave(store);
}

export async function getSearchEvolution(): Promise<EvolvedSearchParams | null> {
  return fileLoad().lastSearchEvolution ?? null;
}

export async function saveKnowledgeBase(kb: KnowledgeBase): Promise<void> {
  const store = fileLoad();
  store.knowledgeBase = kb;
  fileSave(store);
}

export async function getKnowledgeBase(): Promise<KnowledgeBase | null> {
  return fileLoad().knowledgeBase ?? null;
}

export async function saveBrandConfig(brand: BrandConfig): Promise<void> {
  const store = fileLoad();
  store.brandConfig = brand;
  fileSave(store);
}

export async function getStoredBrandConfig(): Promise<BrandConfig | null> {
  return fileLoad().brandConfig ?? null;
}

export async function saveBusinessProfile(profile: BusinessProfile): Promise<void> {
  const store = fileLoad();
  store.businessProfile = profile;
  fileSave(store);
}

export async function getStoredBusinessProfile(): Promise<BusinessProfile | null> {
  return fileLoad().businessProfile ?? null;
}

export async function saveWatchtowerConfig(config: WatchtowerConfig): Promise<void> {
  const store = fileLoad();
  store.watchtowerConfig = config;
  fileSave(store);
}

export async function getStoredWatchtowerConfig(): Promise<WatchtowerConfig | null> {
  return fileLoad().watchtowerConfig ?? null;
}

// ─── NO-OP STUBS (kept for API route compatibility) ──────────────────────────

export async function saveSettings(_settings: Record<string, string>): Promise<void> {}

export async function getSettings(): Promise<Record<string, string>> {
  return {};
}

export async function clearSessionData(): Promise<void> {
  _cache = { seenCompanies: [], reports: [] };
  try { fs.writeFileSync(STORE_PATH, JSON.stringify(_cache, null, 2)); } catch {}
}

export function getStoreAdapter(): "file" | "kv" {
  return "file";
}
