// src/lib/store-kv.ts — Upstash Redis-backed store for web/Vercel deployment.
// Dynamically imported by store.ts only when UPSTASH_REDIS_REST_URL is set,
// so @upstash/redis is never loaded in Electron.

import { Redis } from "@upstash/redis";
import type {
  ReportEntry,
  SearchHistoryEntry,
  EvolvedSearchParams,
  KnowledgeBase,
  BrandConfig,
  BusinessProfile,
  WatchtowerConfig,
} from "./store";

const redis = Redis.fromEnv();

// ─── KEY HELPER ───────────────────────────────────────────────────────────────

function k(sessionId: string, name: string): string {
  return `${sessionId}:${name}`;
}

// ─── REPORTS ─────────────────────────────────────────────────────────────────

export async function kvGetReports(sessionId: string): Promise<ReportEntry[]> {
  return (await redis.get<ReportEntry[]>(k(sessionId, "reports"))) ?? [];
}

export async function kvSaveReport(
  sessionId: string,
  report: Omit<ReportEntry, "id" | "timestamp">
): Promise<void> {
  const reports = await kvGetReports(sessionId);
  reports.unshift({
    ...report,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  });
  await redis.set(k(sessionId, "reports"), reports.slice(0, 100));
}

export async function kvDeleteReport(sessionId: string, id: string): Promise<boolean> {
  const reports = await kvGetReports(sessionId);
  const filtered = reports.filter((r) => r.id !== id);
  if (filtered.length === reports.length) return false;
  await redis.set(k(sessionId, "reports"), filtered);
  return true;
}

export async function kvClearReports(sessionId: string): Promise<void> {
  await Promise.all([
    redis.set(k(sessionId, "reports"), []),
    redis.set(k(sessionId, "seen-companies"), []),
  ]);
}

// ─── SEEN COMPANIES ───────────────────────────────────────────────────────────

export async function kvGetSeenCompanies(sessionId: string): Promise<string[]> {
  return (await redis.get<string[]>(k(sessionId, "seen-companies"))) ?? [];
}

export async function kvHasSeenCompany(sessionId: string, name: string): Promise<boolean> {
  const seen = await kvGetSeenCompanies(sessionId);
  return seen.includes(name.toLowerCase().trim());
}

export async function kvMarkCompanySeen(sessionId: string, name: string): Promise<void> {
  const seen = await kvGetSeenCompanies(sessionId);
  const key = name.toLowerCase().trim();
  if (!seen.includes(key)) {
    seen.push(key);
    await redis.set(k(sessionId, "seen-companies"), seen);
  }
}

// ─── SEARCH HISTORY ───────────────────────────────────────────────────────────

export async function kvGetSearchHistory(sessionId: string): Promise<SearchHistoryEntry[]> {
  const history = (await redis.get<SearchHistoryEntry[]>(k(sessionId, "search-history"))) ?? [];
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  return history.filter((e) => e.timestamp >= cutoff);
}

export async function kvSaveSearchHistory(
  sessionId: string,
  entry: SearchHistoryEntry
): Promise<void> {
  const history = (await redis.get<SearchHistoryEntry[]>(k(sessionId, "search-history"))) ?? [];
  history.push(entry);
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const pruned = history.filter((e) => e.timestamp >= cutoff).slice(-1000);
  await redis.set(k(sessionId, "search-history"), pruned);
}

export async function kvGetUniqueQueryCount(sessionId: string): Promise<number> {
  const history = await kvGetSearchHistory(sessionId);
  return new Set(history.map((e) => e.query)).size;
}

// ─── SEARCH EVOLUTION ─────────────────────────────────────────────────────────

export async function kvSaveSearchEvolution(
  sessionId: string,
  evolution: EvolvedSearchParams
): Promise<void> {
  await redis.set(k(sessionId, "search-evolution"), evolution);
}

export async function kvGetSearchEvolution(
  sessionId: string
): Promise<EvolvedSearchParams | null> {
  return redis.get<EvolvedSearchParams>(k(sessionId, "search-evolution"));
}

// ─── KNOWLEDGE BASE ───────────────────────────────────────────────────────────

export async function kvSaveKnowledgeBase(sessionId: string, kb: KnowledgeBase): Promise<void> {
  await redis.set(k(sessionId, "knowledge-base"), kb);
}

export async function kvGetKnowledgeBase(sessionId: string): Promise<KnowledgeBase | null> {
  return redis.get<KnowledgeBase>(k(sessionId, "knowledge-base"));
}

// ─── BRAND CONFIG ─────────────────────────────────────────────────────────────

export async function kvSaveBrandConfig(sessionId: string, brand: BrandConfig): Promise<void> {
  // Split logo into a separate key to avoid bloating the main brand fetch
  const { logoDataUrl, ...rest } = brand;
  await redis.set(k(sessionId, "brand-config"), rest);
  if (logoDataUrl !== undefined) {
    await redis.set(k(sessionId, "brand-logo"), logoDataUrl);
  }
}

export async function kvGetBrandConfig(sessionId: string): Promise<BrandConfig | null> {
  const brand = await redis.get<Omit<BrandConfig, "logoDataUrl">>(k(sessionId, "brand-config"));
  if (!brand) return null;
  const logoDataUrl = (await redis.get<string>(k(sessionId, "brand-logo"))) ?? undefined;
  return { ...brand, logoDataUrl };
}

// ─── BUSINESS PROFILE ─────────────────────────────────────────────────────────

export async function kvSaveBusinessProfile(
  sessionId: string,
  profile: BusinessProfile
): Promise<void> {
  await redis.set(k(sessionId, "business-profile"), profile);
}

export async function kvGetBusinessProfile(sessionId: string): Promise<BusinessProfile | null> {
  return redis.get<BusinessProfile>(k(sessionId, "business-profile"));
}

// ─── WATCHTOWER CONFIG ────────────────────────────────────────────────────────

export async function kvSaveWatchtowerConfig(
  sessionId: string,
  config: WatchtowerConfig
): Promise<void> {
  await redis.set(k(sessionId, "watchtower-config"), config);
}

export async function kvGetWatchtowerConfig(sessionId: string): Promise<WatchtowerConfig | null> {
  return redis.get<WatchtowerConfig>(k(sessionId, "watchtower-config"));
}

// ─── SETTINGS (BYOK) ─────────────────────────────────────────────────────────

export async function kvSaveSettings(
  sessionId: string,
  settings: Record<string, string>
): Promise<void> {
  const existing = (await redis.get<Record<string, string>>(k(sessionId, "settings"))) ?? {};
  await redis.set(k(sessionId, "settings"), { ...existing, ...settings });
}

export async function kvGetSettings(sessionId: string): Promise<Record<string, string>> {
  return (await redis.get<Record<string, string>>(k(sessionId, "settings"))) ?? {};
}
