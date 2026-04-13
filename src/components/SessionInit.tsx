"use client";

// SessionInit — Manages the user-facing session key system.
// On first visit: shows a full-screen modal with the generated session key.
// On return visits: reads key from localStorage, sets cookie silently, skips modal.
// The session-id cookie is kept for existing API request propagation (extractSessionId).

import { useEffect, useState } from "react";

export const LS_SESSION_KEY = "var-hunter-session-id";
export const LS_MODAL_SHOWN = "var-hunter-modal-shown";
export const LS_KEY_COPIED = "var-hunter-key-copied";

function lsAvailable(): boolean {
  try {
    localStorage.setItem("__probe__", "1");
    localStorage.removeItem("__probe__");
    return true;
  } catch {
    return false;
  }
}

function setSessionCookie(id: string) {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `session-id=${id}; path=/; expires=${expires}; SameSite=Strict`;
}

export function SessionInit() {
  const [showModal, setShowModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [sessionKey, setSessionKey] = useState("");
  const [checked, setChecked] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if ((window as any).electronAPI) return;

    const hasLS = lsAvailable();

    if (!hasLS) {
      setShowBanner(true);
      // Private browsing: check cookie from current tab
      const cookieId = document.cookie
        .split("; ")
        .find((c) => c.startsWith("session-id="))
        ?.split("=")[1];
      if (!cookieId) {
        const id = crypto.randomUUID();
        setSessionCookie(id);
        setSessionKey(id);
        setShowModal(true);
      }
      return;
    }

    let id = localStorage.getItem(LS_SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(LS_SESSION_KEY, id);
    }

    setSessionCookie(id);

    if (localStorage.getItem(LS_MODAL_SHOWN) !== "1") {
      setSessionKey(id);
      setShowModal(true);
    }
  }, []);

  const handleCopy = async () => {
    if (!sessionKey) return;
    await navigator.clipboard.writeText(sessionKey);
    setCopied(true);
    try { localStorage.setItem(LS_KEY_COPIED, "1"); } catch {}
  };

  const handleEnter = () => {
    try { localStorage.setItem(LS_MODAL_SHOWN, "1"); } catch {}
    setShowModal(false);
  };

  return (
    <>
      {showBanner && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10000,
            background: "#4a3200",
            borderBottom: "1px solid #ffaa00",
            padding: "10px 24px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            color: "#ffcc44",
          }}
        >
          <span>⚠</span>
          <span>
            You are in private browsing mode. Your session key will not be saved when you close this tab. Copy your key now to avoid losing access.
          </span>
        </div>
      )}

      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.93)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "40px 48px",
              maxWidth: 560,
              width: "100%",
              fontFamily: "'Space Mono', monospace",
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "2.5px",
                color: "var(--muted)",
                marginBottom: 14,
                textTransform: "uppercase",
              }}
            >
              Cloudbox VAR Hunter
            </div>

            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                margin: "0 0 16px 0",
                color: "#e8e8f0",
                letterSpacing: "-0.5px",
              }}
            >
              Your Session Key
            </h1>

            <p
              style={{
                fontSize: 13,
                color: "#b0b0c8",
                lineHeight: 1.75,
                margin: "0 0 28px 0",
              }}
            >
              This key is your only way to access your data across devices. We do not
              store your identity — this key <em>IS</em> your account. Copy it and
              keep it somewhere safe. If you lose it, your data cannot be recovered.
            </p>

            {/* Key display */}
            <div
              style={{
                background: "rgba(0,255,136,0.04)",
                border: "2px solid rgba(0,255,136,0.45)",
                borderRadius: 8,
                padding: "16px 20px",
                marginBottom: 16,
              }}
            >
              <code
                style={{
                  fontSize: 14,
                  letterSpacing: "0.5px",
                  color: "#00ff88",
                  wordBreak: "break-all",
                  display: "block",
                  lineHeight: 1.65,
                }}
              >
                {sessionKey}
              </code>
            </div>

            {/* Copy button */}
            <button
              onClick={handleCopy}
              style={{
                width: "100%",
                padding: "11px",
                border: `1px solid ${copied ? "rgba(0,255,136,0.4)" : "var(--border)"}`,
                borderRadius: 6,
                background: copied ? "rgba(0,255,136,0.08)" : "rgba(255,255,255,0.03)",
                color: copied ? "var(--accent)" : "#e8e8f0",
                cursor: "pointer",
                fontFamily: "'Space Mono', monospace",
                fontSize: 13,
                marginBottom: 24,
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {copied ? "✓ Copied to clipboard" : "Copy Key"}
            </button>

            {/* Checkbox */}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                cursor: "pointer",
                marginBottom: 24,
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                style={{
                  marginTop: 2,
                  accentColor: "var(--accent)",
                  width: 16,
                  height: 16,
                  flexShrink: 0,
                  cursor: "pointer",
                }}
              />
              <span style={{ fontSize: 13, color: "#b0b0c8", lineHeight: 1.55 }}>
                I have saved my key somewhere safe
              </span>
            </label>

            {/* Enter button */}
            <button
              onClick={handleEnter}
              disabled={!checked}
              style={{
                width: "100%",
                padding: "13px",
                border: "none",
                borderRadius: 6,
                background: checked ? "var(--accent)" : "rgba(255,255,255,0.07)",
                color: checked ? "#000" : "var(--muted)",
                cursor: checked ? "pointer" : "not-allowed",
                fontFamily: "'Space Mono', monospace",
                fontSize: 14,
                fontWeight: 700,
                transition: "background 0.2s, color 0.2s",
              }}
            >
              Enter the app
            </button>
          </div>
        </div>
      )}
    </>
  );
}
