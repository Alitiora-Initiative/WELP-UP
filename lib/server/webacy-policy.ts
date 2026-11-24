export type WebacyTokenAssessment = {
  state: 'allow' | 'block' | 'unknown';
  riskScore?: number;
  isHoneypot?: boolean;
  reason?: string;
};

export type WebacyUrlAssessment = {
  state: 'allow' | 'block' | 'unknown';
  riskScore?: number;
  categories: string[];
  reason?: string;
};

type JsonRecord = Record<string, unknown>;
function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}
function score(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
}

/** Webacy's DEX guide defines a quick Solana pass as riskScore < 50 and isHoneypot === false. */
export function evaluateSolanaTokenScan(payload: unknown): WebacyTokenAssessment {
  const data = record(payload);
  if (!data) return { state: 'unknown', reason: 'Webacy returned an invalid token-security response.' };
  const isHoneypot = data.isHoneypot;
  const riskScore = score(data.riskScore);
  if (isHoneypot === true) return { state: 'block', isHoneypot: true, riskScore: riskScore ?? undefined, reason: 'Webacy identified this token as a possible honeypot. WELP blocked the swap.' };
  if (typeof isHoneypot !== 'boolean' || riskScore === null) {
    return { state: 'unknown', reason: 'Webacy did not return complete, verifiable token-security indicators.' };
  }
  if (riskScore >= 50) return {
    state: 'block', riskScore, isHoneypot: false,
    reason: `Webacy returned a risk score of ${riskScore}/100. WELP only creates swap orders when the score is below 50 and the token is not flagged as a honeypot.`,
  };
  return { state: 'allow', riskScore, isHoneypot: false };
}

/** Outbound links in token metadata are blocked for phishing/malware, unknown, or caution+ scores. */
export function evaluateWebacyUrlScan(payload: unknown): WebacyUrlAssessment {
  const data = record(payload);
  if (!data) return { state: 'unknown', categories: [], reason: 'Webacy returned an invalid URL-security response.' };
  const isPhishing = data.isPhishing;
  const isMalware = data.isMalware;
  const riskScore = score(data.riskScore);
  const categories = Array.isArray(data.categories) ? data.categories.filter((entry): entry is string => typeof entry === 'string').slice(0, 12) : [];
  if (isPhishing === true || isMalware === true) return {
    state: 'block', riskScore: riskScore ?? undefined, categories,
    reason: isPhishing === true ? 'Webacy flagged this link as phishing.' : 'Webacy flagged this link as malware.',
  };
  if (typeof isPhishing !== 'boolean' || typeof isMalware !== 'boolean' || riskScore === null) {
    return { state: 'unknown', categories, reason: 'Webacy did not return complete URL-security indicators.' };
  }
  if (riskScore > 40) return {
    state: 'block', riskScore, categories,
    reason: `Webacy returned a caution/high URL risk score of ${riskScore}/100. Review or replace this link before publishing it.`,
  };
  return { state: 'allow', riskScore, categories };
}
