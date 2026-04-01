"use client";

import { useState, useEffect, useCallback } from "react";

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
}

type RunStatus = "idle" | "running" | "done" | "error";

const STAGE_LABELS = ["🔭 Watchtower scanning...", "🕵️ Detective profiling...", "📋 Reporter generating pitches...", "📨 Delivering to Teams..."];

export default function Dashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [stageIdx, setStageIdx] = useState(0);
  const [runResult, setRunResult] = useState<{ processed: number; skipped: number; errors: number } | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    const res = await fetch("/api/reports");
    const data = await res.json();
    if (data.reports) setReports(data.reports);
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const runPipeline = async (dryRun = false) => {
    setStatus("running");
    setRunResult(null);
    setStageIdx(0);

    // Animate stages
    const interval = setInterval(() => {
      setStageIdx((i) => Math.min(i + 1, STAGE_LABELS.length - 1));
    }, 8000);

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      clearInterval(interval);

      if (data.error) throw new Error(data.error);

      setRunResult({ processed: data.processed, skipped: data.skipped, errors: data.errors });
      setStatus("done");
      setLastRun(new Date().toLocaleString());
      await fetchReports();
    } catch (e: any) {
      clearInterval(interval);
      setStatus("error");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Header */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        padding: "20px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--surface)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 40, height: 40, background: "var(--accent)", borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
          }}>📦</div>
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 18, letterSpacing: "-0.5px" }}>
              CLOUDBOX <span style={{ color: "var(--accent)" }}>VAR HUNTER</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              Automated partner prospecting pipeline
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {lastRun && (
            <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "'Space Mono', monospace" }}>
              Last run: {lastRun}
            </span>
          )}
          <button
            onClick={() => runPipeline(true)}
            disabled={status === "running"}
            style={{
              padding: "8px 16px", border: "1px solid var(--border)", borderRadius: 6,
              background: "transparent", color: "var(--muted)", cursor: "pointer",
              fontFamily: "'Space Mono', monospace", fontSize: 12,
            }}
          >
            DRY RUN
          </button>
          <button
            onClick={() => runPipeline(false)}
            disabled={status === "running"}
            style={{
              padding: "10px 24px", border: "none", borderRadius: 6,
              background: status === "running" ? "var(--border)" : "var(--accent)",
              color: "#000", cursor: status === "running" ? "not-allowed" : "pointer",
              fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700,
              transition: "all 0.2s",
            }}
          >
            {status === "running" ? "RUNNING..." : "▶ RUN NOW"}
          </button>
        </div>
      </header>

      {/* Status bar */}
      {status === "running" && (
        <div style={{
          padding: "14px 32px",
          background: "rgba(0,255,136,0.05)",
          borderBottom: "1px solid rgba(0,255,136,0.2)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: "var(--accent)",
            animation: "pulse 1s infinite",
          }} />
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: "var(--accent)" }}>
            {STAGE_LABELS[stageIdx]}
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            This may take 2–4 minutes
          </span>
        </div>
      )}

      {status === "done" && runResult && (
        <div style={{
          padding: "12px 32px",
          background: "rgba(0,255,136,0.05)",
          borderBottom: "1px solid rgba(0,255,136,0.15)",
          display: "flex", gap: 24,
        }}>
          <Stat label="Reports Generated" value={runResult.processed} color="var(--accent)" />
          <Stat label="Already Seen (Skipped)" value={runResult.skipped} color="var(--muted)" />
          <Stat label="Errors" value={runResult.errors} color={runResult.errors > 0 ? "var(--danger)" : "var(--muted)"} />
        </div>
      )}

      {status === "error" && (
        <div style={{
          padding: "12px 32px", background: "rgba(255,68,68,0.05)",
          borderBottom: "1px solid rgba(255,68,68,0.2)",
          color: "var(--danger)", fontFamily: "'Space Mono', monospace", fontSize: 13,
        }}>
          ⚠ Pipeline error — check that all environment variables are set correctly.
        </div>
      )}

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Report list */}
        <div style={{
          width: 380, borderRight: "1px solid var(--border)",
          overflowY: "auto", flexShrink: 0,
        }}>
          <div style={{
            padding: "16px 20px 12px",
            borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: "var(--muted)" }}>
              VAR PROFILES — {reports.length} total
            </span>
          </div>

          {reports.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
              <div style={{ fontSize: 14, marginBottom: 8 }}>No reports yet</div>
              <div style={{ fontSize: 12 }}>Click "Run Now" to start the pipeline</div>
            </div>
          ) : (
            reports.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                isSelected={selected?.id === r.id}
                onClick={() => setSelected(r)}
              />
            ))
          )}
        </div>

        {/* Detail panel */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {selected ? (
            <ReportDetail report={selected} />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
    </div>
  );
}

function ReportCard({ report, isSelected, onClick }: { report: Report; isSelected: boolean; onClick: () => void }) {
  const date = new Date(report.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{report.companyName}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "'Space Mono', monospace", flexShrink: 0, marginLeft: 8 }}>{date}</div>
      </div>
      <div style={{ fontSize: 12, color: "var(--accent)", marginBottom: 4 }}>
        {report.decisionMaker} · {report.title}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {report.newsTitle}
      </div>
    </div>
  );
}

