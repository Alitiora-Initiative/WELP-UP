export type ActivityEvent = {
  id: string;
  type: 'scan' | 'trade';
  at: number;
  title: string;
  detail: string;
  symbol?: string;
  side?: 'buy' | 'sell';
  signature?: string;
};

export type EquityPoint = { at: number; equityUsd: number; sol: number };

export type WalletHistory = {
  events: ActivityEvent[];
  points: EquityPoint[];
  lastScanAt?: number;
};

const VERSION = 1;
const MAX_EVENTS = 300;
const MAX_POINTS = 720;
const SNAPSHOT_INTERVAL_MS = 2 * 60 * 1000;

function storageKey(owner: string) {
  return `welp:wallet-history:v${VERSION}:${owner}`;
}

function readHistory(owner: string): WalletHistory {
  if (typeof window === 'undefined' || !owner) return { events: [], points: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(owner)) ?? 'null') as Partial<WalletHistory> | null;
    return {
      events: Array.isArray(parsed?.events) ? parsed.events : [],
      points: Array.isArray(parsed?.points) ? parsed.points : [],
      lastScanAt: typeof parsed?.lastScanAt === 'number' ? parsed.lastScanAt : undefined,
    };
  } catch {
    return { events: [], points: [] };
  }
}

function writeHistory(owner: string, history: WalletHistory) {
  if (typeof window === 'undefined' || !owner) return;
  try {
    window.localStorage.setItem(storageKey(owner), JSON.stringify({
      ...history,
      events: history.events.slice(0, MAX_EVENTS),
      points: history.points.slice(-MAX_POINTS),
    } satisfies WalletHistory));
  } catch {
    // Local history is optional; wallet and trading flows must still work if storage is unavailable.
  }
}

export function getWalletHistory(owner: string) {
  return readHistory(owner);
}

export function addWalletEvent(owner: string, event: ActivityEvent) {
  const history = readHistory(owner);
  if (history.events.some((current) => current.id === event.id)) return;
  writeHistory(owner, { ...history, events: [event, ...history.events].slice(0, MAX_EVENTS) });
}

export function recordEquityPoint(owner: string, point: EquityPoint) {
  const history = readHistory(owner);
  const previous = history.points[history.points.length - 1];
  if (previous && point.at - previous.at < SNAPSHOT_INTERVAL_MS) return;
  writeHistory(owner, { ...history, points: [...history.points, point].slice(-MAX_POINTS) });
}

export function recordSignalScan(owner: string, signals: Array<{ mint: string; symbol: string; score: number; eligible: boolean }>) {
  const history = readHistory(owner);
  const now = Date.now();
  if (history.lastScanAt && now - history.lastScanAt < 60_000) return;
  const eligible = signals.filter((signal) => signal.eligible);
  const highlighted = (eligible.length ? eligible : signals.slice(0, 2)).slice(0, 2).map((signal) => signal.symbol).join(', ');
  addWalletEvent(owner, {
    id: `scan:${now}`,
    type: 'scan',
    at: now,
    title: eligible.length ? `Rule scan found ${eligible.length} eligible signal${eligible.length === 1 ? '' : 's'}` : 'Rule scan completed',
    detail: `${signals.length} pools reviewed${highlighted ? ` · ${eligible.length ? 'In-window' : 'Top reviewed'}: ${highlighted}` : ''}. No trade was submitted by this scan.`,
  });
  writeHistory(owner, { ...readHistory(owner), lastScanAt: now });
}
