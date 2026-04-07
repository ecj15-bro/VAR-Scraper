// lib/store.ts — Adaptive store: file-based (Electron/dev) or Vercel KV (web).
//
// Adapter selection:
//   - "kv"  : KV_REST_API_URL + KV_REST_API_TOKEN env vars are set (Vercel KV)
//   - "file": Everything else (Electron, local dev)
//
// All public functions are async and delegate to the right backend.
// Session namespacing for KV is handled via getCurrentSessionId() from session.ts,
// which uses AsyncLocalStorage to propagate the session through the full call chain.

import fs from "fs";
import path from "path";
import os from "os";
import { getCurrentSessionId } from "./session";

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

// ─── ADAPTER DETECTION ───────────────────────────────────────────────────────

export function getStoreAdapter(): "file" | "kv" {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return "kv";
  return "file";
}

// ─── KV STORE (lazy dynamic import) ─────────────────────────────────────────

let _kv: typeof import("./store-kv") | null = null;

async function kvStore(): Promise<typeof import("./store-kv")> {
  if (!_kv) _kv = await import("./store-kv");
  return _kv;
}

// ─── FILE STORE — INTERNAL ───────────────────────────────────────────────────

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

// ─── PUBLIC ASYNC API ────────────────────────────────────────────────────────
// All callers use these. In KV mode, the session ID is read from AsyncLocalStorage.

export async function hasSeenCompany(name: string): Promise<boolean> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvHasSeenCompany(getCurrentSessionId(), name);
  }
  const store = fileLoad();
  return store.seenCompanies.includes(name.toLowerCase().trim());
}

export async function markCompanySeen(name: string): Promise<void> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvMarkCompanySeen(getCurrentSessionId(), name);
  }
  const store = fileLoad();
  const key = name.toLowerCase().trim();
  if (!store.seenCompanies.includes(key)) store.seenCompanies.push(key);
  fileSave(store);
}

export async function getSeenCompanies(): Promise<string[]> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvGetSeenCompanies(getCurrentSessionId());
  }
  return fileLoad().seenCompanies;
}

export async function saveReport(report: Omit<ReportEntry, "id" | "timestamp">): Promise<void> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvSaveReport(getCurrentSessionId(), report);
  }
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
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvGetReports(getCurrentSessionId());
  }
  return fileLoad().reports;
}

export async function deleteReport(id: string): Promise<boolean> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvDeleteReport(getCurrentSessionId(), id);
  }
  const store = fileLoad();
  const before = store.reports.length;
  store.reports = store.reports.filter((r) => r.id !== id);
  if (store.reports.length === before) return false;
  fileSave(store);
  return true;
}

export async function clearReports(): Promise<void> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvClearReports(getCurrentSessionId());
  }
  const store = fileLoad();
  store.reports = [];
  store.seenCompanies = [];
  fileSave(store);
}

export async function saveSearchHistory(entry: SearchHistoryEntry): Promise<void> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvSaveSearchHistory(getCurrentSessionId(), entry);
  }
  const store = fileLoad();
  if (!store.searchHistory) store.searchHistory = [];
  store.searchHistory.push(entry);
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  store.searchHistory = store.searchHistory.filter((e) => e.timestamp >= cutoff).slice(-1000);
  fileSave(store);
}

export async function getSearchHistory(): Promise<SearchHistoryEntry[]> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvGetSearchHistory(getCurrentSessionId());
  }
  const store = fileLoad();
  if (!store.searchHistory) return [];
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  return store.searchHistory.filter((e) => e.timestamp >= cutoff);
}

export async function getUniqueQueryCount(): Promise<number> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvGetUniqueQueryCount(getCurrentSessionId());
  }
  const store = fileLoad();
  const queries = new Set((store.searchHistory ?? []).map((e) => e.query));
  return queries.size;
}

export async function saveSearchEvolution(evolution: EvolvedSearchParams): Promise<void> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvSaveSearchEvolution(getCurrentSessionId(), evolution);
  }
  const store = fileLoad();
  store.lastSearchEvolution = evolution;
  fileSave(store);
}

export async function getSearchEvolution(): Promise<EvolvedSearchParams | null> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvGetSearchEvolution(getCurrentSessionId());
  }
  return fileLoad().lastSearchEvolution ?? null;
}

export async function saveKnowledgeBase(kb: KnowledgeBase): Promise<void> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvSaveKnowledgeBase(getCurrentSessionId(), kb);
  }
  const store = fileLoad();
  store.knowledgeBase = kb;
  fileSave(store);
}

export async function getKnowledgeBase(): Promise<KnowledgeBase | null> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvGetKnowledgeBase(getCurrentSessionId());
  }
  return fileLoad().knowledgeBase ?? null;
}

export async function saveBrandConfig(brand: BrandConfig): Promise<void> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvSaveBrandConfig(getCurrentSessionId(), brand);
  }
  const store = fileLoad();
  store.brandConfig = brand;
  fileSave(store);
}

export async function getStoredBrandConfig(): Promise<BrandConfig | null> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvGetBrandConfig(getCurrentSessionId());
  }
  return fileLoad().brandConfig ?? null;
}

export async function saveBusinessProfile(profile: BusinessProfile): Promise<void> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvSaveBusinessProfile(getCurrentSessionId(), profile);
  }
  const store = fileLoad();
  store.businessProfile = profile;
  fileSave(store);
}

export async function getStoredBusinessProfile(): Promise<BusinessProfile | null> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvGetBusinessProfile(getCurrentSessionId());
  }
  return fileLoad().businessProfile ?? null;
}

export async function saveWatchtowerConfig(config: WatchtowerConfig): Promise<void> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvSaveWatchtowerConfig(getCurrentSessionId(), config);
  }
  const store = fileLoad();
  store.watchtowerConfig = config;
  fileSave(store);
}

export async function getStoredWatchtowerConfig(): Promise<WatchtowerConfig | null> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvGetWatchtowerConfig(getCurrentSessionId());
  }
  return fileLoad().watchtowerConfig ?? null;
}

// ─── KV SETTINGS (web BYOK mode only) ────────────────────────────────────────

export async function saveSettings(settings: Record<string, string>): Promise<void> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvSaveSettings(getCurrentSessionId(), settings);
  }
  // File mode: settings are managed via electron-store IPC — no-op here
}

export async function getSettings(): Promise<Record<string, string>> {
  if (getStoreAdapter() === "kv") {
    return (await kvStore()).kvGetSettings(getCurrentSessionId());
  }
  return {};
}
