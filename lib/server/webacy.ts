type JsonRecord = Record<string, unknown>;
export type WebacyServerResult = { ok: true; data: JsonRecord } | { ok: false; error: string };
const API_BASE = 'https://api.webacy.com';
const REQUEST_TIMEOUT_MS = 8_000;

async function requestWebacy(path: string, body?: JsonRecord): Promise<WebacyServerResult> {
  const apiKey = process.env.WEBACY_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: 'Webacy is not configured on the server.' };
  try {
    const response = await fetch(API_BASE + path, {
      method: body ? 'POST' : 'GET',
      headers: { Accept: 'application/json', 'x-api-key': apiKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const reason = response.status === 401 || response.status === 403
        ? 'Webacy rejected the API key or this endpoint is not enabled for the account.'
        : response.status === 429 ? 'Webacy rate limit reached.' : `Webacy returned HTTP ${response.status}.`;
      return { ok: false, error: reason };
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, error: 'Webacy returned an unreadable security response.' };
    return { ok: true, data: payload as JsonRecord };
  } catch (error) {
    return { ok: false, error: error instanceof Error && error.name === 'TimeoutError' ? 'Webacy security check timed out.' : 'Webacy security service could not be reached.' };
  }
}

/** Solana-only Trading Lite screening, called before a Jupiter order is returned. */
export function getWebacySolanaTokenScan(mint: string): Promise<WebacyServerResult> {
  return requestWebacy('/trading-lite/' + encodeURIComponent(mint));
}

/** Phishing/malware URL screening, called before creator links are published. */
export function getWebacyUrlScan(url: string): Promise<WebacyServerResult> {
  return requestWebacy('/url/check', { url });
}
