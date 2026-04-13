"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { DemoAccountMeta } from "@/lib/config";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface ApiSettings {
  ANTHROPIC_API_KEY: string;
  SERPER_API_KEY: string;
  RESEND_API_KEY: string;
  REPORT_TO_EMAIL: string;
  RESEND_FROM: string;
  ENABLE_EMAIL_DELIVERY: string;
}

interface BrandSettings {
  companyName: string;
  tagline: string;
  primaryColor: string;
  logoDataUrl: string;
}

interface BusinessProfile {
  companyName: string;
  websiteUrl: string;
  whatYouSell: string;
  whoBuysFromYou: string;
  whyChooseYou: string;
  avgDealSize: string;
  salesCycleLength: string;
  distributionModel: string[];
  lookingFor: string[];
}

interface WatchtowerSearchCategory {
  name: string;
  description: string;
  queries: string[];
  priority: "high" | "medium" | "low";
}

interface WatchtowerConfig {
  searchCategories: WatchtowerSearchCategory[];
  idealVARProfile: string;
  targetVerticals: string[];
  avoidVerticals: string[];
  partnerEcosystem: string[];
  dealSizeGuidance: string;
  pitchTone: string;
  keyValueProps: string[];
  redFlagPatterns: string[];
}

type Tab = "api" | "brand" | "business" | "demo" | "session";
type TestState = "idle" | "testing" | "ok" | "fail";

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────

const S = {
  input: {
    padding: "10px 12px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    color: "#e8e8f0",
    fontSize: 13,
    fontFamily: "'Space Mono', monospace",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  label: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 12,
    color: "var(--muted)",
    letterSpacing: "0.5px",
    display: "block",
    marginBottom: 6,
  },
  helper: {
    fontSize: 12,
    color: "#6b6b85",
    margin: "0 0 8px 0",
  },
  sectionTitle: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
    color: "var(--muted)",
    letterSpacing: "1px",
    marginBottom: 20,
    borderBottom: "1px solid var(--border)",
    paddingBottom: 10,
  },
  btnPrimary: {
    padding: "11px 24px",
    border: "none",
    borderRadius: 6,
    background: "var(--accent)",
    color: "#000",
    cursor: "pointer",
    fontFamily: "'Space Mono', monospace",
    fontSize: 13,
    fontWeight: 700,
  },
  btnSecondary: {
    padding: "11px 24px",
    border: "1px solid var(--border)",
    borderRadius: 6,
    background: "transparent",
    color: "var(--muted)",
    cursor: "pointer",
    fontFamily: "'Space Mono', monospace",
    fontSize: 13,
  },
} as const;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function statusIcon(s: TestState) {
  if (s === "testing") return <span style={{ color: "var(--warning)" }}>⟳</span>;
  if (s === "ok") return <span style={{ color: "var(--accent)" }}>✓</span>;
  if (s === "fail") return <span style={{ color: "var(--danger)" }}>✗</span>;
  return null;
}

// ─── SECRET FIELD ─────────────────────────────────────────────────────────────

function SecretField({
  label,
  helper,
  link,
  linkText,
  value,
  onChange,
  saved,
  optional,
}: {
  label: string;
  helper: string;
  link?: string;
  linkText?: string;
  value: string;
  onChange: (v: string) => void;
  saved: boolean;
  optional?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <label style={S.label}>{label}</label>
        {optional && (
          <span style={{ fontSize: 10, color: "var(--muted)", background: "rgba(107,107,133,0.15)", padding: "1px 6px", borderRadius: 4, fontFamily: "'Space Mono', monospace" }}>
            OPTIONAL
          </span>
        )}
        {saved && value && <span style={{ color: "var(--accent)", fontSize: 14 }}>✓</span>}
      </div>
      <p style={S.helper}>
        {helper}
        {link && linkText && (
          <> <a href={link} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>{linkText} ↗</a></>
        )}
      </p>
      <div style={{ position: "relative" }}>
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={optional ? "Leave blank to disable" : "Required"}
          style={{ ...S.input, paddingRight: 44, border: `1px solid ${value ? "rgba(0,255,136,0.3)" : "var(--border)"}` }}
        />
        <button type="button" onClick={() => setVisible((v) => !v)}
          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 14, padding: 4 }}>
          {visible ? "🙈" : "👁"}
        </button>
      </div>
    </div>
  );
}

// ─── MULTI-SELECT CHECKBOX ────────────────────────────────────────────────────

function MultiSelect({ label, options, value, onChange }: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    onChange(value.includes(opt) ? value.filter((x) => x !== opt) : [...value, opt]);
  };
  return (
    <div style={{ marginBottom: 24 }}>
      <label style={S.label}>{label}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((opt) => (
          <button key={opt} type="button" onClick={() => toggle(opt)}
            style={{
              padding: "6px 14px", borderRadius: 20, border: "1px solid",
              borderColor: value.includes(opt) ? "var(--accent)" : "var(--border)",
              background: value.includes(opt) ? "rgba(0,255,136,0.12)" : "transparent",
              color: value.includes(opt) ? "var(--accent)" : "var(--muted)",
              cursor: "pointer", fontFamily: "'Space Mono', monospace", fontSize: 11,
            }}>{opt}</button>
        ))}
      </div>
    </div>
  );
}

