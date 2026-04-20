// lib/client-config.ts — Per-client configuration shape and accessor.
// In development: reads from client-config.json at project root (gitignored).
// In production: reads from CLIENT_* prefixed environment variables.
// All agents and the orchestrator accept an optional clientConfig parameter;
// if omitted they call getClientConfig() here as the fallback.
import type { WatchtowerConfig, BrandConfig } from "./store";

export interface ClientConfig {
  clientId: string;
  companyName: string;
  tagline: string;
  primaryColor: string;
  website: string;
  whatTheySell: string;
  idealPartner: string;
  targetVerticals: string[];
  avoidVerticals: string[];
  cronSchedule: string;
  watchtowerConfig: WatchtowerConfig | null;
  brandConfig: BrandConfig | null;
}

function fromEnv(): ClientConfig {
  const parseList = (v: string | undefined) =>
    v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];

  return {
    clientId: process.env.CLIENT_ID ?? "default",
    companyName: process.env.CLIENT_COMPANY_NAME ?? "Cloudbox",
    tagline: process.env.CLIENT_TAGLINE ?? "Multi-agent partner prospecting pipeline",
    primaryColor: process.env.CLIENT_PRIMARY_COLOR ?? "#00ff88",
    website: process.env.CLIENT_WEBSITE ?? "",
    whatTheySell: process.env.CLIENT_WHAT_THEY_SELL ?? "",
    idealPartner: process.env.CLIENT_IDEAL_PARTNER ?? "",
    targetVerticals: parseList(process.env.CLIENT_TARGET_VERTICALS),
    avoidVerticals: parseList(process.env.CLIENT_AVOID_VERTICALS),
    cronSchedule: process.env.CLIENT_CRON_SCHEDULE ?? "0 9 * * *",
    watchtowerConfig: null,
    brandConfig: null,
  };
}

function fromFile(): ClientConfig | null {
  try {
    // Dynamic require so Next.js doesn't bundle the fs module on the client
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const filePath = path.join(process.cwd(), "client-config.json");
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as ClientConfig;
  } catch {
    return null;
  }
}

export function getClientConfig(): ClientConfig {
  const isDev =
    (process.env.NODE_ENV ?? "development") === "development";

  if (isDev) {
    const file = fromFile();
    if (file) return file;
  }

  return fromEnv();
}
