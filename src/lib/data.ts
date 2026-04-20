// lib/data.ts — Data access layer.
// All agents import from here, never directly from store.ts.
// When we migrate to Supabase, only this file changes — agent logic is untouched.
export * from "./store";
