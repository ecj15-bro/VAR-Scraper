# Cloudbox VAR Hunter

Automated lead generation pipeline that scans the web daily for VAR (Value Added Reseller) partnership announcements, scores and enriches each company, generates personalized pitch content, and delivers reports to your Microsoft Teams channel and dashboard.

---

## Architecture

The pipeline runs five agents in sequence:

```
WATCHTOWER → [Gate 1] → DETECTIVE → [Gate 2] → SALESMAN → Email / Teams
```

| Agent | File | What it does |
|---|---|---|
| **Watchtower** | `src/agents/watchtower.ts` | Runs search queries across 6 categories, deduplicates results, scores each for VAR relevance (0–10), filters to score ≥ 6 |
| **Context Gate 1** | `src/agents/context.ts` | Scores each lead for VAR fit category (champion / solid / borderline / avoid) using company context; drops low-fit leads before expensive enrichment |
| **Detective** | `src/agents/detective.ts` | Finds the decision maker at each company via web search; returns name, title, LinkedIn URL, and contact context |
| **Context Gate 2** | `src/agents/context.ts` | Enriches pitch context with Cloudbox-specific angles; identifies pain points and use cases for the specific company |
| **Salesman** | `src/agents/salesman.ts` | Generates five pitch variants per lead: cold email, LinkedIn message, follow-up email, text message, executive brief |

Search evolution runs at the start of every pipeline run — the context agent analyzes 90 days of query history and automatically retires underperforming queries, adds new ones, and flags saturating queries.

A separate knowledge refresh cron runs at 6am UTC daily to keep the Cloudbox knowledge base current.

---

## Prerequisites

- Node.js 18+
- [Anthropic API key](https://console.anthropic.com) (required)
- [Serper.dev API key](https://serper.dev) (required — free tier: 2,500 searches/month)
- Microsoft Teams Incoming Webhook URL (optional)
- [Resend](https://resend.com) API key (optional — only if `ENABLE_EMAIL_DELIVERY=true`)

---

## Local Setup

```bash
git clone <repo-url>
cd cloudbox-var-hunter

npm install

cp .env.local.example .env.local
# Edit .env.local and fill in your API keys

npm run dev
# Dashboard: http://localhost:3000
```

### Run the pipeline locally

```bash
# Full pipeline run
npm run pipeline

# Dry run — runs all agents but skips email/Teams delivery
npm run pipeline:dry

# Backfill run — uses broader historical search queries
npm run pipeline:backfill
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key — all LLM calls go through this |
| `SERPER_API_KEY` | Yes | Serper.dev key for Google News/Search |
| `CRON_SECRET` | Production | Protects the `/api/cron`, `/api/backfill`, and `/api/refresh-knowledge` endpoints |
| `TEAMS_WEBHOOK_URL` | Optional | Microsoft Teams Incoming Webhook URL for pipeline result delivery |
| `ENABLE_EMAIL_DELIVERY` | Optional | Set to `true` to enable email delivery via Resend (default: `false`) |
| `RESEND_API_KEY` | If email enabled | Resend API key |
| `REPORT_TO_EMAIL` | If email enabled | Recipient email address for reports |
| `RESEND_FROM` | If email enabled | Sender address (default: `reports@cloudboxapp.com`) |

---

## Vercel Deployment

```bash
npm i -g vercel
vercel

# Add required env vars
vercel env add ANTHROPIC_API_KEY
vercel env add SERPER_API_KEY
vercel env add CRON_SECRET

# Add optional env vars as needed
vercel env add TEAMS_WEBHOOK_URL
vercel env add ENABLE_EMAIL_DELIVERY

vercel --prod
```

Or deploy via the Vercel dashboard by importing this repo and adding the env vars in project settings.

The cron schedule is defined in `vercel.json`:
- `6am UTC` — knowledge base refresh (`/api/refresh-knowledge`)
- `9am UTC` — main pipeline run (`/api/cron`)

Both endpoints require the `Authorization: Bearer <CRON_SECRET>` header (set automatically by Vercel).

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `GET /api/reports` | GET | None | Returns all stored reports, knowledge base, and search evolution state |
| `DELETE /api/reports?id=<id>` | DELETE | None | Delete a single report by ID |
| `DELETE /api/reports?all=true` | DELETE | None | Clear all reports and reset seen-companies list |
| `POST /api/run` | POST | None | Manually trigger the pipeline |
| `GET /api/cron` | GET | CRON_SECRET | Vercel cron — daily pipeline run |
| `GET /api/backfill` | GET | CRON_SECRET | Run backfill scan with broader historical queries |
| `GET /api/refresh-knowledge` | GET | CRON_SECRET | Refresh the Cloudbox knowledge base |

---

## Storage

The app uses `os.tmpdir()/var-hunter-store.json` for file-based storage. On Vercel, `/tmp` persists within a deployment instance but resets on cold start — meaning reports can be lost between invocations.

For persistent storage, replace `src/lib/store.ts` with:
- **Vercel KV** (Redis) — recommended, free tier available
- **PlanetScale** or **Supabase** for a full relational database

---

## Troubleshooting

**Pipeline runs but no leads appear**
- Check `SERPER_API_KEY` is valid and has remaining quota
- Check the terminal/Vercel logs for scoring output — if all leads score < 6 they are filtered
- Run `npm run pipeline:backfill` for a broader initial scan

**Rate limit errors (429)**
- The pipeline uses a concurrency limiter (max 5 parallel Claude calls). If you still hit limits, reduce the limiter in `src/agents/orchestrator.ts`

**Teams notifications not arriving**
- Verify `TEAMS_WEBHOOK_URL` is set and the webhook is still active in Teams
- Check the channel connector settings — webhooks can be disabled or expire

**Email delivery not working**
- Confirm `ENABLE_EMAIL_DELIVERY=true` is set in `.env.local`
- Confirm the sending domain is verified in your Resend account
