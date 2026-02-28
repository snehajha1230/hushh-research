export type InvestorMessageCode =
  | "ACCOUNT_STATE_UNAVAILABLE"
  | "ONBOARDING_STATE_UNAVAILABLE"
  | "VAULT_STATUS_UNAVAILABLE"
  | "VAULT_UNLOCK_FAILED"
  | "VAULT_PASSKEY_ENROLL_REQUIRED"
  | "MARKET_DATA_UNAVAILABLE"
  | "ANALYSIS_UNAVAILABLE"
  | "NETWORK_RECOVERY"
  | "SAVE_IN_PROGRESS";

export type InvestorLoadingStage =
  | "SESSION_CHECK"
  | "ACCOUNT_STATE"
  | "ONBOARDING"
  | "MARKET"
  | "ANALYSIS"
  | "VAULT";

export type DecisionDisplayLabel = "BUY" | "HOLD" | "WATCH" | "REDUCE" | "REVIEW";

export interface InvestorDecisionDisplay {
  label: DecisionDisplayLabel;
  tone: "positive" | "neutral" | "negative";
  guidance: string;
}

export const INVESTOR_BANNED_TERMS = [
  "prf",
  "native prf",
  "fallback",
  "runtime",
  "token",
  "wrapper",
  "decrypt",
  "encrypted",
  "debug",
  "stream degraded",
] as const;

export function toInvestorMessage(
  code: InvestorMessageCode,
  context?: { ticker?: string; reason?: string | null }
): string {
  switch (code) {
    case "ACCOUNT_STATE_UNAVAILABLE":
      return "We could not load your account details right now. Please try again.";
    case "ONBOARDING_STATE_UNAVAILABLE":
      return "We could not load your onboarding progress. Please try again.";
    case "VAULT_STATUS_UNAVAILABLE":
      return "We could not check your Vault status right now. Please try again.";
    case "VAULT_UNLOCK_FAILED":
      return "We could not unlock your Vault. Please confirm your details and try again.";
    case "VAULT_PASSKEY_ENROLL_REQUIRED":
      return "Use your passphrase once on this device, then enable passkey for faster sign-in.";
    case "MARKET_DATA_UNAVAILABLE":
      return "Live market data is temporarily unavailable. Showing the latest available view.";
    case "ANALYSIS_UNAVAILABLE":
      return context?.ticker
        ? `Analysis for ${context.ticker} is not available yet.`
        : "Analysis is not available yet.";
    case "NETWORK_RECOVERY":
      return "Connection was interrupted. We are restoring your session.";
    case "SAVE_IN_PROGRESS":
      return "Your portfolio is being secured. This may take a moment.";
    default:
      return "Please try again.";
  }
}

export function toInvestorLoading(stage: InvestorLoadingStage): string {
  switch (stage) {
    case "SESSION_CHECK":
      return "Checking your session...";
    case "ACCOUNT_STATE":
      return "Loading your account...";
    case "ONBOARDING":
      return "Preparing your guided setup...";
    case "MARKET":
      return "Loading market view...";
    case "ANALYSIS":
      return "Preparing your analysis...";
    case "VAULT":
      return "Opening your Vault...";
    default:
      return "Loading...";
  }
}

export function toInvestorDecisionLabel(
  decision: string | null | undefined,
  ownsPosition?: boolean | null
): InvestorDecisionDisplay {
  const normalized = String(decision || "").trim().toLowerCase();
  if (normalized === "buy") {
    return {
      label: "BUY",
      tone: "positive",
      guidance: "Build or add to position based on your plan.",
    };
  }
  if (normalized === "reduce" || normalized === "sell") {
    return {
      label: "REDUCE",
      tone: "negative",
      guidance: "Trim exposure to align with your risk limits.",
    };
  }
  if (normalized === "hold") {
    if (ownsPosition === true) {
      return {
        label: "HOLD",
        tone: "neutral",
        guidance: "Maintain position and monitor key updates.",
      };
    }
    return {
      label: "WATCH",
      tone: "neutral",
      guidance: "Track the name and wait for a clearer entry setup.",
    };
  }
  return {
    label: "REVIEW",
    tone: "neutral",
    guidance: "Review the full analysis before taking action.",
  };
}

const STREAM_TECHNICAL_SUBSTITUTIONS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bva(?:ult)?_?owner token\b/gi, replacement: "secure access" },
  { pattern: /\bconsent token\b/gi, replacement: "secure access" },
  { pattern: /\btoken refresh(?:ed|)\b/gi, replacement: "session refresh" },
  { pattern: /\bdecryption\b/gi, replacement: "unlock" },
  { pattern: /\bdecrypt(?:ed|ing)?\b/gi, replacement: "unlock" },
  { pattern: /\bencryption\b/gi, replacement: "secure storage" },
  { pattern: /\bencrypt(?:ed|ing)?\b/gi, replacement: "secure" },
  { pattern: /\bfallback(?: path)?\b/gi, replacement: "backup source" },
  { pattern: /\bruntime\b/gi, replacement: "session" },
  { pattern: /\bdebug(?:ging|)\b/gi, replacement: "" },
  { pattern: /\btrace(?:s|)\b/gi, replacement: "" },
  { pattern: /\bprovider failure\b/gi, replacement: "data source unavailable" },
  { pattern: /\bhttp\s*\d{3}\b/gi, replacement: "network response" },
  { pattern: /\b429\b/gi, replacement: "temporary capacity limit" },
  { pattern: /\btoo many requests\b/gi, replacement: "capacity limit reached" },
  { pattern: /\bresource exhausted\b/gi, replacement: "service capacity temporarily unavailable" },
  { pattern: /https?:\/\/[^\s)]+/gi, replacement: "" },
];

export function toInvestorStreamText(value: unknown): string {
  const source = typeof value === "string" ? value : "";
  if (!source.trim()) return "";

  let next = source
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  // Remove XML/HTML-ish wrappers that leak from streamed model output.
  next = next.replace(/<\/?[\w:-]+(?:\s[^>]*)?>/g, " ");
  for (const rule of STREAM_TECHNICAL_SUBSTITUTIONS) {
    next = next.replace(rule.pattern, rule.replacement);
  }
  next = next
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\(\s*\)/g, "")
    .trim();
  return next;
}
