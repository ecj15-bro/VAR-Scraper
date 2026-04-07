// lib/brand.ts — Brand config accessor (server-side)
// Client-side access goes through /api/brand HTTP route.

import { getStoredBrandConfig, BrandConfig } from "./store";

export type { BrandConfig };

export const DEFAULT_BRAND: BrandConfig = {
  companyName: "Cloudbox",
  tagline: "Multi-agent partner prospecting pipeline",
  primaryColor: "#00ff88",
};

/**
 * Returns the brand config from the file store, falling back to Cloudbox defaults.
 * Usable in agents, API routes, and any server-side context.
 */
export function getBrandConfig(): BrandConfig {
  const stored = getStoredBrandConfig();
  if (!stored) return DEFAULT_BRAND;
  return {
    companyName: stored.companyName || DEFAULT_BRAND.companyName,
    tagline: stored.tagline || DEFAULT_BRAND.tagline,
    primaryColor: stored.primaryColor || DEFAULT_BRAND.primaryColor,
    logoDataUrl: stored.logoDataUrl,
  };
}
