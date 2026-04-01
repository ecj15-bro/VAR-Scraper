// lib/claude.ts — Anthropic API wrapper

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function askClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const msg = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = msg.content[0];
  return block.type === "text" ? block.text : "";
}
