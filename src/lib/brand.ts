// lib/brand.ts — Brand configuration accessor (server-side)
//
// getBrandConfig() reads from the store (file or KV depending on adapter).
// Falls back to "Cloudbox" defaults when no brand has been configured.

import { getStoredBrandConfig, BrandConfig } from "./store";

export type { BrandConfig };

const DEFAULT_BRAND: BrandConfig = {
  companyName: "Cloudbox",
  tagline: "The world's first real-time weight-based inventory management solution",
  primaryColor: "#00cc66",
};

/**
 * Returns the active brand config, or Cloudbox defaults if not yet configured.
 * Async because the underlying store may be KV-backed.
 */
export async function getBrandConfig(): Promise<BrandConfig> {
  const stored = await getStoredBrandConfig();
  if (!stored) return DEFAULT_BRAND;
  return {
    ...DEFAULT_BRAND,
    ...stored,
  };
}
