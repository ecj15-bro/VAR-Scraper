// lib/config.ts — Unified config reader for Electron and Vercel/local dev

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

function isElectronMain(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.versions !== "undefined" &&
    !!process.versions.electron
  );
}

/** Returns all config keys from the appropriate source. */
export async function getConfig(): Promise<AppConfig> {
  // Browser context inside Electron — use IPC bridge
  if (typeof window !== "undefined" && window.electronAPI) {
    return window.electronAPI.getSettings();
  }

  // Server context inside Electron main process — read process.env
  // (electron-store values are injected into process.env at server start)
  if (isElectronMain()) {
    return {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
      SERPER_API_KEY: process.env.SERPER_API_KEY ?? "",
      RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
      REPORT_TO_EMAIL: process.env.REPORT_TO_EMAIL ?? "",
      RESEND_FROM: process.env.RESEND_FROM ?? "",
      ENABLE_EMAIL_DELIVERY: process.env.ENABLE_EMAIL_DELIVERY ?? "false",
    };
  }

  // Vercel / local dev — read process.env as always
  return {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
    SERPER_API_KEY: process.env.SERPER_API_KEY ?? "",
    RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
    REPORT_TO_EMAIL: process.env.REPORT_TO_EMAIL ?? "",
    RESEND_FROM: process.env.RESEND_FROM ?? "",
    ENABLE_EMAIL_DELIVERY: process.env.ENABLE_EMAIL_DELIVERY ?? "false",
  };
}
