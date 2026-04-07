// api/settings/test — proxy for connection tests in non-Electron contexts

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { service, key } = await req.json();

  if (!service || !key) {
    return NextResponse.json({ ok: false, error: "Missing service or key" }, { status: 400 });
  }

  try {
    if (service === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 10,
          messages: [{ role: "user", content: "ping" }],
        }),
      });
      return NextResponse.json({ ok: res.status !== 401 && res.status !== 403 });
    }

    if (service === "serper") {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
        body: JSON.stringify({ q: "test", num: 1 }),
      });
      return NextResponse.json({ ok: res.ok });
    }

    if (service === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "test@resend.dev",
          to: "test@resend.dev",
          subject: "ping",
          html: "<p>ping</p>",
        }),
      });
      return NextResponse.json({ ok: res.status !== 401 && res.status !== 403 });
    }

    return NextResponse.json({ ok: false, error: "Unknown service" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
