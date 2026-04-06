// lib/email.ts — Report delivery via Resend

export interface VARReport {
  companyName: string;
  decisionMaker: string;
  title: string;
  linkedinUrl?: string;
  companyWebsite?: string;
  companyProfile: string;
  personProfile: string;
  pitch: string;
  newsSource: string;
  newsTitle: string;
}

export async function sendReport(report: VARReport): Promise<void> {
  if (process.env.ENABLE_EMAIL_DELIVERY !== "true") {
    console.log(`[sendReport] Email delivery disabled — report saved to dashboard only`);
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.REPORT_TO_EMAIL;
  const fromEmail = process.env.RESEND_FROM ?? "reports@cloudboxapp.com";

  if (!apiKey) throw new Error("RESEND_API_KEY not set");
  if (!toEmail) throw new Error("REPORT_TO_EMAIL not set");

  const subject = `VAR Opportunity: ${report.companyName} — ${report.newsTitle}`;

  const html = `
    <h2>🎯 New VAR Opportunity: ${report.companyName}</h2>
    <p><strong>News:</strong> ${report.newsTitle}</p>
    <hr />
    <h3>👤 Key Decision Maker</h3>
    <p><strong>${report.decisionMaker}</strong> — ${report.title}${report.linkedinUrl ? ` | <a href="${report.linkedinUrl}">LinkedIn</a>` : ""}${report.companyWebsite ? ` | <a href="https://${report.companyWebsite}">${report.companyWebsite}</a>` : ""}</p>
    <h3>🏢 Company Profile</h3>
    <p>${report.companyProfile}</p>
    <h3>🧠 Person Context</h3>
    <p>${report.personProfile}</p>
    <h3>💬 Personalised Cloudbox Pitch</h3>
    <p>${report.pitch.replace(/\n/g, "<br />")}</p>
    <hr />
    <p style="color:#888;font-size:12px;">Source: <a href="${report.newsSource}">${report.newsSource}</a></p>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from: fromEmail, to: toEmail, subject, html }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[sendReport] Resend error — status: ${res.status}, body: ${body}`);
      throw new Error(`Resend error ${res.status}: ${body}`);
    }

    console.log(`[sendReport] Delivered to ${toEmail}`);
  } catch (e) {
    console.error("[sendReport] Failed to deliver via Resend:", e);
    throw e;
  }
}
