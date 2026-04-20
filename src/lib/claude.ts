// lib/claude.ts — Anthropic API wrapper
import Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "./env";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: getEnv().anthropicApiKey });
  return _client;
}

export async function askClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const msg = await getClient().messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = msg.content[0];
  return block.type === "text" ? block.text : "";
}
