# Cloudbox VAR Hunter

Automated lead generation pipeline that scans the web daily for VAR (Value Added Reseller) partnership announcements, scores and enriches each company, generates personalized pitch content, and delivers reports to your Microsoft Teams channel and dashboard.

---

## How to Install and Run (Beginner-Friendly)

Follow these steps in order. Each step builds on the last.

---

### Step 1 — Install Node.js

Node.js is the engine that runs this app.

1. Go to [nodejs.org](https://nodejs.org)
2. Download the **LTS** version (the one labelled "Recommended For Most Users")
3. Run the installer and click through the defaults
4. To confirm it worked, open a terminal and run:
   ```
   node -v
   ```
   You should see a version number like `v20.x.x`.

> **What is a terminal?**
> On Windows: press `Win + R`, type `cmd`, press Enter.
> On Mac: press `Cmd + Space`, type `Terminal`, press Enter.

---

### Step 2 — Download this project

1. Click the green **Code** button at the top of this GitHub page
2. Click **Download ZIP**
3. Unzip the folder somewhere easy to find (e.g. your Desktop)

Or, if you have Git installed:
```
git clone https://github.com/ecj15-bro/VAR-Scraper.git
cd VAR-Scraper
```

---

### Step 3 — Open the project in your terminal

In your terminal, navigate into the project folder:

```
cd path/to/cloudbox-var-hunter
```

For example, if you unzipped it to your Desktop on Windows:
```
cd C:\Users\YourName\Desktop\cloudbox-var-hunter
```

---

### Step 4 — Install dependencies

This downloads all the code libraries the app needs. Run:

```
npm install
```

Wait for it to finish. You will see a progress bar and then a summary. This is normal.

---

### Step 5 — Get your API keys

This app needs two API keys to work. An API key is like a password that gives the app permission to use an external service.

**Anthropic API key** (powers the AI)
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up for a free account
3. Go to **API Keys** and click **Create Key**
4. Copy the key — it starts with `sk-ant-`

**Serper API key** (powers the web search)
1. Go to [serper.dev](https://serper.dev)
2. Sign up for a free account (includes 2,500 free searches/month)
3. Your API key will be shown on the dashboard
4. Copy it

---

### Step 6 — Set up your environment file

The app reads your API keys from a file called `.env.local`. You need to create this from the example template.

1. In your terminal (inside the project folder), run:
   ```
   cp .env.local.example .env.local
   ```
   On Windows:
   ```
   copy .env.local.example .env.local
   ```

2. Open `.env.local` in any text editor (Notepad works fine)

3. Replace the placeholder values with your actual keys:
   ```
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   SERPER_API_KEY=your-serper-key-here
   ```

4. Save the file

> The `.env.local` file is listed in `.gitignore` so it will never be accidentally uploaded to GitHub. Keep your keys private.

---

### Step 7 — Start the app

```
npm run dev
```

Open your browser and go to:
```
http://localhost:3000
```

You should see the Cloudbox VAR Hunter dashboard. The app is now running on your computer.

---

### Step 8 — Run the pipeline

From the dashboard, click **Run Pipeline** to kick off a scan. Or run it from the terminal:

```
npm run pipeline
```

Other pipeline options:

| Command | What it does |
|---|---|
| `npm run pipeline` | Full pipeline run |
| `npm run pipeline:dry` | Dry run — runs all agents but skips notifications |
| `npm run pipeline:backfill` | Broader scan using historical search queries |

---

## Environment Variables

All variables go in your `.env.local` file.

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key — all AI calls use this |
| `SERPER_API_KEY` | Yes | Serper.dev key for Google News/Search |
| `CRON_SECRET` | Production only | Protects scheduled job endpoints |
| `TEAMS_WEBHOOK_URL` | Optional | Microsoft Teams webhook for report delivery |
| `ENABLE_EMAIL_DELIVERY` | Optional | Set to `true` to enable email via Resend |
| `RESEND_API_KEY` | If email enabled | Resend API key |
| `REPORT_TO_EMAIL` | If email enabled | Where to send reports |
| `RESEND_FROM` | If email enabled | Sender address (must be verified in Resend) |

---

## How the Pipeline Works

The pipeline runs five AI agents in sequence:

```
WATCHTOWER → [Gate 1] → DETECTIVE → [Gate 2] → SALESMAN → Teams / Email
```

| Agent | What it does |
|---|---|
| **Watchtower** | Searches the web across 6 categories, scores each result for VAR relevance (0–10), keeps scores ≥ 6 |
| **Context Gate 1** | Rates each lead for VAR fit (champion / solid / borderline / avoid); drops low-fit leads |
| **Detective** | Finds the key decision maker at each company — name, title, LinkedIn |
| **Context Gate 2** | Enriches the pitch with company-specific pain points and use cases |
| **Salesman** | Writes five pitch variants per lead: cold email, LinkedIn message, follow-up, text, executive brief |

Search queries evolve automatically — the context agent reviews 90 days of history at the start of each run and retires underperforming queries.

---

## Vercel Deployment (Hosting Online)

If you want the pipeline to run automatically every day without keeping your computer on, you can deploy it to Vercel for free.

```bash
npm i -g vercel
vercel link
vercel env add ANTHROPIC_API_KEY
vercel env add SERPER_API_KEY
vercel env add CRON_SECRET
vercel --prod
```

The automatic schedule (defined in `vercel.json`):
- **6:00 AM UTC** — refreshes the knowledge base
- **9:00 AM UTC** — runs the main pipeline

---

## Troubleshooting

**Pipeline runs but no leads appear**
- Check that `SERPER_API_KEY` is valid and has remaining quota
- Check terminal logs — if all leads score below 6 they are filtered out
- Try `npm run pipeline:backfill` for a broader initial scan

**Rate limit errors (429)**
- The pipeline limits parallel AI calls to 5. If errors persist, reduce the limiter in `src/agents/orchestrator.ts`

**Teams notifications not arriving**
- Verify `TEAMS_WEBHOOK_URL` is correct and the webhook is still active in Teams

**Email not working**
- Confirm `ENABLE_EMAIL_DELIVERY=true` is in `.env.local`
- Confirm the sender domain is verified in your Resend account
