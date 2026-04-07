// lib/claude.ts — Anthropic API wrapper

import Anthropic from "@anthropic-ai/sdk";
import { getConfig } from "./config";

// Lazy singleton: reuse the same client across calls within a process lifetime.
// Re-instantiated only if the API key changes (e.g. after the user updates settings).
let _client: Anthropic | null = null;
let _clientKey = "";

async function getClient(): Promise<Anthropic> {
  const config = await getConfig();
  if (!_client || _clientKey !== config.ANTHROPIC_API_KEY) {
    _client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
    _clientKey = config.ANTHROPIC_API_KEY;
  }
  return _client;
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
