// lib/claude.ts — Anthropic API wrapper

import Anthropic from "@anthropic-ai/sdk";
import { getConfig } from "./config";

// Client is constructed per-call so each request uses its own session's API key.
// Module-level caching is intentionally avoided: in Fluid Compute, a shared instance
// would bleed one user's key into concurrent requests from other sessions.
async function getClient(): Promise<Anthropic> {
  const config = await getConfig();
  return new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
}

export async function askClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const client = await getClient();
  const msg = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = msg.content[0];
  return block.type === "text" ? block.text : "";
}
