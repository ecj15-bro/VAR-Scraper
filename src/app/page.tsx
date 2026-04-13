"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface KnowledgeBase {
  lastRefreshed: string;
  cloudboxUpdates: string[];
  industryTrends: string[];
  competitorIntel: string[];
  partnerEcosystem: string[];
  varMarketSignals: string[];
  refinedIdealVARProfile: string;
  hotVerticals: string[];
  coldVerticals: string[];
  lastInsights: string;
}

interface VARFitScore {
  overallScore: number;
  fitCategory: "strong" | "moderate" | "weak" | "avoid";
  fitReasons: string[];
  redFlags: string[];
  deploymentEase: "easy" | "moderate" | "complex";
  estimatedDealSize: "small" | "mid" | "enterprise";
  strategicNotes: string;
}

interface PitchContext {
  hookAngle: string;
  painPoints: string[];
  integrationAngle: string | null;
  toneRecommendation: "formal" | "casual" | "technical" | "executive";
  avoidMentioning: string[];
}

interface PitchVariants {
  cold_email: string;
  linkedin_message: string;
  followup_email: string;
  text_message: string;
  executive_brief: string;
}

interface Report {
  id: string;
  timestamp: string;
  companyName: string;
  decisionMaker: string;
  title: string;
  linkedinUrl?: string;
  companyWebsite?: string;
  companyProfile: string;
  personProfile: string;
  pitch: string;
  newsTitle: string;
  newsSource: string;
  pitchVariants?: PitchVariants;
  relevanceScore?: number;
  confidenceScore?: number;
  varFitScore?: VARFitScore;
  pitchContext?: PitchContext;
  briefing?: string;
}

interface EvolvedSearchParams {
  retireQueries: string[];
  addQueries: string[];
  hotVerticalQueries: string[];
  ecosystemQueries: string[];
  saturatedQueries: string[];
  evolutionRationale: string;
}

type RunStatus = "idle" | "running" | "done" | "error";
type ActiveView = "reports" | "intelligence";

// ─── FIT CATEGORY COLORS ─────────────────────────────────────────────────────

const FIT_COLORS: Record<string, string> = {
  strong: "#00ff88",
  moderate: "#ffaa00",
  weak: "#ff8800",
  avoid: "#ff4444",
};

function fitColor(category: string | undefined): string {
  return category ? (FIT_COLORS[category] ?? "#6b6b85") : "#6b6b85";
}

// ─── STAGE LABELS ────────────────────────────────────────────────────────────

const STAGE_LABELS = [
  "🔭 Watchtower scanning for leads...",
  "⚡ Context agent pre-scoring leads...",
  "🕵️ Detective profiling companies...",
  "💼 Salesman generating pitches...",
  "📨 Delivering reports to Teams...",
];

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

interface BrandState {
  companyName: string;
  tagline: string;
  primaryColor: string;
  logoDataUrl: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [brand, setBrand] = useState<BrandState>({ companyName: "Cloudbox", tagline: "Multi-agent partner prospecting pipeline", primaryColor: "#00ff88", logoDataUrl: "" });
  const [selected, setSelected] = useState<Report | null>(null);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [stageIdx, setStageIdx] = useState(0);
  const [runResult, setRunResult] = useState<{
    processed: number;
    skipped: number;
    contextFiltered: number;
    errors: number;
    totalLeadsFound?: number;
    avgRelevanceScore?: number;
  } | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("reports");
  const [kbRefreshing, setKbRefreshing] = useState(false);
  const [kbRefreshError, setKbRefreshError] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [searchEvolution, setSearchEvolution] = useState<EvolvedSearchParams | null>(null);
  const [totalUniqueQueries, setTotalUniqueQueries] = useState(0);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(true); // default true to avoid flash on non-web

  const fetchReports = useCallback(async () => {
    const res = await fetch("/api/reports");
    const data = await res.json();
    if (data.reports) setReports(data.reports);
    if (data.knowledgeBase) setKb(data.knowledgeBase);
    if (data.searchEvolution) setSearchEvolution(data.searchEvolution);
    if (typeof data.totalUniqueQueries === "number") setTotalUniqueQueries(data.totalUniqueQueries);
  }, []);

  // Fetch reports and brand in parallel on mount
  useEffect(() => {
    Promise.all([
      fetchReports(),
      fetch("/api/brand").then((r) => r.json()).catch(() => null),
    ]).then(([, brandData]) => {
      if (brandData) {
        setBrand({
          companyName: brandData.companyName || "Cloudbox",
          tagline: brandData.tagline || "Multi-agent partner prospecting pipeline",
          primaryColor: brandData.primaryColor || "#00ff88",
          logoDataUrl: brandData.logoDataUrl || "",
        });
        if (brandData.primaryColor) {
          document.documentElement.style.setProperty("--accent", brandData.primaryColor);
        }
      }
    });
  }, [fetchReports]);

  // Read session indicator from localStorage
  useEffect(() => {
    if ((window as any).electronAPI) return;
    try {
      const key = localStorage.getItem("var-hunter-session-id");
      if (key) setSessionKey(key);
      setKeyCopied(localStorage.getItem("var-hunter-key-copied") === "1");
    } catch {}
  }, []);

  // First-run: redirect to settings if running in Electron and keys are missing
  useEffect(() => {
    async function checkFirstRun() {
      if (typeof window !== "undefined" && window.electronAPI) {
        const settings = await window.electronAPI.getSettings();
        if (!settings.ANTHROPIC_API_KEY || !settings.SERPER_API_KEY) {
          router.push("/settings?firstRun=1");
        }
      }
    }
    checkFirstRun();
  }, [router]);

