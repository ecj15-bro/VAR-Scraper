// lib/search.ts — Serper.dev web search wrapper

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  source?: string;
}

export async function searchWeb(query: string, num = 10): Promise<SearchResult[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num }),
  });

  if (!res.ok) throw new Error(`Serper error: ${res.status}`);
  const data = await res.json();

  return (data.organic ?? []).map((r: any) => ({
    title: r.title,
    link: r.link,
    snippet: r.snippet,
    source: r.displayLink,
  }));
}

export async function searchNews(query: string, num = 10): Promise<SearchResult[]> {
  const res = await fetch("https://google.serper.dev/news", {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num }),
  });

  if (!res.ok) throw new Error(`Serper news error: ${res.status}`);
  const data = await res.json();

  return (data.news ?? []).map((r: any) => ({
    title: r.title,
    link: r.link,
    snippet: r.snippet,
    source: r.source,
  }));
}
