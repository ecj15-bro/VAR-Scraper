"use client";

// SessionInit — Sets a persistent session-id cookie on first visit.
// The cookie is sent automatically with every same-origin API request,
// enabling per-user data isolation in Vercel/web mode.
// In Electron mode, window.electronAPI is present — session is not needed.

import { useEffect } from "react";

export function SessionInit() {
  useEffect(() => {
    // Skip in Electron — file store handles single-user data natively
    if (typeof window !== "undefined" && (window as any).electronAPI) return;

    // Read existing session from cookie
    const existing = document.cookie
      .split("; ")
      .find((c) => c.startsWith("session-id="))
      ?.split("=")[1];

    if (!existing) {
      // Generate a new UUID and persist it as a 1-year cookie
      const id = crypto.randomUUID();
      const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `session-id=${id}; path=/; expires=${expires}; SameSite=Strict`;
    }
  }, []);

  return null;
}