  const deleteLead = async (id: string) => {
    await fetch(`/api/reports?id=${id}`, { method: "DELETE" });
    setReports((prev) => prev.filter((r) => r.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const clearAllLeads = async () => {
    await fetch("/api/reports?all=true", { method: "DELETE" });
    setReports([]);
    setSelected(null);
    setClearConfirm(false);
  };

  const runPipeline = async (dryRun = false) => {
    setStatus("running");
    setRunResult(null);
    setStageIdx(0);

    const interval = setInterval(() => {
      setStageIdx((i) => Math.min(i + 1, STAGE_LABELS.length - 1));
    }, 7000);

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      clearInterval(interval);

      if (data.error) throw new Error(data.error);

      setRunResult({
        processed: data.processed,
        skipped: data.skipped,
        contextFiltered: data.contextFiltered ?? 0,
        errors: data.errors,
        totalLeadsFound: data.totalLeadsFound,
        avgRelevanceScore: data.avgRelevanceScore,
      });
      setStatus("done");
      setLastRun(new Date().toLocaleString());
      await fetchReports();
    } catch {
      clearInterval(interval);
      setStatus("error");
    }
  };

  const exportCSV = (format: "csv" | "sheets") => {
    window.location.href = `/api/export/csv?format=${format}`;
  };

  const exportXLSX = () => {
    window.location.href = "/api/export/xlsx";
  };

  const refreshKnowledge = async () => {
    setKbRefreshing(true);
    setKbRefreshError(false);
    try {
      const res = await fetch("/api/refresh-knowledge", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.knowledgeBase) setKb(data.knowledgeBase);
    } catch {
      setKbRefreshError(true);
    } finally {
      setKbRefreshing(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "20px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--surface)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {brand.logoDataUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={brand.logoDataUrl} alt="" style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 6 }} />
            : (
              <div style={{ width: 40, height: 40, background: "var(--accent)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                📦
              </div>
            )
          }
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 18, letterSpacing: "-0.5px" }}>
              {(() => {
                const words = brand.companyName.toUpperCase().split(" ");
                return words.map((w, i) => (
                  <span key={i} style={{ color: i === words.length - 1 ? "var(--accent)" : undefined }}>{w}{i < words.length - 1 ? " " : ""}</span>
                ));
              })()}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              {brand.tagline}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {lastRun && (
            <span
              style={{
                fontSize: 12,
                color: "var(--muted)",
                fontFamily: "'Space Mono', monospace",
              }}
            >
              Last run: {lastRun}
            </span>
          )}
          {reports.length > 0 && (
            <>
              <button
                onClick={exportXLSX}
                title="Download Excel workbook with styled headers, fit color-coding, and summary sheet"
                style={{
                  padding: "8px 16px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "transparent",
                  color: "var(--muted)",
                  cursor: "pointer",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 12,
                }}
              >
                ⬇ XLSX
              </button>
              <button
                onClick={() => exportCSV("csv")}
                title="Download CSV"
                style={{
                  padding: "8px 16px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "transparent",
                  color: "var(--muted)",
                  cursor: "pointer",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 12,
                }}
              >
                ⬇ CSV
              </button>
              <button
                onClick={() => exportCSV("sheets")}
                title="Download Google Sheets compatible CSV (UTF-8 BOM)"
                style={{
                  padding: "8px 16px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "transparent",
                  color: "var(--muted)",
                  cursor: "pointer",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 12,
                }}
              >
                ⬇ Sheets
              </button>
            </>
          )}
          <button
            onClick={() => runPipeline(true)}
            disabled={status === "running"}
            style={{
              padding: "8px 16px",
              border: "1px solid var(--border)",
              borderRadius: 6,
              background: "transparent",
              color: "var(--muted)",
              cursor: "pointer",
              fontFamily: "'Space Mono', monospace",
              fontSize: 12,
            }}
          >
            DRY RUN
          </button>
          <button
            onClick={() => runPipeline(false)}
            disabled={status === "running"}
            style={{
              padding: "10px 24px",
              border: "none",
              borderRadius: 6,
              background: status === "running" ? "var(--border)" : "var(--accent)",
              color: "#000",
              cursor: status === "running" ? "not-allowed" : "pointer",
              fontFamily: "'Space Mono', monospace",
              fontSize: 13,
              fontWeight: 700,
              transition: "all 0.2s",
            }}
          >
            {status === "running" ? "RUNNING..." : "▶ RUN NOW"}
          </button>
          {sessionKey && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                color: "var(--muted)",
                fontFamily: "'Space Mono', monospace",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "6px 10px",
              }}
            >
              {!keyCopied && (
                <span
                  title="You haven't copied your session key yet"
                  style={{ color: "#ffaa00", fontSize: 12, lineHeight: 1 }}
                >
                  ⚠
                </span>
              )}
              <span>Session: {sessionKey.slice(0, 6)}...{sessionKey.slice(-3)}</span>
              <button
                onClick={() => router.push("/settings?tab=session")}
                title="Session & Data"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "1px 3px",
                  color: "var(--muted)",
                  fontSize: 13,
                  lineHeight: 1,
                  marginLeft: 2,
                }}
              >
                ⚙
              </button>
            </div>
          )}
          <button
            onClick={() => router.push("/settings")}
            title="Settings"
            style={{
              padding: "10px 12px",
              border: "1px solid var(--border)",
              borderRadius: 6,
              background: "transparent",
              color: "var(--muted)",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ⚙
          </button>
        </div>
      </header>

      {/* Status bar */}
      {status === "running" && (
        <div
          style={{
            padding: "14px 32px",
            background: "rgba(0,255,136,0.05)",
            borderBottom: "1px solid rgba(0,255,136,0.2)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--accent)",
              animation: "pulse 1s infinite",
            }}
          />
          <span
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 13,
              color: "var(--accent)",
            }}
          >
            {STAGE_LABELS[stageIdx]}
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            This may take 2–4 minutes
          </span>
        </div>
      )}

      {status === "done" && runResult && (
        <div
          style={{
            padding: "14px 32px",
            background: "rgba(0,255,136,0.04)",
            borderBottom: "1px solid rgba(0,255,136,0.15)",
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--accent)", fontFamily: "'Space Mono', monospace", fontWeight: 700, marginRight: 4 }}>
            ✓ RUN COMPLETE
          </span>
          <StatCard label="Reports" value={runResult.processed} color="var(--accent)" highlight />
          <StatCard label="Leads Found" value={runResult.totalLeadsFound ?? 0} color="var(--warning)" />
          <StatCard label="Skipped" value={runResult.skipped} color="var(--muted)" />
          {runResult.contextFiltered > 0 && (
            <StatCard label="Filtered" value={runResult.contextFiltered} color="var(--warning)" />
          )}
          <StatCard label="Errors" value={runResult.errors} color={runResult.errors > 0 ? "var(--danger)" : "var(--muted)"} />
          {!!runResult.avgRelevanceScore && (
            <StatCard label="Avg Relevance" value={`${runResult.avgRelevanceScore}/10`} color="var(--warning)" />
          )}
        </div>
      )}

      {status === "error" && (
        <div
          style={{
            padding: "12px 32px",
            background: "rgba(255,68,68,0.05)",
            borderBottom: "1px solid rgba(255,68,68,0.2)",
            color: "var(--danger)",
            fontFamily: "'Space Mono', monospace",
            fontSize: 13,
          }}
        >
          ⚠ Pipeline error — check that all environment variables are set correctly.
        </div>
      )}

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          padding: "0 32px",
        }}
      >
        <TabButton
          label={`VAR PROFILES${reports.length > 0 ? ` (${reports.length})` : ""}`}
          active={activeView === "reports"}
          onClick={() => setActiveView("reports")}
          activeColor="var(--accent)"
        />
        <TabButton
          label="MARKET INTELLIGENCE"
          active={activeView === "intelligence"}
          onClick={() => setActiveView("intelligence")}
          activeColor="var(--accent2)"
          dot={kb !== null}
        />
      </div>

      {/* Main content */}
      {activeView === "reports" ? (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Report list */}
          <div
            style={{
              width: 380,
              borderRight: "1px solid var(--border)",
              overflowY: "auto",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: "16px 20px 12px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 12,
                  color: "var(--muted)",
                }}
              >
                VAR PROFILES — {reports.length} total
              </span>
              {reports.length > 0 && (
                clearConfirm ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--danger)", fontFamily: "'Space Mono', monospace" }}>
                      Clear all?
                    </span>
                    <button
                      onClick={clearAllLeads}
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        border: "1px solid var(--danger)",
                        borderRadius: 4,
                        background: "rgba(255,68,68,0.1)",
                        color: "var(--danger)",
                        cursor: "pointer",
                        fontFamily: "'Space Mono', monospace",
                      }}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setClearConfirm(false)}
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        border: "1px solid var(--border)",
                        borderRadius: 4,
                        background: "transparent",
                        color: "var(--muted)",
                        cursor: "pointer",
                        fontFamily: "'Space Mono', monospace",
                      }}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setClearConfirm(true)}
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      background: "transparent",
                      color: "var(--muted)",
                      cursor: "pointer",
                      fontFamily: "'Space Mono', monospace",
                    }}
                  >
                    Clear all
                  </button>
                )
              )}
            </div>

            {reports.length === 0 ? (
              <div
                style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
                <div style={{ fontSize: 14, marginBottom: 8 }}>No reports yet</div>
                <div style={{ fontSize: 12 }}>
                  Click &quot;Run Now&quot; to start the pipeline
                </div>
              </div>
            ) : (
              reports.map((r) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  isSelected={selected?.id === r.id}
                  onClick={() => setSelected(r)}
                  onDelete={() => deleteLead(r.id)}
                />
              ))
            )}
          </div>

          {/* Detail panel */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {selected ? <ReportDetail report={selected} /> : <EmptyState />}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <IntelligencePanel
            kb={kb}
            refreshing={kbRefreshing}
            error={kbRefreshError}
            onRefresh={refreshKnowledge}
            searchEvolution={searchEvolution}
            totalUniqueQueries={totalUniqueQueries}
            companyName={brand.companyName}
          />
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ─── TAB BUTTON ──────────────────────────────────────────────────────────────

function TabButton({
  label,
  active,
  onClick,
  activeColor,
  dot,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  activeColor: string;
  dot?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "14px 20px",
        border: "none",
        borderBottom: active ? `2px solid ${activeColor}` : "2px solid transparent",
        background: "transparent",
        color: active ? activeColor : "var(--muted)",
        cursor: "pointer",
        fontFamily: "'Space Mono', monospace",
        fontSize: 12,
        fontWeight: active ? 700 : 400,
        letterSpacing: "0.08em",
        transition: "all 0.15s",
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: -1,
      }}
    >
      {label}
      {dot && !active && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: activeColor,
            opacity: 0.7,
            display: "inline-block",
          }}
        />
      )}
    </button>
  );
}

