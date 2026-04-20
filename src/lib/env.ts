// lib/env.ts — Single typed accessor for all environment variables.
// All server-side code imports from here instead of reading process.env directly.
// Throws fast with a clear message when required variables are absent.

export interface AppEnv {
  anthropicApiKey: string;
  serperApiKey: string;
  resendApiKey: string | null;
  reportToEmail: string | null;
  resendFrom: string;
  enableEmailDelivery: boolean;
  cronSecret: string;
  nodeEnv: "development" | "production" | "test";
  teamsWebhookUrl: string | undefined;
  // Placeholders — undefined until the relevant integration is wired in:
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  clerkPublishableKey: string | undefined;
  clerkSecretKey: string | undefined;
  inngestEventKey: string | undefined;
  inngestSigningSecret: string | undefined;
}

export function getEnv(): AppEnv {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) throw new Error("Missing required environment variable: ANTHROPIC_API_KEY");

  const serperApiKey = process.env.SERPER_API_KEY;
  if (!serperApiKey) throw new Error("Missing required environment variable: SERPER_API_KEY");

  return {
    anthropicApiKey,
    serperApiKey,
    resendApiKey: process.env.RESEND_API_KEY ?? null,
    reportToEmail: process.env.REPORT_TO_EMAIL ?? null,
    resendFrom: process.env.RESEND_FROM ?? "",
    enableEmailDelivery: process.env.ENABLE_EMAIL_DELIVERY === "true",
    cronSecret: process.env.CRON_SECRET ?? "",
    nodeEnv: (process.env.NODE_ENV as "development" | "production" | "test") ?? "development",
    teamsWebhookUrl: process.env.TEAMS_WEBHOOK_URL,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    clerkSecretKey: process.env.CLERK_SECRET_KEY,
    inngestEventKey: process.env.INNGEST_EVENT_KEY,
    inngestSigningSecret: process.env.INNGEST_SIGNING_SECRET,
  };
}
