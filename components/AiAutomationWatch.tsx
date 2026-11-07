'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, LoaderCircle, Pause, Play, RefreshCw } from 'lucide-react';

type WatchPolicy = {
  id: string;
  name: string;
  liquidity: number;
  organic: number;
  drawdown: number;
  verified: boolean;
};

type MarketAsset = {
  mint: string;
  symbol: string;
  eligible: boolean;
  liquidityUsd: number;
  organicScore: number;
  priceChange24h: number;
  score: number;
  verified: boolean;
};

type MarketFeed = {
  updatedAt: string;
  assets: MarketAsset[];
};

type AnalystStatus = {
  configured: boolean;
  model: string | null;
};

type Review = {
  policyName: string;
  mint: string;
  model: string;
  answer: string;
  marketUpdatedAt: string;
  assetsAnalyzed: number;
};

function isWatchPolicy(value: unknown): value is WatchPolicy {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' &&
    typeof row.name === 'string' &&
    typeof row.liquidity === 'number' && Number.isFinite(row.liquidity) &&
    typeof row.organic === 'number' && Number.isInteger(row.organic) &&
    typeof row.drawdown === 'number' && Number.isFinite(row.drawdown) &&
    typeof row.verified === 'boolean';
}

export function AiAutomationWatch() {
  const [status, setStatus] = useState<AnalystStatus | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [policyCount, setPolicyCount] = useState(0);
  const [message, setMessage] = useState('');
  const [lastFeedAt, setLastFeedAt] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const running = useRef(false);

  const refreshPolicyCount = useCallback(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem('welp-watch-policies') || '[]');
      const valid = Array.isArray(stored) ? stored.filter(isWatchPolicy) : [];
      setPolicyCount(valid.length);
    } catch {
      setPolicyCount(0);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/agent', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json() as AnalystStatus & { error?: string };
        if (!response.ok) throw new Error(data.error || 'AI analyst status is unavailable.');
        if (active) setStatus({ configured: data.configured === true, model: data.model ?? null });
      })
      .catch(() => {
        if (active) setStatus({ configured: false, model: null });
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const refresh = () => refreshPolicyCount();
    refresh();
    window.addEventListener('welp-watch-policies-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('welp-watch-policies-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refreshPolicyCount]);

  const scan = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setScanning(true);
    setMessage('');
    try {
      let policies: WatchPolicy[] = [];
      try {
        const stored: unknown = JSON.parse(localStorage.getItem('welp-watch-policies') || '[]');
        policies = Array.isArray(stored) ? stored.filter(isWatchPolicy) : [];
      } catch {
        policies = [];
      }
      setPolicyCount(policies.length);
      if (!policies.length) {
        setMessage('Save a named signal policy before starting AI review.');
        return;
      }

      const feedResponse = await fetch('/api/markets', { cache: 'no-store' });
      const feed = await feedResponse.json() as MarketFeed & { error?: string };
      if (!feedResponse.ok || !Array.isArray(feed.assets) || !feed.updatedAt) {
        throw new Error(feed.error || 'The current Jupiter market snapshot is unavailable.');
      }
      setLastFeedAt(feed.updatedAt);

      const matches = policies.flatMap((policy) =>
        feed.assets
          .filter((asset) =>
            asset.eligible &&
            asset.liquidityUsd >= policy.liquidity &&
            asset.organicScore >= policy.organic &&
            asset.priceChange24h >= -policy.drawdown &&
            (!policy.verified || asset.verified),
          )
          .map((asset) => ({ policy, asset, key: policy.id + ':' + asset.mint })),
      ).sort((a, b) => b.asset.score - a.asset.score || b.asset.liquidityUsd - a.asset.liquidityUsd);

      let reviewed: Record<string, number> = {};
      try {
        reviewed = JSON.parse(localStorage.getItem('welp-watch-ai-reviewed') || '{}') as Record<string, number>;
      } catch {
        reviewed = {};
      }
      const now = Date.now();
      const candidate = matches.find(({ key }) => now - (reviewed[key] || 0) >= 24 * 60 * 60 * 1000);
      if (!candidate) {
        setMessage(matches.length
          ? 'The live policies matched assets, but each matching policy/mint has already received its 24-hour AI review.'
          : 'Live scan completed. No assets matched the saved policies.');
        return;
      }

      const lastRequest = Number(localStorage.getItem('welp-watch-ai-last-request') || 0);
      if (Number.isFinite(lastRequest) && now - lastRequest < 60_000) {
        setMessage('AI review is rate-limited to one request per minute in this browser. The next scan can retry.');
        return;
      }
      localStorage.setItem('welp-watch-ai-last-request', String(now));

      const question = [
        'Review the latest supplied live Jupiter market snapshot for this exact Solana mint: ' + candidate.asset.mint + '.',
        'The matching user policy thresholds are minimum liquidity USD ' + candidate.policy.liquidity +
          ', minimum organic score ' + candidate.policy.organic +
          ', maximum 24-hour drawdown percent ' + candidate.policy.drawdown +
          ', verified-only ' + String(candidate.policy.verified) + '.',
        'Use only fields present in the supplied snapshot. Explain blockers, warnings, uncertainty and missing data. Do not recommend buying or selling, specify an allocation, or claim any transaction was placed.',
      ].join(' ');

      const reviewResponse = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const result = await reviewResponse.json() as {
        answer?: string;
        model?: string;
        marketUpdatedAt?: string;
        assetsAnalyzed?: number;
        error?: string;
      };
      if (!reviewResponse.ok || !result.answer || !result.model || !result.marketUpdatedAt) {
        throw new Error(result.error || 'The AI analyst did not return a complete review.');
      }

      reviewed[candidate.key] = now;
      try { localStorage.setItem('welp-watch-ai-reviewed', JSON.stringify(reviewed)); } catch {}
      setReview({
        policyName: candidate.policy.name,
        mint: candidate.asset.mint,
        model: result.model,
        answer: result.answer,
        marketUpdatedAt: result.marketUpdatedAt,
        assetsAnalyzed: Number(result.assetsAnalyzed || 0),
      });
      setMessage('AI reviewed a new live policy match. No wallet action or transaction was performed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'AI market review failed.');
    } finally {
      running.current = false;
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !status?.configured) return;
    const initialScan = window.setTimeout(() => void scan(), 0);
    const timer = window.setInterval(() => void scan(), 60_000);
    return () => {
      window.clearTimeout(initialScan);
      window.clearInterval(timer);
    };
  }, [enabled, status?.configured, scan]);

  return (
    <section className="terminal-panel">
      <div className="terminal-panel-heading">
        <span>LIVE POLICY MATCHES · READ-ONLY AI</span>
        <h2 className="flex items-center gap-2"><Bot size={18} /> AI automation watch</h2>
      </div>
      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="feature-stat">
            <span>AI ANALYST</span>
            <strong>{status === null ? 'CHECKING' : status.configured ? 'CONFIGURED' : 'UNAVAILABLE'}</strong>
            <small>{status?.model || 'Server-side model configuration required'}</small>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={enabled ? 'outline-button small' : 'primary-action'}
              disabled={!status?.configured || scanning}
              onClick={() => {
                if (enabled) {
                  setEnabled(false);
                  setMessage('AI automation watch paused.');
                } else {
                  setEnabled(true);
                  setMessage('AI automation watch started. It runs only while this page remains open.');
                }
              }}
            >
              {enabled ? <><Pause size={13} /> Pause AI watch</> : <><Play size={13} /> Start AI watch</>}
            </button>
            <button type="button" className="outline-button small" onClick={() => void scan()} disabled={!status?.configured || scanning}>
              {scanning ? <LoaderCircle className="spin" size={13} /> : <RefreshCw size={13} />}
              Scan now
            </button>
          </div>
        </div>

        <div className="feature-stats mt-4">
          <div className="feature-stat"><span>SAVED RULES</span><strong>{policyCount}</strong><small>Browser-local policies</small></div>
          <div className="feature-stat"><span>WATCH STATE</span><strong>{enabled ? 'ACTIVE' : 'PAUSED'}</strong><small>60-second live scans</small></div>
          <div className="feature-stat"><span>LAST FEED</span><strong>{lastFeedAt ? new Date(lastFeedAt).toLocaleTimeString() : '—'}</strong><small>Jupiter snapshot timestamp</small></div>
        </div>

        {!status?.configured ? (
          <p className="notice-block" role="status">
            The read-only AI analyst is not configured for this deployment. Add OPENAI_API_KEY and WELP_AI_MODEL as server-only Vercel variables before AI reviews can run.
          </p>
        ) : null}
        {message ? <p className="inline-message" role="status">{message}</p> : null}

        {review ? (
          <div className="mt-4 rounded-xl border border-border p-4">
            <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span>Policy · {review.policyName}</span>
              <span>Mint · <code>{review.mint}</code></span>
              <span>Model · {review.model}</span>
              <span>Feed · {new Date(review.marketUpdatedAt).toLocaleString()}</span>
              <span>Assets analyzed · {review.assetsAnalyzed}</span>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-7 text-foreground">{review.answer}</div>
            <p className="muted-copy mt-4">AI analysis is informational. This component cannot sign, submit or automate real trades.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
