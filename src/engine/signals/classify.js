const SIGNAL_TYPES = [
  "permit",
  "rfp",
  "bid_award",
  "hiring_spike",
  "expansion",
  "shutdown",
  "turnaround",
  "maintenance",
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

const GENERIC_OVERRIDE_TYPES = new Set(["company_news", "unknown", "crm_event", "social_signal"]);

const SEMANTIC_RULES = [
  {
    type: "expansion",
    priority: 100,
    patterns: [
      /\bexpansion\b/i,
      /\bannounces expansion\b/i,
      /\bwarehouse expansion\b/i,
      /\bnew facility\b/i,
      /\bgroundbreaking\b/i,
      /\bnew plant\b/i,
    ],
  },
  {
    type: "permit",
    priority: 95,
    patterns: [
      /\bpermit approved\b/i,
      /\bpermit\b/i,
      /\bcertificate of need\b/i,
      /\bcon filing\b/i,
      /\bzoning\b/i,
    ],
  },
  {
    type: "rfp",
    priority: 95,
    patterns: [/\brfp issued\b/i, /\brfp\b/i, /\brequest for proposal\b/i, /\bprocurement\b/i, /\bbid solicitation\b/i],
  },
  {
    type: "turnaround",
    priority: 90,
    patterns: [/\bturnaround\b/i, /\bta schedule\b/i, /\brefinery turnaround\b/i, /\bturnaround expected\b/i],
  },
  {
    type: "maintenance",
    priority: 90,
    patterns: [/\bmaintenance window\b/i, /\bscheduled maintenance\b/i, /\bmaintenance outage\b/i],
  },
  {
    type: "bid_award",
    priority: 85,
    patterns: [/\bbid award\b/i, /\bbid tabulation\b/i, /\blow bidder\b/i],
  },
  {
    type: "hiring_spike",
    priority: 80,
    patterns: [/\bhiring\b/i, /\bjob postings\b/i, /\bworkforce expansion\b/i, /\bnow hiring\b/i],
  },
  {
    type: "shutdown",
    priority: 80,
    patterns: [/\bshutdown\b/i, /\bplant closure\b/i, /\boutage\b/i],
  },
  {
    type: "funding",
    priority: 75,
    patterns: [/\bfunding\b/i, /\bgrant\b/i, /\bcapital raise\b/i],
  },
  {
    type: "acquisition",
    priority: 75,
    patterns: [/\bacquisition\b/i, /\bmerger\b/i, /\bacquires\b/i],
  },
  {
    type: "weather_event",
    priority: 70,
    patterns: [/\bhurricane\b/i, /\bflood\b/i, /\bweather alert\b/i, /\bnws\b/i],
  },
  {
    type: "government_agenda",
    priority: 65,
    patterns: [/\bagenda\b/i, /\bcity council\b/i, /\bcommission meeting\b/i],
  },
  {
    type: "public_budget",
    priority: 65,
    patterns: [/\bbond\b/i, /\bbudget adoption\b/i, /\bvoters approved\b/i],
  },
  {
    type: "contract_award",
    priority: 65,
    patterns: [/\bcontract award\b/i, /\bawarded contract\b/i, /\btask order\b/i],
  },
  {
    type: "regulatory_change",
    priority: 60,
    patterns: [/\bosha\b/i, /\bepa\b/i, /\bregulatory change\b/i, /\bnew rule\b/i],
  },
  {
    type: "company_news",
    priority: 20,
    patterns: [/\bannounces\b/i, /\bpress release\b/i, /\binvesting\b/i, /\bmanufacturing\b/i],
  },
  {
    type: "social_signal",
    priority: 15,
    patterns: [/\btwitter\b/i, /\blinkedin post\b/i, /\bsocial media\b/i],
  },
  {
    type: "crm_event",
    priority: 15,
    patterns: [/\bcrm\b/i, /\boutcome\b/i, /\bmeeting notes\b/i, /\bloss reason\b/i],
  },
];

function canonicalTypesSet() {
  return new Set([...SIGNAL_TYPES, UNKNOWN_TYPE]);
}

function matchSemanticRules(text) {
  const matches = [];
  for (const rule of SEMANTIC_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      matches.push({ type: rule.type, priority: rule.priority });
    }
  }
  matches.sort((a, b) => b.priority - a.priority);
  return matches;
}

export function classifySignalRules(input = {}) {
  const text = `${input.headline || ""} ${input.summary || ""}`.trim();
  const requestedType = String(input.signalType || input.type || "").toLowerCase();
  const semanticMatches = matchSemanticRules(text);
  const topSemantic = semanticMatches[0] || null;
  const matchedRules = semanticMatches.map((row) => row.type);

  if (topSemantic && (GENERIC_OVERRIDE_TYPES.has(requestedType) || !requestedType || requestedType === UNKNOWN_TYPE)) {
    return {
      signalType: topSemantic.type,
      semanticEventType: topSemantic.type,
      method: "semantic_override",
      matchedRules,
      confidence: semanticMatches.length === 1 ? 0.72 : 0.62,
      note:
        semanticMatches.length > 1
          ? "Headline/summary semantic rule selected over generic label."
          : undefined,
    };
  }

  if (
    topSemantic &&
    requestedType &&
    requestedType !== UNKNOWN_TYPE &&
    SIGNAL_TYPES.includes(requestedType) &&
    GENERIC_OVERRIDE_TYPES.has(requestedType) &&
    topSemantic.type !== requestedType
  ) {
    return {
      signalType: topSemantic.type,
      semanticEventType: topSemantic.type,
      method: "semantic_override",
      matchedRules,
      confidence: 0.7,
      note: `Semantic rule overrode generic requested type ${requestedType}.`,
    };
  }

  if (requestedType && requestedType !== UNKNOWN_TYPE && SIGNAL_TYPES.includes(requestedType)) {
    return {
      signalType: requestedType,
      semanticEventType: topSemantic?.type || requestedType,
      method: "cli",
      matchedRules,
      confidence: topSemantic?.type === requestedType ? 0.75 : 0.7,
    };
  }

  if (topSemantic) {
    return {
      signalType: topSemantic.type,
      semanticEventType: topSemantic.type,
      method: "rules",
      matchedRules,
      confidence: semanticMatches.length === 1 ? 0.68 : 0.58,
      note: semanticMatches.length > 1 ? "Multiple rule matches; highest-priority semantic type selected." : undefined,
    };
  }

  return {
    signalType: UNKNOWN_TYPE,
    semanticEventType: UNKNOWN_TYPE,
    method: "rules",
    matchedRules: [],
    confidence: 0.4,
  };
}

export function isCanonicalSignalType(signalType) {
  return canonicalTypesSet().has(signalType);
}

export { UNKNOWN_TYPE, SIGNAL_TYPES };
