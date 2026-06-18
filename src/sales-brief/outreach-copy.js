/** Growth-first outreach copy — do not lead with "I build websites." */

export const CALLER_NAME = "Jaylan Brown";
export const CALLER_REGION = "Southeast Texas";

export const OPENING_LINES = {
  preferred: `Hi, my name is ${CALLER_NAME}. I'm local here in ${CALLER_REGION}. I had a quick question about how you're getting new customers today. Who would be the best person to ask?`,
  ownerDirect: `Hi, my name is ${CALLER_NAME}. I'm local here in ${CALLER_REGION}. I've helped businesses improve how they're getting customers online. Do you have a minute, or is the owner available?`,
  receptionist: `Hi, my name is ${CALLER_NAME}. I had a quick question for whoever handles business growth or marketing. Who would that be?`,
};

export const FIRST_DEFLECTION_RESPONSES = [
  "That makes sense. Most businesses like yours grow through relationships. Out of curiosity, how are you getting new business today?",
  "I understand. I'm not assuming the website is the main thing. I was more curious about how new customers usually find and choose you.",
];

export const EMERGENCY_QUESTION = "How are you guys getting new business today?";

export const DEFAULT_SUGGESTED_OFFER =
  "I help local businesses turn their website from an online placeholder into a simple customer trust and lead-capture system.";

export const DEFAULT_SUGGESTED_OFFER_ALT =
  "What I usually help with is making sure that when someone does look you up, they instantly understand what you do, why they should trust you, and how to take the next step.";

export const DEFAULT_FOLLOW_UP_OBJECTIVE =
  "Learn how they get customers today, who owns growth decisions, and book a short follow-up — only share a preview or offer after discovery.";

export function defaultFollowUpText(business, linkUrl = "") {
  const name = business.businessName || "there";
  const url = String(linkUrl || business.previewUrl || business.website || "").trim();
  if (url) {
    return `Hi ${name}, good speaking with you. As discussed — here's a quick look at how your business could come across when someone finds you online: ${url}`;
  }
  return `Hi ${name}, good speaking with you. When you have a minute — who handles growth or marketing decisions there?`;
}

export function defaultEmailSubject(business) {
  return `${business.businessName || "Your business"} — quick follow-up`;
}

export function defaultEmailBody(business, linkUrl = "") {
  const name = business.businessName || "there";
  const url = String(linkUrl || business.previewUrl || "").trim();
  if (url) {
    return `Hi ${name},\n\nGood speaking with you earlier. As mentioned, here's a quick look at how your business could come across when someone finds you online:\n\n${url}\n\nOpen to a 10-minute follow-up to talk about how you're getting customers today?\n\n- ${CALLER_NAME}`;
  }
  return `Hi ${name},\n\nGood speaking with you earlier. I'd like to learn a bit more about how you're getting new customers today and who handles growth decisions on your team.\n\nWould a quick 10-minute call work this week?\n\n- ${CALLER_NAME}`;
}