// ─── INTELLIGENCE PANEL ──────────────────────────────────────────────────────

function IntelligencePanel({
  kb,
  refreshing,
  error,
  onRefresh,
  searchEvolution,
  totalUniqueQueries,
  companyName,
}: {
  kb: KnowledgeBase | null;
  refreshing: boolean;
  error: boolean;
  onRefresh: () => void;
  searchEvolution: EvolvedSearchParams | null;
  totalUniqueQueries: number;
  companyName: string;
}) {
  const ageLabel = kb
    ? (() => {
        const h = Math.round(
          (Date.now() - new Date(kb.lastRefreshed).getTime()) / 3600000
        );
        return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
      })()
    : null;

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1100 }}>
      {/* Panel header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 28,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--accent2)",
              letterSpacing: "0.12em",
              marginBottom: 6,
              fontFamily: "'Space Mono', monospace",
            }}
          >
            🔬 MARKET INTELLIGENCE
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
            Cloudbox VAR Market Briefing
          </h2>
          {ageLabel && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
              Knowledge base refreshed {ageLabel} · Auto-refreshes daily at 6am UTC
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {error && (
            <span
              style={{
                fontSize: 12,
                color: "var(--danger)",
                fontFamily: "'Space Mono', monospace",
              }}
            >
              ⚠ Refresh failed
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            style={{
              padding: "9px 20px",
              border: "1px solid rgba(124,58,237,0.4)",
              borderRadius: 6,
              background: refreshing ? "rgba(124,58,237,0.05)" : "rgba(124,58,237,0.12)",
              color: refreshing ? "var(--muted)" : "var(--accent2)",
              cursor: refreshing ? "not-allowed" : "pointer",
              fontFamily: "'Space Mono', monospace",
              fontSize: 12,
              fontWeight: 700,
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            {refreshing && (
              <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>
                ◌
              </span>
            )}
            {refreshing ? "REFRESHING..." : "↻ REFRESH NOW"}
          </button>
        </div>
      </div>

      {/* No KB yet */}
      {!kb && !refreshing && (
        <div
          style={{
            border: "1px dashed rgba(124,58,237,0.3)",
            borderRadius: 12,
            padding: "60px 40px",
            textAlign: "center",
            color: "var(--muted)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔬</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
            No intelligence data yet
          </div>
          <div style={{ fontSize: 13, marginBottom: 24 }}>
            Click &quot;Refresh Now&quot; to run the market research agent and build your first briefing.
          </div>
          <button
            onClick={onRefresh}
            style={{
              padding: "10px 28px",
              border: "none",
              borderRadius: 6,
              background: "var(--accent2)",
              color: "#fff",
              cursor: "pointer",
              fontFamily: "'Space Mono', monospace",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            ↻ BUILD INTELLIGENCE BRIEF
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {!kb && refreshing && (
        <div
          style={{
            border: "1px solid rgba(124,58,237,0.2)",
            borderRadius: 12,
            padding: "48px 40px",
            textAlign: "center",
            background: "rgba(124,58,237,0.03)",
            color: "var(--muted)",
          }}
        >
          <div
            style={{
              fontSize: 32,
              marginBottom: 16,
              display: "inline-block",
              animation: "spin 2s linear infinite",
            }}
          >
            ◌
          </div>
          <div style={{ fontSize: 14, color: "var(--accent2)", fontFamily: "'Space Mono', monospace" }}>
            Researching market intelligence...
          </div>
          <div style={{ fontSize: 12, marginTop: 8 }}>This takes about 30–60 seconds</div>
        </div>
      )}

      {/* ── EXECUTIVE BRIEFING ───────────────────────────────────────────────── */}
      {kb && (
        <>
          <div
            style={{
              background: "rgba(124,58,237,0.07)",
              border: "1px solid rgba(124,58,237,0.28)",
              borderRadius: 12,
              padding: "24px 28px",
              marginBottom: 28,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Decorative accent bar */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                background: "var(--accent2)",
                borderRadius: "12px 0 0 12px",
              }}
            />
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--accent2)",
                letterSpacing: "0.12em",
                marginBottom: 12,
                fontFamily: "'Space Mono', monospace",
              }}
            >
              ⚡ EXECUTIVE BRIEFING
            </div>
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.8,
                color: "var(--text)",
                margin: 0,
                fontWeight: 400,
              }}
            >
              {kb.lastInsights}
            </p>
          </div>

          {/* ── HOT / COLD VERTICALS ─────────────────────────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
              marginBottom: 24,
            }}
          >
            {/* Hot Verticals */}
            <div
              style={{
                background: "rgba(124,58,237,0.05)",
                border: "1px solid rgba(124,58,237,0.2)",
                borderRadius: 10,
                padding: "20px 22px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--accent2)",
                  letterSpacing: "0.1em",
                  marginBottom: 14,
                  fontFamily: "'Space Mono', monospace",
                }}
              >
                🔥 HOT VERTICALS
              </div>
              {kb.hotVerticals.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--muted)" }}>No signals yet</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {kb.hotVerticals.map((v, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 12,
                        background: "rgba(124,58,237,0.15)",
                        border: "1px solid rgba(124,58,237,0.35)",
                        borderRadius: 20,
                        padding: "5px 12px",
                        color: "var(--accent2)",
                        fontWeight: 600,
                      }}
                    >
                      {v}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Cold Verticals */}
            <div
              style={{
                background: "rgba(107,107,133,0.05)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "20px 22px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--muted)",
                  letterSpacing: "0.1em",
                  marginBottom: 14,
                  fontFamily: "'Space Mono', monospace",
                }}
              >
                ❄ COLD VERTICALS
              </div>
              {kb.coldVerticals.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--muted)" }}>None identified</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {kb.coldVerticals.map((v, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 12,
                        background: "rgba(107,107,133,0.1)",
                        border: "1px solid rgba(107,107,133,0.25)",
                        borderRadius: 20,
                        padding: "5px 12px",
                        color: "var(--muted)",
                        fontWeight: 600,
                      }}
                    >
                      {v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── CLOUDBOX UPDATES + COMPETITOR INTEL ─────────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
              marginBottom: 24,
            }}
          >
            <IntelCard
              title={`📦 ${companyName.toUpperCase()} UPDATES`}
              items={kb.cloudboxUpdates}
              accentColor="var(--accent2)"
              emptyText="No recent updates found"
            />
            <IntelCard
              title="🕵️ COMPETITOR INTEL"
              items={kb.competitorIntel}
              accentColor="#ff8800"
              emptyText="No competitor signals found"
            />
          </div>

          {/* ── VAR MARKET SIGNALS + INDUSTRY TRENDS ────────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
              marginBottom: 24,
            }}
          >
            <IntelCard
              title="📡 VAR MARKET SIGNALS"
              items={kb.varMarketSignals}
              accentColor="var(--accent)"
              emptyText="No market signals found"
            />
            <IntelCard
              title="📈 INDUSTRY TRENDS"
              items={kb.industryTrends}
              accentColor="#00aaff"
              emptyText="No trends found"
            />
          </div>

          {/* ── IDEAL VAR PROFILE ────────────────────────────────────────────── */}
          {kb.refinedIdealVARProfile && (
            <div
              style={{
                background: "rgba(124,58,237,0.04)",
                border: "1px solid rgba(124,58,237,0.18)",
                borderRadius: 10,
                padding: "20px 22px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--accent2)",
                  letterSpacing: "0.1em",
                  marginBottom: 10,
                  fontFamily: "'Space Mono', monospace",
                }}
              >
                🎯 CURRENT IDEAL VAR PROFILE
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text)", margin: 0 }}>
                {kb.refinedIdealVARProfile}
              </p>
            </div>
          )}
        </>
      )}

      {/* ── SEARCH EVOLUTION ──────────────────────────────────────────────── */}
      {searchEvolution && (
        <div style={{ marginTop: kb ? 32 : 0 }}>
          {/* Section header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--accent2)",
                  letterSpacing: "0.12em",
                  marginBottom: 6,
                  fontFamily: "'Space Mono', monospace",
                }}
              >
                🧬 SEARCH EVOLUTION
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
                Query Intelligence
              </h2>
            </div>
            {totalUniqueQueries > 0 && (
              <div
                style={{
                  textAlign: "right",
                  background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.25)",
                  borderRadius: 8,
                  padding: "8px 16px",
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: "var(--accent2)",
                    fontFamily: "'Space Mono', monospace",
                    lineHeight: 1,
                  }}
                >
                  {totalUniqueQueries}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                  unique queries all-time
                </div>
              </div>
            )}
          </div>

          {/* Rationale */}
          <div
            style={{
              background: "rgba(124,58,237,0.06)",
              border: "1px solid rgba(124,58,237,0.25)",
              borderRadius: 10,
              padding: "16px 20px",
              marginBottom: 20,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: 4, background: "var(--accent2)",
                borderRadius: "10px 0 0 10px",
              }}
            />
            <div
              style={{
                fontSize: 11, fontWeight: 700, color: "var(--accent2)",
                letterSpacing: "0.1em", marginBottom: 8,
                fontFamily: "'Space Mono', monospace",
              }}
            >
              ⚡ EVOLUTION RATIONALE
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text)", margin: 0 }}>
              {searchEvolution.evolutionRationale}
            </p>
          </div>

          {/* Query tag groups */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            {/* New queries */}
            {(searchEvolution.addQueries.length > 0) && (
              <QueryTagGroup
                label="✦ NEW THIS RUN"
                queries={searchEvolution.addQueries}
                color="#00ff88"
                bg="rgba(0,255,136,0.08)"
                border="rgba(0,255,136,0.25)"
              />
            )}

            {/* Targeted queries */}
            {(searchEvolution.hotVerticalQueries.length > 0 || searchEvolution.ecosystemQueries.length > 0) && (
              <QueryTagGroup
                label="🎯 TARGETED"
                queries={[...searchEvolution.hotVerticalQueries, ...searchEvolution.ecosystemQueries]}
                color="var(--accent2)"
                bg="rgba(124,58,237,0.1)"
                border="rgba(124,58,237,0.3)"
              />
            )}

            {/* Saturating queries */}
            {searchEvolution.saturatedQueries.length > 0 && (
              <QueryTagGroup
                label="⚠ SATURATING"
                queries={searchEvolution.saturatedQueries}
                color="#ffaa00"
                bg="rgba(255,170,0,0.08)"
                border="rgba(255,170,0,0.25)"
              />
            )}

            {/* Retired queries */}
            {searchEvolution.retireQueries.length > 0 && (
              <QueryTagGroup
                label="✕ RETIRED"
                queries={searchEvolution.retireQueries}
                color="var(--danger)"
                bg="rgba(255,68,68,0.07)"
                border="rgba(255,68,68,0.2)"
                strikethrough
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IntelCard({
  title,
  items,
  accentColor,
  emptyText,
}: {
  title: string;
  items: string[];
  accentColor: string;
  emptyText: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "20px 22px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: accentColor,
          letterSpacing: "0.1em",
          marginBottom: 14,
          fontFamily: "'Space Mono', monospace",
        }}
      >
        {title}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--muted)" }}>{emptyText}</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((item, i) => (
            <li
              key={i}
              style={{
                fontSize: 13,
                color: "var(--text)",
                lineHeight: 1.6,
                marginBottom: 10,
                paddingLeft: 14,
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  color: accentColor,
                  opacity: 0.7,
                }}
              >
                •
              </span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QueryTagGroup({
  label,
  queries,
  color,
  bg,
  border,
  strikethrough = false,
}: {
  label: string;
  queries: string[];
  color: string;
  bg: string;
  border: string;
  strikethrough?: boolean;
}) {
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          fontSize: 11, fontWeight: 700, color,
          letterSpacing: "0.1em", marginBottom: 12,
          fontFamily: "'Space Mono', monospace",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {queries.map((q, i) => (
          <span
            key={i}
            style={{
              fontSize: 11,
              background: bg,
              border: `1px solid ${border}`,
              borderRadius: 4,
              padding: "3px 8px",
              color,
              fontFamily: "'Space Mono', monospace",
              textDecoration: strikethrough ? "line-through" : "none",
              opacity: strikethrough ? 0.75 : 1,
            }}
          >
            {q}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  highlight = false,
}: {
  label: string;
  value: number | string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: highlight ? `${color}12` : "var(--surface)",
        border: `1px solid ${highlight ? `${color}30` : "var(--border)"}`,
        borderRadius: 8,
        padding: "6px 14px",
        minWidth: 64,
      }}
    >
      <span
        style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 18,
          fontWeight: 700,
          color,
          lineHeight: 1.2,
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap" }}>
        {label}
      </span>
    </div>
  );
}

function MiniTag({
  value,
  color,
  bgAlpha,
}: {
  value: string;
  color: string;
  bgAlpha: string;
}) {
  return (
    <span
      style={{
        fontSize: 10,
        fontFamily: "'Space Mono', monospace",
        background: bgAlpha,
        border: `1px solid ${color}33`,
        borderRadius: 4,
        padding: "1px 5px",
        color,
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </span>
  );
}

function ReportCard({
  report,
  isSelected,
  onClick,
  onDelete,
}: {
  report: Report;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const date = new Date(report.timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const fc = report.varFitScore?.fitCategory;
  const fcolor = fitColor(fc);

  return (
    <div
      onClick={onClick}
      style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        background: isSelected ? "var(--surface2)" : "transparent",
        borderLeft: isSelected ? "3px solid var(--accent)" : "3px solid transparent",
        transition: "all 0.15s",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 6,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, flex: 1 }}>
          {report.companyName}
        </div>
        <div
          style={{
            display: "flex",
            gap: 4,
            alignItems: "center",
            flexShrink: 0,
            marginLeft: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {fc && (
            <MiniTag
              value={fc.toUpperCase().slice(0, 3)}
              color={fcolor}
              bgAlpha={`${fcolor}14`}
            />
          )}
          {report.varFitScore?.overallScore !== undefined && (
            <MiniTag
              value={`${report.varFitScore.overallScore}`}
              color={fcolor}
              bgAlpha={`${fcolor}0d`}
            />
          )}
          {report.relevanceScore !== undefined && (
            <MiniTag
              value={`R:${report.relevanceScore}`}
              color="var(--accent)"
              bgAlpha="rgba(0,255,136,0.08)"
            />
          )}
          {report.confidenceScore !== undefined && (
            <MiniTag
              value={`C:${report.confidenceScore}`}
              color="var(--accent2)"
              bgAlpha="rgba(124,58,237,0.08)"
            />
          )}
          <span
            style={{
              fontSize: 11,
              color: "var(--muted)",
              fontFamily: "'Space Mono', monospace",
            }}
          >
            {date}
          </span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "var(--accent)", marginBottom: 4 }}>
        {report.decisionMaker} · {report.title}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--muted)",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {report.newsTitle}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Delete lead"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          width: 22,
          height: 22,
          border: "1px solid transparent",
          borderRadius: 4,
          background: "transparent",
          color: "var(--muted)",
          cursor: "pointer",
          fontSize: 14,
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0,
          transition: "opacity 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = "1";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = "0";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)";
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ─── REPORT DETAIL ───────────────────────────────────────────────────────────

type PitchTab = "cold_email" | "linkedin_message" | "followup_email" | "text_message" | "executive_brief";

const PITCH_TABS: { key: PitchTab; label: string }[] = [
  { key: "cold_email", label: "Cold Email" },
  { key: "linkedin_message", label: "LinkedIn" },
  { key: "followup_email", label: "Follow-up" },
  { key: "text_message", label: "Text" },
  { key: "executive_brief", label: "Exec Brief" },
];

function ReportDetail({ report }: { report: Report }) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<PitchTab>("cold_email");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [docxLoading, setDocxLoading] = useState(false);
  const reportId = report.id;

  useEffect(() => {
    setActiveTab("cold_email");
    setCopied(false);
    setPdfLoading(false);
    setDocxLoading(false);
  }, [reportId]);

  const activePitch = report.pitchVariants?.[activeTab] ?? report.pitch;
  const fc = report.varFitScore?.fitCategory;
  const fcolor = fitColor(fc);

  const copyPitch = () => {
    navigator.clipboard.writeText(activePitch);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const triggerDownload = async (
    endpoint: string,
    ext: string,
    setLoading: (v: boolean) => void
  ) => {
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: report.id }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      const safeName = report.companyName.replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-");
      a.href = url;
      a.download = `VAR-${safeName}-${dateStr}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — user will notice no download
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF  = () => triggerDownload("/api/export/pdf",  "pdf",  setPdfLoading);
  const downloadDOCX = () => triggerDownload("/api/export/docx", "docx", setDocxLoading);

  return (
    <div style={{ padding: "32px 40px", maxWidth: 820 }}>

      {/* ── Executive Briefing Block ─────────────────────────────────────── */}
      {report.briefing && (
        <div
          style={{
            background: "rgba(124,58,237,0.06)",
            border: "1px solid rgba(124,58,237,0.25)",
            borderRadius: 10,
            padding: "16px 20px",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--accent2)",
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}
          >
            ⚡ CONTEXT BRIEFING
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text)" }}>
            {report.briefing}
          </p>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 12,
            color: "var(--accent)",
            fontFamily: "'Space Mono', monospace",
            marginBottom: 8,
            letterSpacing: "0.1em",
          }}
        >
          VAR OPPORTUNITY
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 10 }}>
          {report.companyName}
        </h1>

        {/* Score + fit badges */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          {fc && (
            <span
              style={{
                fontSize: 12,
                fontFamily: "'Space Mono', monospace",
                background: `${fcolor}14`,
                border: `1px solid ${fcolor}33`,
                borderRadius: 5,
                padding: "3px 10px",
                color: fcolor,
                fontWeight: 700,
              }}
            >
              {fc.toUpperCase()} FIT
            </span>
          )}
          {report.varFitScore?.overallScore !== undefined && (
            <span
              style={{
                fontSize: 12,
                fontFamily: "'Space Mono', monospace",
                background: `${fcolor}0d`,
                border: `1px solid ${fcolor}28`,
                borderRadius: 5,
                padding: "3px 10px",
                color: fcolor,
              }}
            >
              {report.varFitScore.overallScore}/10
            </span>
          )}
          {report.relevanceScore !== undefined && (
            <span
              style={{
                fontSize: 11,
                fontFamily: "'Space Mono', monospace",
                background: "rgba(0,255,136,0.08)",
                border: "1px solid rgba(0,255,136,0.2)",
                borderRadius: 5,
                padding: "3px 10px",
                color: "var(--accent)",
              }}
            >
              Relevance: {report.relevanceScore}/10
            </span>
          )}
          {report.confidenceScore !== undefined && (
            <span
              style={{
                fontSize: 11,
                fontFamily: "'Space Mono', monospace",
                background: "rgba(124,58,237,0.08)",
                border: "1px solid rgba(124,58,237,0.2)",
                borderRadius: 5,
                padding: "3px 10px",
                color: "var(--accent2)",
              }}
            >
              Confidence: {report.confidenceScore}/10
            </span>
          )}
        </div>

        {/* deploymentEase + estimatedDealSize */}
        {report.varFitScore && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Tag
              label="Deployment"
              value={report.varFitScore.deploymentEase}
              color="var(--muted)"
            />
            <Tag
              label="Deal Size"
              value={report.varFitScore.estimatedDealSize}
              color="var(--muted)"
            />
            <Tag
              label="Tone"
              value={report.pitchContext?.toneRecommendation ?? "formal"}
              color="var(--muted)"
            />
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 10,
          }}
        >
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Detected {new Date(report.timestamp).toLocaleString()}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={downloadDOCX}
              disabled={docxLoading}
              style={{
                padding: "6px 16px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "transparent",
                color: docxLoading ? "var(--muted)" : "var(--text)",
                cursor: docxLoading ? "not-allowed" : "pointer",
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {docxLoading ? (
                <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>◌</span>
              ) : "⬇"} {docxLoading ? "GENERATING..." : "DOCX"}
            </button>
            <button
              onClick={downloadPDF}
              disabled={pdfLoading}
              style={{
                padding: "6px 16px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "transparent",
                color: pdfLoading ? "var(--muted)" : "var(--text)",
                cursor: pdfLoading ? "not-allowed" : "pointer",
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {pdfLoading ? (
                <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>◌</span>
              ) : "⬇"} {pdfLoading ? "GENERATING..." : "PDF"}
            </button>
          </div>
        </div>
      </div>

      {/* ── News Trigger ─────────────────────────────────────────────────── */}
      <Section title="📰 News Trigger">
        <a
          href={report.newsSource}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--accent)",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {report.newsTitle} ↗
        </a>
      </Section>

      {/* ── Fit Assessment ───────────────────────────────────────────────── */}
      {report.varFitScore && (
        <Section title="📊 Fit Assessment">
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {/* Fit Reasons */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#00ff88",
                  marginBottom: 8,
                  letterSpacing: "0.08em",
                }}
              >
                ✓ WHY IT FITS
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {report.varFitScore.fitReasons.map((r, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 13,
                      color: "var(--text)",
                      lineHeight: 1.6,
                      marginBottom: 6,
                      paddingLeft: 14,
                      position: "relative",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        color: "#00ff88",
                      }}
                    >
                      •
                    </span>
                    {r}
                  </li>
                ))}
              </ul>
              {report.varFitScore.strategicNotes && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    color: "var(--muted)",
                    fontStyle: "italic",
                    lineHeight: 1.5,
                  }}
                >
                  {report.varFitScore.strategicNotes}
                </div>
              )}
            </div>

            {/* Red Flags */}
            {report.varFitScore.redFlags.length > 0 && (
              <div style={{ flex: 1, minWidth: 200 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--warning)",
                    marginBottom: 8,
                    letterSpacing: "0.08em",
                  }}
                >
                  ⚠ RED FLAGS
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {report.varFitScore.redFlags.map((f, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: 13,
                        color: "var(--text)",
                        lineHeight: 1.6,
                        marginBottom: 6,
                        paddingLeft: 14,
                        position: "relative",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          left: 0,
                          color: "var(--warning)",
                        }}
                      >
                        •
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Key Decision Maker ───────────────────────────────────────────── */}
      <Section title="👤 Key Decision Maker">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <InfoPill label="Name" value={report.decisionMaker} />
          <InfoPill label="Title" value={report.title} />
          {report.companyWebsite && (
            <InfoPill label="Website" value={report.companyWebsite} />
          )}
        </div>
        {report.linkedinUrl && (
          <a
            href={report.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 12,
              padding: "6px 14px",
              border: "1px solid var(--border)",
              borderRadius: 20,
              color: "#0a66c2",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            in LinkedIn Profile ↗
          </a>
        )}
      </Section>

      {/* ── Company Profile ──────────────────────────────────────────────── */}
      <Section title="🏢 Company Profile">
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text)" }}>
          {report.companyProfile}
        </p>
      </Section>

      {/* ── Person Context ───────────────────────────────────────────────── */}
      <Section title="🧠 Person Context">
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text)" }}>
          {report.personProfile}
        </p>
      </Section>

      {/* ── Pitch Box with Hook Angle + Tabs ─────────────────────────────── */}
      <div
        style={{
          background: "rgba(0,255,136,0.05)",
          border: "1px solid rgba(0,255,136,0.2)",
          borderRadius: 12,
          padding: 24,
          marginTop: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--accent)",
              letterSpacing: "0.05em",
            }}
          >
            💬 PERSONALIZED PITCH
          </div>
          <button
            onClick={copyPitch}
            style={{
              padding: "5px 14px",
              border: "1px solid rgba(0,255,136,0.3)",
              borderRadius: 6,
              background: "transparent",
              color: copied ? "var(--accent)" : "var(--muted)",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "'Space Mono', monospace",
            }}
          >
            {copied ? "✓ COPIED" : "COPY"}
          </button>
        </div>

        {/* Hook Angle — shown prominently above tabs */}
        {report.pitchContext?.hookAngle && (
          <div
            style={{
              background: "rgba(0,255,136,0.08)",
              borderRadius: 6,
              padding: "10px 14px",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--accent)",
                letterSpacing: "0.1em",
                marginBottom: 4,
              }}
            >
              HOOK ANGLE
            </div>
            <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, margin: 0 }}>
              {report.pitchContext.hookAngle}
            </p>
          </div>
        )}

        {/* Pitch variant tabs */}
        {report.pitchVariants && (
          <div
            style={{
              display: "flex",
              gap: 6,
              marginBottom: 18,
              paddingBottom: 16,
              borderBottom: "1px solid rgba(0,255,136,0.12)",
            }}
          >
            {PITCH_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "5px 14px",
                  border: "1px solid",
                  borderColor:
                    activeTab === tab.key ? "var(--accent)" : "var(--border)",
                  borderRadius: 6,
                  background:
                    activeTab === tab.key
                      ? "rgba(0,255,136,0.1)"
                      : "transparent",
                  color:
                    activeTab === tab.key ? "var(--accent)" : "var(--muted)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "'Space Mono', monospace",
                  transition: "all 0.15s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            position: "relative",
            paddingLeft: 16,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 2,
              background: "rgba(0,255,136,0.35)",
              borderRadius: 2,
            }}
          />
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.9,
              color: "var(--text)",
              margin: 0,
              whiteSpace: "pre-wrap",
              letterSpacing: "0.01em",
            }}
          >
            {activePitch}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── SHARED UI PRIMITIVES ────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginBottom: 28,
        paddingBottom: 28,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 3,
            height: 14,
            background: "var(--accent)",
            borderRadius: 2,
            opacity: 0.5,
            flexShrink: 0,
          }}
        />
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--muted)",
            letterSpacing: "0.12em",
          }}
        >
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}

function Tag({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "4px 10px",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.05em" }}>
        {label.toUpperCase()}
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color }}>
        {value.toUpperCase()}
      </span>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "8px 14px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "var(--muted)",
          letterSpacing: "0.1em",
          marginBottom: 2,
        }}
      >
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "var(--muted)",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 60 }}>🎯</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
        Select a VAR Profile
      </div>
      <div style={{ fontSize: 13 }}>
        Click any report on the left to view the full profile and pitch
      </div>
    </div>
  );
}
