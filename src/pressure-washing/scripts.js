export const PW_SCRIPTS = {
  restaurantOpener:
    "Hey, this is Jaylan with Zeal Power Washing. I'm local here in Southeast Texas. I'm calling restaurants in the area because we're helping clean up dumpster pads, entrances, and concrete areas that build up grease and traffic stains. Who usually handles exterior cleaning for your location?",

  ownerAvailable:
    "I wanted to see if you'd be open to a quick estimate for the dumpster pad, entrance, or any concrete areas that need cleaning. I can keep it simple and send over a quote.",

  gatekeeper:
    "No problem. Who would be the best person to ask about exterior cleaning or pressure washing?",

  followUpText:
    "Hey, this is Jaylan with Zeal Power Washing. I called earlier about cleaning the dumpster pad, entrance, or concrete around your restaurant. I can send over a quick estimate if that's something you want looked at.",
};

export function followUpSmsBody(businessName = "your business") {
  return PW_SCRIPTS.followUpText;
}

export function defaultOffer(industry = "") {
  const ind = String(industry).toLowerCase();
  if (ind.includes("restaurant") || ind.includes("fast food") || ind.includes("cafe")) {
    return "Free walkthrough + quote for dumpster pad, entrance, and sidewalk cleaning.";
  }
  return "Quick estimate for entrance, parking lot, and concrete cleaning.";
}

export function defaultAngle(lead = {}) {
  const parts = [];
  if (lead.flags?.dumpsterPadLikely) parts.push("dumpster pad grease buildup");
  if (lead.flags?.hasDriveThru) parts.push("drive-thru concrete");
  if (lead.flags?.hasOutdoorSeating) parts.push("outdoor seating area");
  if (lead.flags?.curbAppealIssue) parts.push("curb appeal / entrance stains");
  if (!parts.length) parts.push("entrance and foot-traffic concrete");
  return `Likely needs: ${parts.join(", ")}.`;
}
