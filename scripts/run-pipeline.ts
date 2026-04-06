// scripts/run-pipeline.ts
// Standalone CLI runner for the VAR Hunter pipeline.
//
// Usage:
//   npm run pipeline                        — full run
//   npm run pipeline -- --dry-run           — Watchtower only, no LLM/delivery
//   npm run pipeline -- --backfill          — broader historical queries
//   npm run pipeline -- --dry-run --backfill
//
// Must be run from the project root (where .env.local lives).

import * as fs from "fs";
import * as path from "path";

// ─── LOAD .env.local ─────────────────────────────────────────────────────────
// tsx does not auto-load .env.local — we parse it manually before importing
// any module that reads process.env at call time.

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} else {
  console.error(`\n[pipeline] .env.local not found at: ${envPath}`);
  console.error("[pipeline] Copy .env.local.example → .env.local and fill in your keys.\n");
  process.exit(1);
}

// ─── TYPES ───────────────────────────────────────────────────────────────────
// Imported statically here only for type-checking — the actual module is loaded
// dynamically in main() so that env vars are set before the Anthropic client
// is instantiated in claude.ts.

import type { OrchestratorResult } from "@/agents/orchestrator";

// ─── CLI FLAGS ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun   = args.includes("--dry-run");
const backfill = args.includes("--backfill");
const help     = args.includes("--help") || args.includes("-h");

if (help) {
  console.log(`
Usage: npm run pipeline [-- <flags>]

Flags:
  --dry-run    Watchtower stage only — no Detective, Salesman, or email delivery
  --backfill   Use broader historical queries instead of today's daily queries
  --help       Show this message
`);
  process.exit(0);
}

// ─── ENV VALIDATION ──────────────────────────────────────────────────────────

const REQUIRED: string[] = ["ANTHROPIC_API_KEY", "SERPER_API_KEY"];
const OPTIONAL: string[] = [
  "RESEND_API_KEY",
  "REPORT_TO_EMAIL",
  "RESEND_FROM",
  "TEAMS_WEBHOOK_URL",
];

function validateEnv(): void {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`\n[pipeline] Missing required env vars: ${missing.join(", ")}`);
    console.error("[pipeline] Add them to .env.local and re-run.\n");
    process.exit(1);
  }
}

function printEnvSummary(): void {
  const redact = (k: string, v: string) =>
    k.toLowerCase().includes("key") ||
    k.toLowerCase().includes("secret") ||
    k.toLowerCase().includes("webhook")
      ? `${v.slice(0, 8)}...`
      : v;

  console.log("  Environment:");
  for (const k of REQUIRED) {
    const v = process.env[k]!;
    console.log(`    ✓ ${k.padEnd(22)} ${redact(k, v)}`);
  }
  for (const k of OPTIONAL) {
    const v = process.env[k];
    if (v) {
      console.log(`    ✓ ${k.padEnd(22)} ${redact(k, v)}`);
    } else {
      console.log(`    ○ ${k.padEnd(22)} not set`);
    }
  }
}

// ─── FORMATTING HELPERS ──────────────────────────────────────────────────────

const HR  = "─".repeat(56);
const HR2 = "═".repeat(56);

function printHeader(): void {
  console.log(`\n╔${HR2}╗`);
  console.log(`║${"  CLOUDBOX VAR HUNTER — PIPELINE RUNNER".padEnd(56)}║`);
  console.log(`╚${HR2}╝`);

  const modes: string[] = [];
  if (dryRun)   modes.push("DRY RUN");
  if (backfill) modes.push("BACKFILL");
  if (!dryRun && !backfill) modes.push("FULL RUN");

  console.log(`\n  Mode: ${modes.join(" + ")}`);
  console.log(`  Time: ${new Date().toLocaleString()}`);
  console.log(`\n${HR}`);
  printEnvSummary();
  console.log(`${HR}\n`);
}

function printSummary(result: OrchestratorResult, elapsedMs: number): void {
  const secs = (elapsedMs / 1000).toFixed(1);

  console.log(`\n╔${HR2}╗`);
  console.log(`║${"  PIPELINE COMPLETE".padEnd(56)}║`);
  console.log(`╚${HR2}╝`);
  console.log(`\n  Time elapsed    : ${secs}s`);
  console.log(`  Leads found     : ${result.totalLeadsFound}`);
  console.log(`  Avg relevance   : ${result.avgRelevanceScore}/10`);
  console.log(`  Context filtered: ${result.contextFiltered}`);
  console.log(`  Reports sent    : ${result.processed}`);
  console.log(`  Errors          : ${result.errors}`);

  if (result.reports.length > 0) {
    console.log(`\n  Reports generated:`);
    for (const r of result.reports) {
      const fit = `${r.varFitScore.fitCategory} (${r.varFitScore.overallScore}/10)`;
      console.log(`    • ${r.companyName}`);
      console.log(`      → ${r.decisionMaker}, ${r.title}`);
      console.log(`        Fit: ${fit}`);
      if (r.companyWebsite) console.log(`        Web: ${r.companyWebsite}`);
    }
  } else if (!dryRun) {
    console.log(`\n  No reports generated this run.`);
    if (result.totalLeadsFound === 0) {
      console.log(`  (No new leads found — all seen before, or search returned nothing)`);
    } else if (result.contextFiltered > 0) {
      console.log(`  (${result.contextFiltered} lead(s) filtered out by context gate)`);
    }
  }

  console.log("");
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  validateEnv();
  printHeader();

  // Dynamic import ensures env vars are set before claude.ts instantiates
  // the Anthropic client at module load time (static imports are hoisted in ESM).
  const { runOrchestrator } = await import("@/agents/orchestrator");

  const start = Date.now();

  try {
    const result = await runOrchestrator({ dryRun, backfill });
    printSummary(result, Date.now() - start);

    // Non-zero exit if the run produced errors and no successful reports
    process.exit(result.errors > 0 && result.processed === 0 ? 1 : 0);
  } catch (e) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`\n[pipeline] Fatal error after ${elapsed}s:`);
    console.error(e);
    process.exit(1);
  }
}

main();
