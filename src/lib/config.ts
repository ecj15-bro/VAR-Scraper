// lib/config.ts — Reads config exclusively from process.env.
// For Electron, env vars are injected via electron-store at startup.
// For local dev, copy .env.local.example to .env.local and fill in values.

export interface AppConfig {
  ANTHROPIC_API_KEY: string;
  SERPER_API_KEY: string;
  RESEND_API_KEY: string;
  REPORT_TO_EMAIL: string;
  RESEND_FROM: string;
  ENABLE_EMAIL_DELIVERY: string;
}

export interface DemoAccountMeta {
  id: string;
  label: string;
  emoji: string;
  color: string;
  description: string;
}

declare global {
  interface Window {
    electronAPI?: {
      getSettings: () => Promise<AppConfig>;
      saveSettings: (settings: Partial<AppConfig>) => Promise<{ ok: boolean }>;
      testConnection: (payload: { service: string; key: string }) => Promise<{ ok: boolean; error?: string }>;
      getPort: () => Promise<number>;
      listDemoAccounts: () => Promise<DemoAccountMeta[]>;
      loadDemoAccount: (id: string) => Promise<{ ok: boolean; label?: string; error?: string }>;
      isElectron: boolean;
    };
  }
}

/** Returns config from process.env. Always synchronous — no I/O. */
export async function getConfig(): Promise<AppConfig> {
  return {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
    SERPER_API_KEY: process.env.SERPER_API_KEY ?? "",
    RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
    REPORT_TO_EMAIL: process.env.REPORT_TO_EMAIL ?? "",
    RESEND_FROM: process.env.RESEND_FROM ?? "",
    ENABLE_EMAIL_DELIVERY: process.env.ENABLE_EMAIL_DELIVERY ?? "false",
  };
}