// ─── API KEYS TAB ─────────────────────────────────────────────────────────────

function ApiKeysTab({ onSaved }: { onSaved?: () => void }) {
  const [settings, setSettings] = useState<ApiSettings>({
    ANTHROPIC_API_KEY: "", SERPER_API_KEY: "", RESEND_API_KEY: "",
    REPORT_TO_EMAIL: "", RESEND_FROM: "", ENABLE_EMAIL_DELIVERY: "false",
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tests, setTests] = useState<Record<string, TestState>>({ anthropic: "idle", serper: "idle", resend: "idle" });

  useEffect(() => {
    async function load() {
      if (typeof window !== "undefined" && window.electronAPI) {
        const data = await window.electronAPI.getSettings();
        setSettings({
          ANTHROPIC_API_KEY: data.ANTHROPIC_API_KEY ?? "",
          SERPER_API_KEY: data.SERPER_API_KEY ?? "",
          RESEND_API_KEY: data.RESEND_API_KEY ?? "",
          REPORT_TO_EMAIL: data.REPORT_TO_EMAIL ?? "",
          RESEND_FROM: data.RESEND_FROM ?? "",
          ENABLE_EMAIL_DELIVERY: data.ENABLE_EMAIL_DELIVERY ?? "false",
        });
      } else {
        // Web/KV mode: load from API (cookie carries session-id automatically)
        try {
          const res = await fetch("/api/settings");
          if (res.ok) {
            const data = await res.json();
            setSettings({
              ANTHROPIC_API_KEY: data.ANTHROPIC_API_KEY ?? "",
              SERPER_API_KEY: data.SERPER_API_KEY ?? "",
              RESEND_API_KEY: data.RESEND_API_KEY ?? "",
              REPORT_TO_EMAIL: data.REPORT_TO_EMAIL ?? "",
              RESEND_FROM: data.RESEND_FROM ?? "",
              ENABLE_EMAIL_DELIVERY: data.ENABLE_EMAIL_DELIVERY ?? "false",
            });
          }
        } catch {}
      }
    }
    load();
  }, []);

  const missingRequired = !settings.ANTHROPIC_API_KEY.trim() || !settings.SERPER_API_KEY.trim();

  const handleSave = async () => {
    setSaving(true);
    try {
      if (typeof window !== "undefined" && window.electronAPI) {
        await window.electronAPI.saveSettings(settings);
      } else {
        // Web/KV mode: POST to API. Filter out placeholder masks so we don't
        // overwrite a saved key with the display placeholder "••••••••".
        const toSave = Object.fromEntries(
          Object.entries(settings).filter(([, v]) => v !== "" && v !== "••••••••")
        );
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toSave),
        });
        if (!res.ok) throw new Error("Failed to save settings");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const test = async (service: string, key: string) => {
    if (!key) return;
    setTests((p) => ({ ...p, [service]: "testing" }));
    try {
      let result: { ok: boolean };
      if (typeof window !== "undefined" && window.electronAPI) {
        result = await window.electronAPI.testConnection({ service, key });
      } else {
        const res = await fetch("/api/settings/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service, key }) });
        result = await res.json();
      }
      setTests((p) => ({ ...p, [service]: result.ok ? "ok" : "fail" }));
    } catch {
      setTests((p) => ({ ...p, [service]: "fail" }));
    }
    setTimeout(() => setTests((p) => ({ ...p, [service]: "idle" })), 5000);
  };

  return (
    <div>
      {missingRequired && (
        <div style={{ background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 8, padding: "12px 16px", marginBottom: 28, fontSize: 13, color: "#ff8080", fontFamily: "'Space Mono', monospace" }}>
          ⚠ Anthropic and Serper API keys are required to run the pipeline
        </div>
      )}

      <div style={S.sectionTitle}>REQUIRED</div>

      {[
        { key: "ANTHROPIC_API_KEY" as const, svc: "anthropic", label: "ANTHROPIC_API_KEY", helper: "Powers all Claude AI calls. Get yours at", link: "https://console.anthropic.com/settings/keys", linkText: "console.anthropic.com" },
        { key: "SERPER_API_KEY" as const, svc: "serper", label: "SERPER_API_KEY", helper: "Web and news search. Free tier: 2,500/month. Get yours at", link: "https://serper.dev", linkText: "serper.dev" },
      ].map(({ key, svc, label, helper, link, linkText }) => (
        <div key={key} style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <SecretField label={label} helper={helper} link={link} linkText={linkText}
              value={settings[key]} onChange={(v) => setSettings((p) => ({ ...p, [key]: v }))} saved={saved} />
          </div>
          <button onClick={() => test(svc, settings[key])} disabled={!settings[key] || tests[svc] === "testing"}
            style={{ ...S.btnSecondary, marginBottom: 24, fontSize: 11, padding: "10px 14px", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            Test {statusIcon(tests[svc])}
          </button>
        </div>
      ))}

      <div style={S.sectionTitle}>EMAIL DELIVERY (OPTIONAL)</div>

      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
        <label style={S.label}>ENABLE_EMAIL_DELIVERY</label>
        <button type="button" onClick={() => setSettings((p) => ({ ...p, ENABLE_EMAIL_DELIVERY: p.ENABLE_EMAIL_DELIVERY === "true" ? "false" : "true" }))}
          style={{ width: 44, height: 24, borderRadius: 12, border: "none", background: settings.ENABLE_EMAIL_DELIVERY === "true" ? "var(--accent)" : "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
          <span style={{ position: "absolute", top: 3, left: settings.ENABLE_EMAIL_DELIVERY === "true" ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
        </button>
        <span style={{ fontSize: 12, color: "#6b6b85" }}>{settings.ENABLE_EMAIL_DELIVERY === "true" ? "On" : "Off"}</span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <SecretField label="RESEND_API_KEY" helper="Resend API key for email delivery. Get yours at" link="https://resend.com/api-keys" linkText="resend.com"
            value={settings.RESEND_API_KEY} onChange={(v) => setSettings((p) => ({ ...p, RESEND_API_KEY: v }))} saved={saved} optional />
        </div>
        <button onClick={() => test("resend", settings.RESEND_API_KEY)} disabled={!settings.RESEND_API_KEY || tests.resend === "testing"}
          style={{ ...S.btnSecondary, marginBottom: 24, fontSize: 11, padding: "10px 14px", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          Test {statusIcon(tests.resend)}
        </button>
      </div>

      <SecretField label="REPORT_TO_EMAIL" helper="Recipient address for VAR opportunity reports."
        value={settings.REPORT_TO_EMAIL} onChange={(v) => setSettings((p) => ({ ...p, REPORT_TO_EMAIL: v }))} saved={saved} optional />

      <SecretField label="RESEND_FROM" helper="Sender address from a verified Resend domain. Defaults to onboarding@resend.dev for testing."
        value={settings.RESEND_FROM} onChange={(v) => setSettings((p) => ({ ...p, RESEND_FROM: v }))} saved={saved} optional />

      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <button onClick={handleSave} disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Saving..." : saved ? "✓ Saved" : "Save API Keys"}
        </button>
        <button onClick={() => Promise.all([
          settings.ANTHROPIC_API_KEY ? test("anthropic", settings.ANTHROPIC_API_KEY) : null,
          settings.SERPER_API_KEY ? test("serper", settings.SERPER_API_KEY) : null,
          settings.RESEND_API_KEY ? test("resend", settings.RESEND_API_KEY) : null,
        ])} style={S.btnSecondary}>
          Test All
        </button>
      </div>
    </div>
  );
}

// ─── BRAND TAB ────────────────────────────────────────────────────────────────

function BrandTab({ onSaved }: { onSaved?: () => void }) {
  const [brand, setBrand] = useState<BrandSettings>({
    companyName: "Cloudbox", tagline: "Multi-agent partner prospecting pipeline",
    primaryColor: "#00ff88", logoDataUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/brand").then((r) => r.json()).then((data) => {
      setBrand({
        companyName: data.companyName || "Cloudbox",
        tagline: data.tagline || "Multi-agent partner prospecting pipeline",
        primaryColor: data.primaryColor || "#00ff88",
        logoDataUrl: data.logoDataUrl || "",
      });
    }).catch(() => {});
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setBrand((p) => ({ ...p, logoDataUrl: ev.target?.result as string ?? "" }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brand),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const accent = brand.primaryColor || "#00ff88";

  return (
    <div>
      <div style={S.sectionTitle}>IDENTITY</div>

      <div style={{ marginBottom: 24 }}>
        <label style={S.label}>COMPANY NAME</label>
        <p style={S.helper}>Replaces "CLOUDBOX" everywhere: header, pitches, PDF, emails.</p>
        <input value={brand.companyName} onChange={(e) => setBrand((p) => ({ ...p, companyName: e.target.value }))} style={S.input} placeholder="Your company name" />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={S.label}>TAGLINE</label>
        <p style={S.helper}>Subtitle shown under the company name in the dashboard header.</p>
        <input value={brand.tagline} onChange={(e) => setBrand((p) => ({ ...p, tagline: e.target.value }))} style={S.input} placeholder="Short description of what you do" />
      </div>

      <div style={S.sectionTitle}>APPEARANCE</div>

      <div style={{ marginBottom: 28 }}>
        <label style={S.label}>PRIMARY ACCENT COLOR</label>
        <p style={S.helper}>Updates the green accent used throughout the UI, PDF exports, and fit indicators.</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input type="color" value={brand.primaryColor} onChange={(e) => setBrand((p) => ({ ...p, primaryColor: e.target.value }))}
            style={{ width: 52, height: 40, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", padding: 2 }} />
          <input value={brand.primaryColor} onChange={(e) => setBrand((p) => ({ ...p, primaryColor: e.target.value }))}
            style={{ ...S.input, width: 140 }} placeholder="#00ff88" />
          <div style={{ width: 40, height: 40, borderRadius: 8, background: accent, border: "1px solid rgba(255,255,255,0.1)" }} title="Color preview" />
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <label style={S.label}>LOGO</label>
        <p style={S.helper}>PNG, JPG, or SVG. Appears in the dashboard header and PDF exports. Recommended: 512×512px or wider.</p>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button type="button" onClick={() => fileRef.current?.click()}
            style={{ ...S.btnSecondary, fontSize: 12 }}>
            {brand.logoDataUrl ? "Replace logo" : "Upload logo"}
          </button>
          {brand.logoDataUrl && (
            <button type="button" onClick={() => setBrand((p) => ({ ...p, logoDataUrl: "" }))}
              style={{ ...S.btnSecondary, fontSize: 12, color: "#ff6666", borderColor: "rgba(255,102,102,0.3)" }}>
              Remove
            </button>
          )}
          <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.svg" onChange={handleLogoUpload} style={{ display: "none" }} />
        </div>
        {brand.logoDataUrl && (
          <div style={{ marginTop: 12, padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid var(--border)", display: "inline-block" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brand.logoDataUrl} alt="Logo preview" style={{ maxHeight: 64, maxWidth: 200, objectFit: "contain" }} />
          </div>
        )}
      </div>

      {/* Live header preview */}
      <div style={S.sectionTitle}>LIVE PREVIEW</div>
      <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 32 }}>
        <div style={{ background: "#0a0a0f", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          {brand.logoDataUrl
            ? <img src={brand.logoDataUrl} alt="" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 4 }} />
            : <div style={{ width: 32, height: 32, background: accent, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📦</div>
          }
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14, color: "#fff" }}>
              {brand.companyName.toUpperCase().split(" ").map((w, i, arr) => (
                <span key={i} style={{ color: i === arr.length - 1 ? accent : "#fff" }}>{w}{i < arr.length - 1 ? " " : ""}</span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "#6b6b85", marginTop: 2 }}>{brand.tagline}</div>
          </div>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        style={{ ...S.btnPrimary, opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
        {saving ? "Saving..." : saved ? "✓ Saved" : "Save Brand Settings"}
      </button>
    </div>
  );
}

// ─── BUSINESS TAB ─────────────────────────────────────────────────────────────

const DEAL_SIZE_OPTIONS = ["under10k", "10k-50k", "50k-100k", "100k+", "enterprise"];
const DEAL_SIZE_LABELS: Record<string, string> = { "under10k": "Under $10k", "10k-50k": "$10k–$50k", "50k-100k": "$50k–$100k", "100k+": "$100k+", "enterprise": "Enterprise" };
const CYCLE_OPTIONS = ["days", "weeks", "1-3months", "3-6months", "6months+"];
const CYCLE_LABELS: Record<string, string> = { "days": "Days", "weeks": "Weeks", "1-3months": "1–3 months", "3-6months": "3–6 months", "6months+": "6+ months" };
const DIST_OPTIONS = ["Direct sales", "Reseller channel", "Distributor", "Online", "Other"];
const PARTNER_OPTIONS = ["VARs", "Resellers", "Distributors", "Integration partners", "Referral partners", "OEM partners"];

function BusinessTab({ onSaved }: { onSaved?: () => void }) {
  const [profile, setProfile] = useState<BusinessProfile>({
    companyName: "", websiteUrl: "", whatYouSell: "", whoBuysFromYou: "",
    whyChooseYou: "", avgDealSize: "10k-50k", salesCycleLength: "1-3months",
    distributionModel: [], lookingFor: [],
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState<WatchtowerConfig | null>(null);
  const [expandedCat, setExpandedCat] = useState<number | null>(null);
  const [editableQueries, setEditableQueries] = useState<Record<number, string[]>>({});

  useEffect(() => {
    fetch("/api/business-profile").then((r) => r.json()).then((data) => {
      if (data) setProfile(data);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/business-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    setGeneratedConfig(null);
    try {
      const res = await fetch("/api/translate-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const data = await res.json();
      if (data.config) {
        setGeneratedConfig(data.config);
        const initQueries: Record<number, string[]> = {};
        data.config.searchCategories.forEach((cat: WatchtowerSearchCategory, i: number) => {
          initQueries[i] = [...cat.queries];
        });
        setEditableQueries(initQueries);
      }
    } finally {
      setGenerating(false);
    }
  };

  const saveWithConfig = async () => {
    if (!generatedConfig) return;
    setSaving(true);
    try {
      // Merge editable queries back
      const finalConfig = {
        ...generatedConfig,
        searchCategories: generatedConfig.searchCategories.map((cat, i) => ({
          ...cat,
          queries: editableQueries[i] ?? cat.queries,
        })),
      };
      await fetch("/api/translate-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, save: true }),
      });
      // Also save the edited version
      await fetch("/api/business-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={S.sectionTitle}>COMPANY PROFILE</div>

      <div style={{ marginBottom: 24 }}>
        <label style={S.label}>COMPANY NAME</label>
        <p style={S.helper}>Synced with Brand settings. Used in all generated pitches.</p>
        <input value={profile.companyName} onChange={(e) => setProfile((p) => ({ ...p, companyName: e.target.value }))} style={S.input} placeholder="Acme Corp" />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={S.label}>WEBSITE URL</label>
        <input value={profile.websiteUrl} onChange={(e) => setProfile((p) => ({ ...p, websiteUrl: e.target.value }))} style={S.input} placeholder="https://yourcompany.com" />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={S.label}>WHAT YOU SELL</label>
        <p style={S.helper}>Describe your product or service in 2–3 sentences. Be specific — this is used verbatim in Claude prompts.</p>
        <textarea value={profile.whatYouSell} onChange={(e) => setProfile((p) => ({ ...p, whatYouSell: e.target.value }))}
          rows={3} style={{ ...S.input, resize: "vertical" }}
          placeholder="We sell real-time inventory tracking hardware and software. Our IoT sensors track stock automatically by weight. Ideal for warehouses, distributors, and manufacturers." />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={S.label}>WHO BUYS FROM YOU</label>
        <p style={S.helper}>Describe your ideal customer — industry, company size, role, pain points.</p>
        <textarea value={profile.whoBuysFromYou} onChange={(e) => setProfile((p) => ({ ...p, whoBuysFromYou: e.target.value }))}
          rows={3} style={{ ...S.input, resize: "vertical" }}
          placeholder="Operations managers at mid-market distributors (50–500 employees) who are losing money to shrinkage and manual counting errors..." />
      </div>

      <div style={{ marginBottom: 28 }}>
        <label style={S.label}>WHY CUSTOMERS CHOOSE YOU</label>
        <p style={S.helper}>Your key differentiator or value proposition.</p>
        <textarea value={profile.whyChooseYou} onChange={(e) => setProfile((p) => ({ ...p, whyChooseYou: e.target.value }))}
          rows={2} style={{ ...S.input, resize: "vertical" }}
          placeholder="We eliminate manual inventory counting entirely. No scanning, no barcodes, no data entry." />
      </div>

      <div style={S.sectionTitle}>DEAL STRUCTURE</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div>
          <label style={S.label}>AVERAGE DEAL SIZE</label>
          <select value={profile.avgDealSize} onChange={(e) => setProfile((p) => ({ ...p, avgDealSize: e.target.value }))}
            style={{ ...S.input, cursor: "pointer" }}>
            {DEAL_SIZE_OPTIONS.map((o) => <option key={o} value={o}>{DEAL_SIZE_LABELS[o]}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>SALES CYCLE LENGTH</label>
          <select value={profile.salesCycleLength} onChange={(e) => setProfile((p) => ({ ...p, salesCycleLength: e.target.value }))}
            style={{ ...S.input, cursor: "pointer" }}>
            {CYCLE_OPTIONS.map((o) => <option key={o} value={o}>{CYCLE_LABELS[o]}</option>)}
          </select>
        </div>
      </div>

      <MultiSelect label="CURRENT DISTRIBUTION MODEL" options={DIST_OPTIONS}
        value={profile.distributionModel} onChange={(v) => setProfile((p) => ({ ...p, distributionModel: v }))} />

      <MultiSelect label="TYPES OF PARTNERS YOU WANT" options={PARTNER_OPTIONS}
        value={profile.lookingFor} onChange={(v) => setProfile((p) => ({ ...p, lookingFor: v }))} />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, marginBottom: 32 }}>
        <button onClick={handleSave} disabled={saving}
          style={{ ...S.btnSecondary, opacity: saving ? 0.6 : 1 }}>
          {saved ? "✓ Saved" : "Save Profile"}
        </button>
        <button onClick={generate} disabled={generating || !profile.whatYouSell}
          style={{ ...S.btnPrimary, opacity: (generating || !profile.whatYouSell) ? 0.6 : 1, cursor: (generating || !profile.whatYouSell) ? "not-allowed" : "pointer" }}>
          {generating ? "Generating..." : "Generate Search Parameters"}
        </button>
      </div>

      {/* Generated config preview */}
      {generatedConfig && (
        <div style={{ border: "1px solid rgba(0,255,136,0.25)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ background: "rgba(0,255,136,0.06)", padding: "14px 20px", borderBottom: "1px solid rgba(0,255,136,0.15)" }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>
              Generated Search Strategy
            </div>
            <div style={{ fontSize: 12, color: "#6b6b85", marginTop: 4 }}>Review and edit queries before saving. You can adjust individual queries inline.</div>
          </div>
          <div style={{ padding: "20px 24px" }}>

            {/* Ideal VAR profile */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>IDEAL VAR PROFILE</div>
              <p style={{ fontSize: 13, color: "#b0b0c8", lineHeight: 1.6, margin: 0 }}>{generatedConfig.idealVARProfile}</p>
            </div>

            {/* Verticals */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>TARGET VERTICALS</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {generatedConfig.targetVerticals.map((v) => (
                    <span key={v} style={{ padding: "3px 10px", borderRadius: 12, background: "rgba(0,255,136,0.12)", color: "var(--accent)", fontSize: 11, fontFamily: "'Space Mono', monospace" }}>{v}</span>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>AVOID</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {generatedConfig.avoidVerticals.map((v) => (
                    <span key={v} style={{ padding: "3px 10px", borderRadius: 12, background: "rgba(107,107,133,0.15)", color: "#6b6b85", fontSize: 11, fontFamily: "'Space Mono', monospace" }}>{v}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Key value props */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>KEY VALUE PROPS FOR VARs</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {generatedConfig.keyValueProps.map((p, i) => (
                  <li key={i} style={{ fontSize: 13, color: "#b0b0c8", paddingLeft: 16, position: "relative", marginBottom: 6 }}>
                    <span style={{ position: "absolute", left: 0, color: "var(--accent)" }}>•</span>{p}
                  </li>
                ))}
              </ul>
            </div>

            {/* Search categories — editable */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
                SEARCH CATEGORIES ({generatedConfig.searchCategories.length}) — click to expand and edit queries
              </div>
              {generatedConfig.searchCategories.map((cat, i) => (
                <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 8, marginBottom: 8, overflow: "hidden" }}>
                  <button type="button" onClick={() => setExpandedCat(expandedCat === i ? null : i)}
                    style={{ width: "100%", padding: "10px 16px", background: "rgba(255,255,255,0.02)", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontFamily: "'Space Mono', monospace", background: cat.priority === "high" ? "rgba(0,255,136,0.12)" : "rgba(107,107,133,0.12)", color: cat.priority === "high" ? "var(--accent)" : "#6b6b85" }}>
                        {cat.priority.toUpperCase()}
                      </span>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: "#e8e8f0" }}>{cat.name}</span>
                    </div>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{expandedCat === i ? "▲" : "▼"} {cat.queries.length} queries</span>
                  </button>
                  {expandedCat === i && (
                    <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
                      <p style={{ ...S.helper, marginBottom: 10 }}>{cat.description}</p>
                      {(editableQueries[i] ?? cat.queries).map((q, qi) => (
                        <div key={qi} style={{ marginBottom: 6 }}>
                          <input value={q}
                            onChange={(e) => setEditableQueries((prev) => ({ ...prev, [i]: (prev[i] ?? cat.queries).map((x, j) => j === qi ? e.target.value : x) }))}
                            style={{ ...S.input, fontSize: 12 }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button onClick={saveWithConfig} disabled={saving}
              style={{ ...S.btnPrimary, opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Saving..." : saved ? "✓ Saved" : "Save Strategy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DEMO TAB ─────────────────────────────────────────────────────────────────

function DemoTab() {
  const router = useRouter();
  const [demos, setDemos] = useState<DemoAccountMeta[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isElectron = typeof window !== "undefined" && !!window.electronAPI;

  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI!.listDemoAccounts().then(setDemos).catch(() => {});
  }, [isElectron]);

  async function handleLoad(id: string) {
    if (!window.electronAPI) return;
    setLoading(id);
    setError(null);
    try {
      const result = await window.electronAPI.loadDemoAccount(id);
      if (result.ok) {
        setLoaded(id);
        // Reload after 1.2s so the store refreshes
        setTimeout(() => router.push("/"), 1200);
      } else {
        setError(result.error ?? "Failed to load demo account");
      }
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(null);
    }
  }

  if (!isElectron) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center" }}>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Demo accounts are only available in the desktop app.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 28, lineHeight: 1.6 }}>
        Load a pre-configured business profile to explore the pipeline with realistic settings.
        Your API keys are preserved. The brand and business context will be replaced.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {demos.map((demo) => {
          const isLoading = loading === demo.id;
          const isDone = loaded === demo.id;
          return (
            <button
              key={demo.id}
              onClick={() => handleLoad(demo.id)}
              disabled={!!loading || !!loaded}
              style={{
                background: isDone
                  ? `${demo.color}22`
                  : `rgba(255,255,255,0.03)`,
                border: `1px solid ${isDone ? demo.color : "var(--border)"}`,
                borderRadius: 10,
                padding: "20px 24px",
                cursor: loading || loaded ? "not-allowed" : "pointer",
                textAlign: "left",
                transition: "border-color 0.2s, background 0.2s",
                opacity: loading && !isLoading ? 0.5 : 1,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 28 }}>{demo.emoji}</span>
                <div>
                  <div style={{
                    fontFamily: "'Space Mono', monospace",
                    fontWeight: 700,
                    fontSize: 14,
                    color: isDone ? demo.color : "var(--text)",
                  }}>
                    {isLoading ? "Loading..." : isDone ? `${demo.label} loaded ✓` : demo.label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {demo.description}
                  </div>
                </div>
              </div>
              <div style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: 20,
                background: `${demo.color}22`,
                color: demo.color,
                fontSize: 10,
                fontFamily: "'Space Mono', monospace",
                fontWeight: 700,
                letterSpacing: "0.5px",
              }}>
                LOAD PROFILE
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.25)", borderRadius: 6, color: "var(--danger)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {loaded && (
        <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.25)", borderRadius: 6, color: "var(--accent)", fontSize: 13, fontFamily: "'Space Mono', monospace" }}>
          Profile loaded. Redirecting to dashboard...
        </div>
      )}

      <div style={{ marginTop: 32, padding: "16px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 8 }}>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
          After loading a demo profile, the pipeline will search for VAR partners specific to that business type. Run a scan from the dashboard to see results.
        </p>
      </div>
    </div>
  );
}

// ─── SESSION TAB ──────────────────────────────────────────────────────────────

function SessionTab() {
  const [key, setKey] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importVal, setImportVal] = useState("");
  const [importError, setImportError] = useState("");
  const [clearInput, setClearInput] = useState("");
  const [clearing, setClearing] = useState(false);
  const [clearDone, setClearDone] = useState(false);

  useEffect(() => {
    try {
      setKey(localStorage.getItem("var-hunter-session-id") ?? "");
    } catch {}
  }, []);

  const handleCopy = async () => {
    if (!key) return;
    await navigator.clipboard.writeText(key);
    setCopied(true);
    try { localStorage.setItem("var-hunter-key-copied", "1"); } catch {}
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExport = () => {
    const a = document.createElement("a");
    a.href = "/api/export/json";
    a.download = "";
    a.click();
  };

  const handleImport = () => {
    const trimmed = importVal.trim();
    if (!/^[a-z0-9-]{8,64}$/i.test(trimmed)) {
      setImportError("Invalid session key format.");
      return;
    }
    setImportError("");
    try { localStorage.setItem("var-hunter-session-id", trimmed); } catch {}
    try { localStorage.setItem("var-hunter-modal-shown", "1"); } catch {}
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `session-id=${trimmed}; path=/; expires=${expires}; SameSite=Strict`;
    window.location.href = "/";
  };

  const handleClear = async () => {
    if (clearInput !== "DELETE") return;
    setClearing(true);
    try {
      await fetch("/api/session/clear", { method: "POST" });
    } catch {}
    try {
      localStorage.removeItem("var-hunter-session-id");
      localStorage.removeItem("var-hunter-modal-shown");
      localStorage.removeItem("var-hunter-key-copied");
    } catch {}
    document.cookie = "session-id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    setClearDone(true);
    setTimeout(() => { window.location.href = "/"; }, 1200);
  };

  const maskedKey = key ? key.replace(/[a-z0-9]/gi, "•") : "";

  return (
    <div>
      <p style={S.sectionTitle}>SESSION & DATA</p>

      {/* Session key display */}
      <div style={{ marginBottom: 28 }}>
        <label style={S.label}>Your Session Key</label>
        <p style={S.helper}>This key identifies your data. Keep it private and backed up.</p>
        <div style={{ position: "relative" }}>
          <input
            readOnly
            value={revealed ? key : maskedKey}
            style={{ ...S.input, paddingRight: 80, letterSpacing: revealed ? "0.5px" : "2px", color: revealed ? "#00ff88" : "var(--muted)", fontFamily: "'Space Mono', monospace" }}
          />
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 13, padding: "4px 6px", fontFamily: "'Space Mono', monospace" }}
          >
            {revealed ? "hide" : "show"}
          </button>
        </div>
        <button
          onClick={handleCopy}
          style={{ ...S.btnSecondary, marginTop: 10, padding: "8px 18px", fontSize: 12, color: copied ? "var(--accent)" : undefined }}
        >
          {copied ? "✓ Copied" : "Copy Key"}
        </button>
      </div>

      {/* Export */}
      <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: "1px solid var(--border)" }}>
        <label style={S.label}>Export My Data</label>
        <p style={S.helper}>Download all reports, settings, and search history as a JSON file.</p>
        <button onClick={handleExport} style={{ ...S.btnSecondary, padding: "8px 18px", fontSize: 12 }}>
          ⬇ Export JSON
        </button>
      </div>

      {/* Import session */}
      <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: "1px solid var(--border)" }}>
        <label style={S.label}>Import Session from Another Device</label>
        <p style={S.helper}>Paste a session key to load that session's data in this browser.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={importVal}
            onChange={(e) => { setImportVal(e.target.value); setImportError(""); }}
            placeholder="Paste session key..."
            style={{ ...S.input, flex: 1 }}
          />
          <button
            onClick={handleImport}
            disabled={!importVal.trim()}
            style={{ ...S.btnPrimary, padding: "10px 18px", fontSize: 12, flexShrink: 0, opacity: importVal.trim() ? 1 : 0.4, cursor: importVal.trim() ? "pointer" : "not-allowed" }}
          >
            Load Session
          </button>
        </div>
        {importError && (
          <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "var(--danger)" }}>{importError}</p>
        )}
      </div>

      {/* Clear all data */}
      <div>
        <label style={{ ...S.label, color: "var(--danger)" }}>Clear All My Data</label>
        <p style={S.helper}>
          Permanently wipes all reports, settings, and search history for this session. This cannot be undone.
        </p>
        <div
          style={{
            background: "rgba(255,68,68,0.05)",
            border: "1px solid rgba(255,68,68,0.2)",
            borderRadius: 8,
            padding: "20px 24px",
          }}
        >
          <p style={{ fontSize: 13, color: "#b0b0c8", margin: "0 0 14px 0" }}>
            Type <code style={{ color: "var(--danger)", background: "rgba(255,68,68,0.1)", padding: "1px 6px", borderRadius: 3 }}>DELETE</code> to confirm.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={clearInput}
              onChange={(e) => setClearInput(e.target.value)}
              placeholder="DELETE"
              style={{ ...S.input, flex: 1, borderColor: clearInput === "DELETE" ? "rgba(255,68,68,0.5)" : undefined }}
            />
            <button
              onClick={handleClear}
              disabled={clearInput !== "DELETE" || clearing}
              style={{
                padding: "10px 18px",
                border: "1px solid rgba(255,68,68,0.4)",
                borderRadius: 6,
                background: clearInput === "DELETE" && !clearing ? "rgba(255,68,68,0.12)" : "transparent",
                color: clearInput === "DELETE" && !clearing ? "var(--danger)" : "var(--muted)",
                cursor: clearInput === "DELETE" && !clearing ? "pointer" : "not-allowed",
                fontFamily: "'Space Mono', monospace",
                fontSize: 12,
                flexShrink: 0,
                transition: "all 0.2s",
              }}
            >
              {clearing ? "Clearing..." : "Clear All My Data"}
            </button>
          </div>
          {clearDone && (
            <p style={{ margin: "10px 0 0 0", fontSize: 12, color: "var(--accent)" }}>
              Data cleared. Redirecting...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN SETTINGS PAGE ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const isFirstRun = searchParams?.get("firstRun") === "1";
  const [activeTab, setActiveTab] = useState<Tab>("api");
  const [onboardingStep, setOnboardingStep] = useState<0 | 1 | 2>(0); // 0=api, 1=brand, 2=business
  const [apiKeysSaved, setApiKeysSaved] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as Tab | null;
    const valid: Tab[] = ["api", "brand", "business", "demo", "session"];
    if (tab && valid.includes(tab)) setActiveTab(tab);
  }, []);

  const handleApiSaved = useCallback(() => {
    setApiKeysSaved(true);
    if (isFirstRun) {
      setOnboardingStep(1);
      setActiveTab("brand");
    }
  }, [isFirstRun]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "api", label: "API Keys" },
    { id: "brand", label: "Brand & Appearance" },
    { id: "business", label: "Your Business" },
    { id: "demo", label: "Demo Accounts" },
    { id: "session", label: "Session & Data" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, height: 40, background: "var(--accent)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📦</div>
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 18, letterSpacing: "-0.5px" }}>
              CLOUDBOX <span style={{ color: "var(--accent)" }}>VAR HUNTER</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Settings</div>
          </div>
        </div>
        {!isFirstRun && (
          <button onClick={() => router.push("/")} style={S.btnSecondary}>← Dashboard</button>
        )}
      </header>

      <main style={{ flex: 1, padding: "32px", maxWidth: 800, margin: "0 auto", width: "100%" }}>
        {/* First-run welcome */}
        {isFirstRun && (
          <div style={{ background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.25)", borderRadius: 8, padding: "16px 20px", marginBottom: 28 }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>
              Welcome to Cloudbox VAR Hunter
              {onboardingStep > 0 && ` — Step ${onboardingStep + 1} of 3`}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#b0b0c8" }}>
              {onboardingStep === 0 && "Enter your API keys to get started. Required: Anthropic and Serper."}
              {onboardingStep === 1 && "Customise the app with your brand. You can skip this and update it later."}
              {onboardingStep === 2 && "Tell the AI about your business so it can find the right partners for you."}
            </p>
            {isFirstRun && (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {[0, 1, 2].map((step) => (
                  <div key={step} style={{ width: 24, height: 4, borderRadius: 2, background: onboardingStep >= step ? "var(--accent)" : "rgba(255,255,255,0.1)" }} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 32 }}>
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "10px 20px", border: "none", background: "transparent", cursor: "pointer",
                fontFamily: "'Space Mono', monospace", fontSize: 12,
                color: activeTab === tab.id ? "var(--accent)" : "var(--muted)",
                borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
                marginBottom: -1, transition: "color 0.15s",
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "api" && <ApiKeysTab onSaved={handleApiSaved} />}
        {activeTab === "brand" && (
          <BrandTab onSaved={() => {
            if (isFirstRun) { setOnboardingStep(2); setActiveTab("business"); }
          }} />
        )}
        {activeTab === "business" && (
          <BusinessTab onSaved={() => {
            if (isFirstRun) router.push("/");
          }} />
        )}
        {activeTab === "demo" && <DemoTab />}
        {activeTab === "session" && <SessionTab />}

        {/* First-run navigation */}
        {isFirstRun && (
          <div style={{ display: "flex", gap: 12, marginTop: 24, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
            {onboardingStep > 0 && (
              <button onClick={() => { setOnboardingStep((s) => (s - 1) as 0 | 1 | 2); setActiveTab(onboardingStep === 2 ? "brand" : "api"); }} style={S.btnSecondary}>
                ← Back
              </button>
            )}
            {onboardingStep === 0 && apiKeysSaved && (
              <button onClick={() => { setOnboardingStep(1); setActiveTab("brand"); }} style={S.btnPrimary}>
                Next: Brand Setup →
              </button>
            )}
            {onboardingStep === 1 && (
              <button onClick={() => { setOnboardingStep(2); setActiveTab("business"); }} style={S.btnPrimary}>
                Next: Your Business →
              </button>
            )}
            {onboardingStep === 2 && (
              <button onClick={() => router.push("/")} style={S.btnPrimary}>
                Start Hunting →
              </button>
            )}
            {onboardingStep > 0 && (
              <button onClick={() => router.push("/")} style={{ ...S.btnSecondary, marginLeft: "auto" }}>
                Skip setup →
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
