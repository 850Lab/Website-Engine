const SIGNAL_TYPES = [
  "permit",
  "rfp",
  "bid_award",
  "hiring_spike",
  "expansion",
  "shutdown",
  "turnaround",
  "funding",
  "acquisition",
  "weather_event",
  "government_agenda",
  "public_budget",
  "contract_award",
  "regulatory_change",
  "company_news",
  "social_signal",
  "crm_event",
];

const UNKNOWN_TYPE = "unknown";

const RULES = [
  { type: "permit", patterns: [/\bpermit\b/i, /\bcertificate of need\b/i, /\bcon filing\b/i, /\bzoning\b/i] },
  { type: "rfp", patterns: [/\brfp\b/i, /\brequest for proposal\b/i, /\bprocurement\b/i, /\bbid solicitation\b/i] },
  { type: "bid_award", patterns: [/\bbid award\b/i, /\bbid tabulation\b/i, /\blow bidder\b/i] },
  { type: "hiring_spike", patterns: [/\bhiring\b/i, /\bjob postings\b/i, /\bworkforce expansion\b/i, /\bnow hiring\b/i] },
  { type: "expansion", patterns: [/\bexpansion\b/i, /\bnew facility\b/i, /\bgroundbreaking\b/i, /\bnew plant\b/i] },
  { type: "shutdown", patterns: [/\bshutdown\b/i, /\bplant closure\b/i, /\boutage\b/i] },
  { type: "turnaround", patterns: [/\bturnaround\b/i, /\bta schedule\b/i, /\bmaintenance window\b/i] },
  { type: "funding", patterns: [/\bfunding\b/i, /\bgrant\b/i, /\bcapital raise\b/i] },
  { type: "acquisition", patterns: [/\bacquisition\b/i, /\bmerger\b/i, /\bacquires\b/i] },
  { type: "weather_event", patterns: [/\bhurricane\b/i, /\bflood\b/i, /\bweather alert\b/i, /\bnws\b/i] },
  { type: "government_agenda", patterns: [/\bagenda\b/i, /\bcity council\b/i, /\bcommission meeting\b/i] },
  { type: "public_budget", patterns: [/\bbond\b/i, /\bbudget adoption\b/i, /\bvoters approved\b/i] },
  { type: "contract_award", patterns: [/\bcontract award\b/i, /\bawarded contract\b/i, /\btask order\b/i] },
  { type: "regulatory_change", patterns: [/\bosha\b/i, /\bepa\b/i, /\bregulatory change\b/i, /\bnew rule\b/i] },
  { type: "company_news", patterns: [/\bannounces\b/i, /\bpress release\b/i, /\binvesting\b/i, /\bmanufacturing\b/i] },
  { type: "social_signal", patterns: [/\btwitter\b/i, /\blinkedin post\b/i, /\bsocial media\b/i] },
  { type: "crm_event", patterns: [/\bcrm\b/i, /\boutcome\b/i, /\bmeeting notes\b/i, /\bloss reason\b/i] },
];

function canonicalTypesSet() {
  return new Set([...SIGNAL_TYPES, UNKNOWN_TYPE]);
}

export function classifySignalRules(input = {}) {
  const text = `${input.headline || ""} ${input.summary || ""}`.trim();
  const requestedType = String(input.signalType || input.type || "").toLowerCase();

  if (requestedType && requestedType !== UNKNOWN_TYPE && SIGNAL_TYPES.includes(requestedType)) {
    return {
      signalType: requestedType,
      method: "cli",
      matchedRules: [],
      confidence: 0.7,
    };
  }

  const matchedRules = [];
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      matchedRules.push(rule.type);
    }
  }

  if (matchedRules.length === 1) {
    return {
      signalType: matchedRules[0],
      method: "rules",
      matchedRules,
      confidence: 0.65,
    };
  }

  if (matchedRules.length > 1) {
    return {
      signalType: matchedRules[0],
      method: "rules",
      matchedRules,
      confidence: 0.55,
      note: "Multiple rule matches; first canonical match selected.",
    };
  }

  return {
    signalType: UNKNOWN_TYPE,
    method: "rules",
    matchedRules: [],
    confidence: 0.4,
  };
}

export function isCanonicalSignalType(signalType) {
  return canonicalTypesSet().has(signalType);
}

export { UNKNOWN_TYPE };
