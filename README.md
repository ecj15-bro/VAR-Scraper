# 📦 Cloudbox VAR Hunter

Automated pipeline that scans the internet daily for partnership news, identifies key decision makers at VAR/reseller companies, and delivers personalized Cloudbox pitches to your Microsoft Teams channel.

## How It Works

```
🔭 WATCHTOWER          🕵️ DETECTIVE           📋 REPORTER
─────────────          ─────────────           ────────────
Scans Google News  →   Finds key decision  →   LLM generates    →  📨 Teams
for tech partner-      maker via LinkedIn       personalized
ship announcements     + web search             Cloudbox pitch
```

The pipeline runs **daily at 9am UTC** via Vercel Cron, and you can also trigger it manually from the dashboard.

---

## Setup Guide

### 1. Get Your API Keys

**Serper.dev** (Google Search API)
- Go to [serper.dev](https://serper.dev)
- Sign up for a free account (2,500 searches/month free)
- Copy your API key from the dashboard

**Anthropic API**
- Go to [console.anthropic.com](https://console.anthropic.com)
- Copy your API key

**Microsoft Teams Webhook**
1. Open Teams and go to the channel where you want alerts
2. Click the `···` (More options) next to the channel name
3. Click **Manage channel** → **Connectors** → **Edit**
4. Find **Incoming Webhook** and click **Add** → **Add** → **Configure**
5. Give it a name like "Cloudbox VAR Hunter" and click **Create**
6. Copy the webhook URL

### 2. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Clone and enter the project
cd cloudbox-var-hunter

# Install dependencies
npm install

# Deploy
vercel

# Follow the prompts, then add environment variables:
vercel env add ANTHROPIC_API_KEY
vercel env add SERPER_API_KEY
vercel env add TEAMS_WEBHOOK_URL
vercel env add CRON_SECRET

# Redeploy with env vars
vercel --prod
```

Or deploy via the [Vercel dashboard](https://vercel.com/new) by importing this repo and adding the env vars in the project settings.

### 3. Configure Cron Secret in Vercel

In your Vercel project settings → Environment Variables, add:
- `CRON_SECRET` = any random string (e.g. run `openssl rand -hex 32`)

Then in Vercel project settings → Cron Jobs, the `/api/cron` job will appear automatically from `vercel.json`.

---

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `SERPER_API_KEY` | Serper.dev API key |
| `TEAMS_WEBHOOK_URL` | Microsoft Teams Incoming Webhook URL |
| `CRON_SECRET` | Random secret to protect the cron endpoint |

---

## Running Locally

```bash
cp .env.local.example .env.local
# Fill in your keys

npm install
npm run dev
# Open http://localhost:3000
```

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `GET /api/reports` | GET | Returns all stored VAR reports |
| `POST /api/run` | POST | Manually trigger the pipeline |
| `GET /api/cron` | GET | Vercel cron endpoint (requires `CRON_SECRET`) |

### Manual run with dry mode (no Teams message):
```bash
curl -X POST https://your-app.vercel.app/api/run \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

---

## Customizing Search Queries

Edit `src/lib/pipeline.ts` → `WATCHTOWER_QUERIES` to add or change the search terms used by the Watchtower.

## Upgrading Storage

The app uses `/tmp` file storage by default (resets on cold start on Vercel). For persistent storage, replace `src/lib/store.ts` with:
- **Vercel KV** (Redis) — recommended, free tier available
- **PlanetScale** or **Supabase** for a full database
