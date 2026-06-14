import { buildOutreachDraft } from "../mission-control.js";
import { buildSalesSupportForLead } from "../sales-support.js";
import { cleanText, nowIso } from "./shared.js";

function smsBody(businessName, city, previewUrl, pain) {
  const previewBit = previewUrl ? " I mocked up a quick preview." : "";
  return `Hi ${businessName} — I reviewed your ${city} web presence. ${pain}${previewBit} Open to a 10-min walkthrough? Reply STOP to opt out.`;
}

function followUpSms(businessName) {
  return `Quick bump on the ${businessName} website preview. Happy to send the link again or walk through the main fixes. Reply STOP to opt out.`;
}

function callOpening(businessName, city, topIssue) {
  return [
    `Hi, is this ${businessName}?`,
    `My name is [Your Name] — I put together a quick website and revenue review for businesses in ${city}.`,
    `The main thing I noticed is ${topIssue}.`,
    "I already mocked up a preview so you can react to something concrete.",
    "Would you have five minutes for me to walk through it?",
  ].join(" ");
}

/**
 * Generate outreach assets for the V6 sales package.
 */
export function buildOutreachAssets({ lead, research, audit, website }) {
  const draft = buildOutreachDraft({ ...lead, preview: { previewUrl: website.previewUrl } });
  const sales = buildSalesSupportForLead(lead);
  const businessName = cleanText(research.business.name);
  const city = cleanText(research.business.city) || "your area";
  const topIssue =
    audit.findings[0]?.title?.toLowerCase() ??
    "your site may be missing obvious calls-to-action for mobile visitors";
  const pain =
    audit.executiveSummary ||
    `there is room to convert more local search traffic in ${city}`;

  const previewLine = website.previewUrl
    ? `\n\nPreview: ${website.previewUrl}`
    : "";

  return {
    version: 1,
    generatedAt: nowIso(),
    businessName,
    email: {
      subject: draft.subject,
      body: `${draft.body}${previewLine}`,
    },
    sms: {
      body: smsBody(businessName, city, website.previewUrl, pain),
    },
    followUpEmail: {
      subject: `Following up: ${businessName} website preview`,
      body: [
        `Hi ${businessName} team,`,
        "",
        sales.followUpScripts?.[0] ??
          `Quick follow-up on the website preview for ${businessName} in ${city}.`,
        "",
        website.previewUrl ? `Preview link: ${website.previewUrl}` : "",
        "",
        sales.closeCta,
        "",
        "- Website Outreach Engine",
      ]
        .filter(Boolean)
        .join("\n"),
    },
    followUpSms: {
      body: followUpSms(businessName),
    },
    callOpeningScript: callOpening(businessName, city, topIssue),
    salesSupport: sales,
  };
}
