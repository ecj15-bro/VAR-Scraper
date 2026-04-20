# VAR Hunter 2.0 — Architecture Map

This document is the canonical dependency map for the codebase.
It exists to make multi-tenant SaaS migration unambiguous.

---

## Layer: Pure Pipeline Logic — `src/agents/`

These files are **never modified per client**. They contain business reasoning:
scoring logic, search strategies, pitch generation, pipeline coordination.
All external dependencies are injected through the lib layer below.

| File | Role |
|------|------|
| `agents/watchtower.ts` | Stage 1 — Finds VAR leads via Serper news search |
| `agents/detective.ts` | Stage 2 — Profiles each lead (company + decision maker) |
| `agents/salesman.ts` | Stage 3 — Generates 5 pitch variants per lead, saves report, triggers delivery |
| `agents/context.ts` | Intelligence layer — scores VAR fit, enriches pitch context, evolves search params |
| `agents/knowledge.ts` | Self-updating market intel agent (runs independently on its own cron) |
| `agents/orchestrator.ts` | Pipeline coordinator — Watchtower → Context gate → Detective → Context gate → Salesman |

**Imports agents should use:**
- Claude calls: `@/lib/claude` (already clean)
- Data reads/writes: `@/lib/data` (wraps store — swap here for Supabase)
- Delivery: `@/lib/deliver` (wraps email — swap here for Slack/Teams/webhook)
- Web search: `@/lib/search` (Serper wrapper)
- Brand/profile: `@/lib/brand`, `@/lib/business-profile`
- Environment: `@/lib/env` via the lib files above (agents never read process.env)

---

## Layer: Infrastructure / Delivery — `src/lib/`

These files are **swapped per environment**. They are the seams between
business logic and external systems. Changing an integration means changing
one file here — no agent changes required.

| File | Role | Swap target |
|------|------|-------------|
| `lib/data.ts` | Data access layer — re-exports store.ts | Replace internals with Supabase client |
| `lib/store.ts` | File-based JSON persistence (current implementation) | Replaced by Supabase tables |
| `lib/deliver.ts` | Delivery abstraction — currently wraps email.ts | Add Slack/Teams/webhook variants |
| `lib/email.ts` | Resend email delivery (current implementation) | Stays, just called via deliver.ts |
| `lib/claude.ts` | Anthropic SDK wrapper | Clean — agents already use this |
| `lib/search.ts` | Serper.dev web/news search | Swap for alternative search provider |
| `lib/brand.ts` | Brand config accessor (reads from data layer) | No change needed |
| `lib/business-profile.ts` | Business profile + WatchtowerConfig accessors | No change needed |
| `lib/session.ts` | Session stub (all sessions are "default" locally) | Replace with Clerk session resolution |
| `lib/concurrency.ts` | Async concurrency limiter for API rate limits | Stable utility, no swap needed |
| `lib/teams.ts` | Teams webhook sender (optional delivery channel) | Moves under deliver.ts |
| `lib/trigger.ts` | Pipeline trigger abstraction — currently calls runOrchestrator directly | Swap internals to Inngest event.send() |
| `lib/jobs.ts` | In-memory job registry | Replace with Supabase jobs table |
| `lib/env.ts` | Typed environment variable accessor with required-field validation | Stable — add new vars here |
| `lib/client-config.ts` | Per-client configuration shape and accessor | Stable shape — internals evolve |

---

## Layer: Configuration — env-driven, varies per client

| Source | Variables |
|--------|-----------|
| `.env.local` | `ANTHROPIC_API_KEY`, `SERPER_API_KEY`, `RESEND_API_KEY`, `REPORT_TO_EMAIL`, `RESEND_FROM`, `ENABLE_EMAIL_DELIVERY`, `CRON_SECRET`, `TEAMS_WEBHOOK_URL` |
| `client-config.json` (dev) | Per-client shape: companyName, primaryColor, whatTheySell, cronSchedule, etc. |
| `CLIENT_*` env vars (prod) | Same shape as client-config.json, read from environment |
| Future | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CLERK_*`, `INNGEST_*` (placeholders in env.ts) |

---

## Layer: UI — `src/app/`

Shared across all clients, brand-aware via `getBrandConfig()`. The brand color,
logo, and company name are read at runtime from the data layer — no hardcoding.

| File | Role |
|------|------|
| `app/layout.tsx` | Root layout wrapper |
| `app/page.tsx` | Main dashboard — reports, intelligence panel, polling run status |
| `app/settings/` | Settings page (brand config, business profile, API key management) |

---

## Layer: API Routes — `src/app/api/`

HTTP boundary layer. Routes validate requests, call lib functions, return JSON.
They do not contain business logic.

| Route | Method | Role |
|-------|--------|------|
| `api/run` | POST | Accept pipeline trigger → returns `{ accepted, jobId }` immediately |
| `api/status/[jobId]` | GET | Job status polling (pending / running / complete / error) |
| `api/cron` | GET | Vercel cron trigger (daily at 9am UTC) |
| `api/refresh-knowledge` | GET/POST | Knowledge base refresh (cron or manual) |
| `api/backfill` | POST | 30-day backfill run |
| `api/reports` | GET/DELETE | Report CRUD |
| `api/brand` | GET/POST | Brand config CRUD |
| `api/business-profile` | GET/POST | Business profile CRUD |
| `api/translate-context` | POST | Business profile → WatchtowerConfig via Claude |
| `api/export/*` | GET/POST | Export in JSON, CSV, XLSX, PDF, DOCX formats |

---

## Migration Checklist

When adding Supabase:
- [ ] Replace `lib/store.ts` internals in `lib/data.ts`
- [ ] Replace `lib/jobs.ts` with Supabase jobs table queries
- [ ] No agent files need to change

When adding Inngest:
- [ ] Replace `runOrchestrator()` call in `lib/trigger.ts` with `inngest.send()`
- [ ] Move orchestrator invocation to an Inngest function handler
- [ ] No API routes need to change

When adding Clerk:
- [ ] Replace `lib/session.ts` stub with Clerk session resolution
- [ ] Add `clientId` extraction from Clerk JWT to per-client config lookup
- [ ] No agent files need to change
