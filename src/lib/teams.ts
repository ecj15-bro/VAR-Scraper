// lib/teams.ts — Microsoft Teams Incoming Webhook sender
import { VARReport } from "./email";
import { getEnv } from "./env";

export async function sendToTeams(report: VARReport): Promise<void> {
  const webhookUrl = getEnv().teamsWebhookUrl;
  if (!webhookUrl) throw new Error("TEAMS_WEBHOOK_URL not set");

  // Teams Adaptive Card payload
  const payload = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "Container",
              style: "emphasis",
              items: [
                {
                  type: "ColumnSet",
                  columns: [
                    {
                      type: "Column",
                      width: "stretch",
                      items: [
                        {
                          type: "TextBlock",
                          text: "🎯 NEW VAR OPPORTUNITY",
                          weight: "Bolder",
                          size: "Small",
                          color: "Accent",
                        },
                        {
                          type: "TextBlock",
                          text: report.companyName,
                          weight: "Bolder",
                          size: "ExtraLarge",
                          wrap: true,
                        },
                        {
                          type: "TextBlock",
                          text: `📰 ${report.newsTitle}`,
                          size: "Small",
                          isSubtle: true,
                          wrap: true,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "Container",
              items: [
                {
                  type: "TextBlock",
                  text: "👤 KEY DECISION MAKER",
                  weight: "Bolder",
                  size: "Medium",
                  spacing: "Medium",
                },
                {
                  type: "FactSet",
                  facts: [
                    { title: "Name", value: report.decisionMaker },
                    { title: "Title", value: report.title },
                    ...(report.linkedinUrl
                      ? [{ title: "LinkedIn", value: `[View Profile](${report.linkedinUrl})` }]
                      : []),
                    ...(report.companyWebsite
                      ? [{ title: "Website", value: `[${report.companyWebsite}](https://${report.companyWebsite})` }]
                      : []),
                  ],
                },
              ],
            },
            {
              type: "Container",
              separator: true,
              items: [
                {
                  type: "TextBlock",
                  text: "🏢 COMPANY PROFILE",
                  weight: "Bolder",
                  size: "Medium",
                  spacing: "Medium",
                },
                {
                  type: "TextBlock",
                  text: report.companyProfile,
                  wrap: true,
                  size: "Small",
                },
              ],
            },
            {
              type: "Container",
              separator: true,
              items: [
                {
                  type: "TextBlock",
                  text: "🧠 PERSON CONTEXT",
                  weight: "Bolder",
                  size: "Medium",
                  spacing: "Medium",
                },
                {
                  type: "TextBlock",
                  text: report.personProfile,
                  wrap: true,
                  size: "Small",
                },
              ],
            },
            {
              type: "Container",
              style: "accent",
              separator: true,
              items: [
                {
                  type: "TextBlock",
                  text: "💬 PERSONALIZED CLOUDBOX PITCH",
                  weight: "Bolder",
                  size: "Medium",
                  spacing: "Medium",
                },
                {
                  type: "TextBlock",
                  text: report.pitch,
                  wrap: true,
                  size: "Small",
                },
              ],
            },
            {
              type: "TextBlock",
              text: `Source: [${report.newsSource}](${report.newsSource})`,
              size: "Small",
              isSubtle: true,
              spacing: "Medium",
            },
          ],
        },
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Teams webhook error ${res.status}: ${text}`);
  }
}
