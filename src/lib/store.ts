// lib/store.ts — Simple file-based store for seen companies & report history
// In production on Vercel, use Vercel KV or a DB. This uses /tmp for now.

import fs from "fs";
import path from "path";

const STORE_PATH = path.join("/tmp", "var-hunter-store.json");

interface Store {
  seenCompanies: string[]; // normalized company names already processed
  reports: ReportEntry[];
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
