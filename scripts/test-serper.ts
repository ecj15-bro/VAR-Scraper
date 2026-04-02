// scripts/test-serper.ts
// Quick smoke test for the Serper news endpoint.
// Run with: npx tsx scripts/test-serper.ts
// Requires SERPER_API_KEY in your .env.local

import * as fs from "fs";
import * as path from "path";

// Load .env.local manually (tsx doesn't auto-load it)
const envPath = path.resolve(process.cwd(), ".env.local");
console.log(`\n📂 Resolved .env.local path: ${envPath}`);
console.log(`   Expected:                  C:\\Users\\asus\\Desktop\\Projects\\cloudbox-var-hunter\\.env.local`);
console.log(`   Match: ${envPath === "C:\\Users\\asus\\Desktop\\Projects\\cloudbox-var-hunter\\.env.local" ? "✅ YES" : "❌ NO"}`);
console.log(`   File exists: ${fs.existsSync(envPath) ? "✅ YES" : "❌ NO — .env.local not found at this path"}\n`);
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
}

const SERPER_API_KEY = process.env.SERPER_API_KEY;
if (!SERPER_API_KEY) {
  console.error("❌ SERPER_API_KEY is not set. Add it to .env.local");
  process.exit(1);
}

const QUERY = "IT reseller partnership 2026";

async function main() {
  console.log(`\n🔍 Querying Serper news endpoint...`);
  console.log(`   Query: "${QUERY}"\n`);

  const res = await fetch("https://google.serper.dev/news", {
    method: "POST",
    headers: {
      "X-API-KEY": SERPER_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: QUERY, num: 5 }),
  });

  console.log(`Status: ${res.status} ${res.statusText}\n`);

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
