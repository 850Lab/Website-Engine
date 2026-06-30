const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

export function isLlmInterpreterEnabled() {
  return process.env.MISSION_INTERPRETER_LLM === "1" && Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function requestStructuredMissionDraft(founderText, context = {}) {
  if (!isLlmInterpreterEnabled()) {
    return null;
  }

  const systemPrompt = `You are the Founder Intent Interpreter for Opportunity OS.
Translate founder business goals into a structured mission draft JSON object.
You may NOT create opportunities, execute jobs, launch outreach, or bypass approval gates.
Return JSON only with keys:
missionId, name, goal, revenueTarget, deadline, priority, geography, industries, buyerTypes, offers, capabilities, constraints, requiredSignals, ignoredSignals, preferredChannels, approvalPolicy, successMetrics, notes, clarificationNeeded, clarificationQuestions.
Use offer ids from this allowlist when possible: offer_pressure_washing, offer_ktm_manpower, offer_website_growth.
approvalPolicy.requireFounderApprovalBeforeOutreach must always be true.
Never guess revenueTarget or geography if missing — set clarificationNeeded true and ask concise questions instead.`;

  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.MISSION_INTERPRETER_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify({
            founderText,
            context,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mission interpreter LLM request failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content || "{}";
  return JSON.parse(content);
}