function ReportDetail({ report }: { report: Report }) {
  const [copied, setCopied] = useState(false);

  const copyPitch = () => {
    navigator.clipboard.writeText(report.pitch);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: 800 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, color: "var(--accent)", fontFamily: "'Space Mono', monospace", marginBottom: 8, letterSpacing: "0.1em" }}>
          VAR OPPORTUNITY
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>{report.companyName}</h1>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          Detected {new Date(report.timestamp).toLocaleString()}
        </div>
      </div>

      {/* News trigger */}
      <Section title="📰 News Trigger">
        <a
          href={report.newsSource}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent)", textDecoration: "none", fontSize: 14, fontWeight: 600 }}
        >
          {report.newsTitle} ↗
        </a>
      </Section>

      {/* Decision maker */}
      <Section title="👤 Key Decision Maker">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <InfoPill label="Name" value={report.decisionMaker} />
          <InfoPill label="Title" value={report.title} />
          {report.companyWebsite && <InfoPill label="Website" value={report.companyWebsite} />}
        </div>
        {report.linkedinUrl && (
          <a
            href={report.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              marginTop: 12, padding: "6px 14px",
              border: "1px solid var(--border)", borderRadius: 20,
              color: "#0a66c2", textDecoration: "none", fontSize: 13, fontWeight: 600,
            }}
          >
            in LinkedIn Profile ↗
          </a>
        )}
      </Section>

      {/* Company profile */}
      <Section title="🏢 Company Profile">
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text)" }}>{report.companyProfile}</p>
      </Section>

      {/* Person context */}
      <Section title="🧠 Person Context">
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text)" }}>{report.personProfile}</p>
      </Section>

      {/* Pitch */}
      <div style={{
        background: "rgba(0,255,136,0.05)",
        border: "1px solid rgba(0,255,136,0.2)",
        borderRadius: 12,
        padding: 24,
        marginTop: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.05em" }}>
            💬 PERSONALIZED CLOUDBOX PITCH
          </div>
          <button
            onClick={copyPitch}
            style={{
              padding: "5px 14px", border: "1px solid rgba(0,255,136,0.3)",
              borderRadius: 6, background: "transparent",
              color: copied ? "var(--accent)" : "var(--muted)",
              cursor: "pointer", fontSize: 12,
              fontFamily: "'Space Mono', monospace",
            }}
          >
            {copied ? "✓ COPIED" : "COPY"}
          </button>
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text)" }}>{report.pitch}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: "var(--surface2)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "8px 14px",
    }}>
      <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 2 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "100%", color: "var(--muted)", gap: 12,
    }}>
      <div style={{ fontSize: 60 }}>🎯</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>Select a VAR Profile</div>
      <div style={{ fontSize: 13 }}>Click any report on the left to view the full profile and pitch</div>
    </div>
  );
}
