function cleanText(value) {
  return String(value ?? "").trim();
}

function websiteProblem(lead) {
  if (!cleanText(lead.websiteUrl)) {
    return "right now customers may not have a clear website to trust before calling";
  }
  if (lead.websiteQuality === "weak" || lead.weakWebsite) {
    return "the current website likely makes it harder for mobile visitors to call or request a quote";
  }
  return "there is room to make the online first impression convert more local search traffic";
}

export function buildSalesSupportForLead(lead) {
  const businessName = cleanText(lead.businessName) || "the business";
  const category = cleanText(lead.category) || "local service";
  const city = cleanText(lead.city) || "your area";
  const packageType = cleanText(lead.websitePackageType) || "starter local website package";
  const estimatedValue = Number(lead.estimatedDealValue) || 1500;
  const pain = websiteProblem(lead);
  const previewLine = lead.previewStatus && lead.previewStatus !== "not_generated"
    ? "I already mocked up a preview so you can react to something concrete instead of a vague sales pitch."
    : "I can show a quick mockup so you can react to something concrete instead of a vague sales pitch.";

  return {
    offerFraming: `${businessName} gets a cleaner ${category} website focused on calls, quote requests, proof, and mobile trust in ${city}.`,
    pitchScript: [
      `Hi, I made a quick website improvement preview for ${businessName}.`,
      `The main thing I noticed is that ${pain}.`,
      previewLine,
      `The goal is simple: make it easier for someone in ${city} to trust you and call.`,
    ].join(" "),
    objectionHandling: [
      {
        objection: "We already have a website.",
        response: "That is exactly why I made this as a conversion improvement, not just a new design. The preview shows clearer calls-to-action, proof, and mobile layout improvements.",
      },
      {
        objection: "We are not spending money right now.",
        response: "That makes sense. I would frame this around missed calls and quote requests. If the preview does not feel like it could win more jobs, there is no reason to move forward.",
      },
      {
        objection: "Send me information.",
        response: "Absolutely. I can send the preview link and a short summary. The useful question is whether this looks closer to how you want customers to see the business.",
      },
    ],
    followUpScripts: [
      `Quick follow-up on the ${businessName} website preview. The main idea was clearer mobile calls and stronger trust proof for ${city} customers.`,
      `Wanted to bump this once. If the preview is useful, I can turn it into a simple ${packageType} with a practical launch plan.`,
    ],
    closeCta: `If this direction looks useful, the next step is a short walkthrough and a ${packageType} quote around $${estimatedValue}.`,
  };
}
