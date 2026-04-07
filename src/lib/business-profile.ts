// lib/business-profile.ts — Business profile and WatchtowerConfig accessors (server-side)

import {
  getStoredBusinessProfile,
  getStoredWatchtowerConfig,
  BusinessProfile,
  WatchtowerConfig,
} from "./store";

export type { BusinessProfile, WatchtowerConfig };

/**
 * Returns the stored business profile, or null if not configured.
 * Used by agents to calibrate their behaviour for the specific business.
 */
export async function getBusinessProfile(): Promise<BusinessProfile | null> {
  return getStoredBusinessProfile();
}

/**
 * Returns the generated WatchtowerConfig, or null if not yet generated.
 * Watchtower uses this as its live search strategy when available.
 */
export async function getWatchtowerConfig(): Promise<WatchtowerConfig | null> {
  return getStoredWatchtowerConfig();
}

/**
 * Returns a compact text block describing the product for use in Claude prompts.
 * If a business profile is configured, it replaces the hardcoded Cloudbox defaults.
 */
export function buildProductKnowledgeBlock(profile: BusinessProfile | null): string {
  if (!profile || !profile.whatYouSell) return "";

  const distModel = profile.distributionModel.join(", ") || "Direct and channel sales";
  const lookingFor = profile.lookingFor.join(", ") || "VARs and resellers";

  const dealLabel: Record<string, string> = {
    "under10k": "under $10k",
    "10k-50k": "$10k-$50k",
    "50k-100k": "$50k-$100k",
    "100k+": "$100k+",
    "enterprise": "Enterprise ($100k+)",
  };

  const cycleLabel: Record<string, string> = {
    "days": "days",
    "weeks": "weeks",
    "1-3months": "1-3 months",
    "3-6months": "3-6 months",
    "6months+": "6+ months",
  };

  return `PRODUCT OVERVIEW FOR ${profile.companyName.toUpperCase()}:
What we sell: ${profile.whatYouSell}
Who buys from us: ${profile.whoBuysFromYou}
Key differentiator: ${profile.whyChooseYou}
${profile.websiteUrl ? `Website: ${profile.websiteUrl}` : ""}
Average deal size: ${dealLabel[profile.avgDealSize] ?? profile.avgDealSize}
Sales cycle: ${cycleLabel[profile.salesCycleLength] ?? profile.salesCycleLength}
Current distribution: ${distModel}
Partner types we want: ${lookingFor}`;
}
