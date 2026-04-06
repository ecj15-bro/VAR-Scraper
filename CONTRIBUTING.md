# Contributing to Cloudbox VAR Hunter

## Agent Architecture

The pipeline is split into discrete agents under `src/agents/`. Each agent has a single responsibility and communicates via typed interfaces.

### Agent files

| File | Exports | Role |
|---|---|---|
| `watchtower.ts` | `runWatchtower(backfill)` | Searches Google News across 6 categories, deduplicates results, asks Claude to score each for VAR relevance (0–10), returns leads with score ≥ 6 |
| `context.ts` | `scoreVARFit()`, `enrichPitchContext()`, `evolveSearchParameters()` | All Claude-powered analysis: pre-scoring leads (Gate 1), enriching pitch context (Gate 2), and evolving search queries from history |
| `detective.ts` | `runDetective(leads)` | For each lead, searches the web for the company's decision maker and returns contact details |
| `salesman.ts` | `runSalesman(enrichedLeads)` | Generates five pitch variants per lead (cold email, LinkedIn, follow-up, text message, executive brief) |
| `knowledge.ts` | `refreshKnowledgeBase()` | Pulls current Cloudbox product context from the web and synthesizes it into a KB object for use across agents |
| `orchestrator.ts` | `runOrchestrator(opts)` | Runs the full pipeline in order, applies concurrency limiters, and returns the complete result |

### Adding a new search category

Edit the `SEARCH_CATEGORIES` array in `src/agents/watchtower.ts`. Each category needs:
- `name` — display label used in search history
- `dailyQueries` — 1–2 queries for normal daily runs
- `backfillQueries` — 2–3 broader queries for historical/backfill runs

### Modifying scoring criteria

The VAR fit scoring prompt is in `context.ts` → `scoreVARFit()`. The lead scoring prompt used by Watchtower is in `watchtower.ts` → `scoreBatch()`. Both use 0–10 scales.

The filter threshold is set in `orchestrator.ts`: leads must pass `isWorthPursuing()` (in `context.ts`) after Gate 1 to proceed to the Detective.

### Adding a new pitch variant

1. Add the key to `PitchVariants` in `src/agents/salesman.ts`
2. Add the variant to the JSON schema description in the `runSalesman` prompt
3. Add a tab to `PITCH_TABS` in `src/app/page.tsx`

### Shared utilities

| File | Purpose |
|---|---|
| `src/lib/store.ts` | All file-based persistence — reports, search history, seen companies, knowledge base |
| `src/lib/claude.ts` | Thin wrapper around the Anthropic SDK (`askClaude`) |
| `src/lib/search.ts` | Serper.dev search wrapper (`searchNews`, `searchWeb`) |
| `src/lib/email.ts` | Resend email delivery (gated by `ENABLE_EMAIL_DELIVERY`) |
| `src/lib/teams.ts` | Microsoft Teams webhook delivery |

### Prompt conventions

- Never use em dashes (`—`) in any agent prompt or generated content
- All LLM calls go through `askClaude()` in `src/lib/claude.ts`
- Prompts that return structured data should ask for plain JSON with no markdown fences, and parse with a try/catch

### Running locally

```bash
# Dev server + dashboard
npm run dev

# CLI pipeline (loads .env.local, runs full pipeline)
npm run pipeline

# Dry run (skips delivery)
npm run pipeline:dry
```

### API routes

All Next.js API routes are under `src/app/api/`. The cron and backfill routes require `Authorization: Bearer <CRON_SECRET>` in production.
