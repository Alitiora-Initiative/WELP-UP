'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { Trophy, AlertTriangle, X, Users, TrendingUp, Layers } from 'lucide-react';

type BotEntry = {
  rank: number;
  botName: string;
  creator: string;
  creatorAddress: string;
  strategy: string;
  feeBps: number;
  strategyVersion: number;
  maxPositionBps: number;
  maxSlippageBps: number;
  requiredFundingLamports: number;
  roi7d: number;
  roi30d: number;
  roiAllTime: number;
  tvlSol: number;
  copierCount: number;
  winRate: number;
  isDemo: boolean;
};

type SortField = 'roi7d' | 'roi30d' | 'roiAllTime' | 'tvlSol' | 'copierCount';
type TimeWindow = '7d' | '30d' | 'all';

function formatRoi(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}
function formatBps(bps: number): string {
  return (bps / 100).toFixed(1) + '%';
}
function formatSol(v: number): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' SOL';
}

export function LeaderboardPage() {
  const [bots, setBots] = useState<BotEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('30d');
  const [sortField, setSortField] = useState<SortField>('roi30d');
  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  const [selectedBot, setSelectedBot] = useState<BotEntry | null>(null);
  const [disclaimer, setDisclaimer] = useState('');

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/leaderboard', { cache: 'no-store' });
      const data = await res.json() as { bots: BotEntry[]; disclaimer: string };
      setBots(data.bots ?? []);
      setDisclaimer(data.disclaimer ?? '');
    } catch {
      setError('Failed to load leaderboard. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchLeaderboard(); }, [fetchLeaderboard]);

  const roiField: Record<TimeWindow, SortField> = { '7d': 'roi7d', '30d': 'roi30d', 'all': 'roiAllTime' };
  const roiKey = roiField[timeWindow];

  const strategies = ['all', ...Array.from(new Set(bots.map(b => b.strategy)))];

  const sorted = [...bots]
    .filter(b => strategyFilter === 'all' || b.strategy === strategyFilter)
    .sort((a, b) => (b[sortField] as number) - (a[sortField] as number));

  return (
    <main className="app-shell">
      <AppSidebar active="leaderboard" />

      <section className="workspace" id="top">
        <header className="topbar">
          <div className="breadcrumb">
            <span>WORKSPACE</span>
            <span className="crumb-slash">/</span>
            <strong>Leaderboard</strong>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">PERFORMANCE</p>
              <h1>Bot <em>leaderboard.</em></h1>
              <p className="welcome-copy">Top performing bots ranked by verified on-chain results.</p>
            </div>
          </section>

          {/* Demo data disclaimer banner */}
          {disclaimer && (
            <div className="leaderboard-disclaimer" role="status">
              <AlertTriangle size={14} aria-hidden="true" />
              <span>{disclaimer}</span>
            </div>
          )}

          {/* Controls */}
          <div className="leaderboard-controls" role="group" aria-label="Leaderboard filters">
            <div className="leaderboard-tabs" role="tablist" aria-label="Time window">
              {(['7d', '30d', 'all'] as TimeWindow[]).map(w => (
                <button
                  key={w}
                  role="tab"
                  aria-selected={timeWindow === w}
                  onClick={() => { setTimeWindow(w); setSortField(roiField[w]); }}
                  className={`leaderboard-tab${timeWindow === w ? ' active' : ''}`}
                >
                  {w === '7d' ? '7 Day' : w === '30d' ? '30 Day' : 'All Time'} ROI
                </button>
              ))}
            </div>
            <div className="leaderboard-filter-row">
              <label htmlFor="strategy-filter" className="leaderboard-filter-label">Strategy:</label>
              <select
                id="strategy-filter"
                value={strategyFilter}
                onChange={e => setStrategyFilter(e.target.value)}
                className="leaderboard-select"
                aria-label="Filter by strategy"
              >
                {strategies.map(s => <option key={s} value={s}>{s === 'all' ? 'All Strategies' : s}</option>)}
              </select>
              <label htmlFor="sort-field" className="leaderboard-filter-label">Sort by:</label>
              <select
                id="sort-field"
                value={sortField}
                onChange={e => setSortField(e.target.value as SortField)}
                className="leaderboard-select"
                aria-label="Sort leaderboard by"
              >
                <option value="roi7d">7D ROI</option>
                <option value="roi30d">30D ROI</option>
                <option value="roiAllTime">All-Time ROI</option>
                <option value="tvlSol">TVL</option>
                <option value="copierCount">Copiers</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {loading && <div className="leaderboard-loading" aria-live="polite" role="status">Loading leaderboard...</div>}
          {error && <div className="leaderboard-error" role="alert">{error}</div>}

          {!loading && !error && (
            <div className="leaderboard-table-wrap">
              <table className="leaderboard-table" aria-label="Bot performance leaderboard">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Bot</th>
                    <th scope="col">Strategy</th>
                    <th scope="col">{timeWindow === '7d' ? '7D' : timeWindow === '30d' ? '30D' : 'All'} ROI</th>
                    <th scope="col">TVL</th>
                    <th scope="col"><Users size={12} aria-hidden="true" /> Copiers</th>
                    <th scope="col">Fee</th>
                    <th scope="col">Win Rate</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(bot => (
                    <tr key={bot.rank} className="leaderboard-row">
                      <td className="leaderboard-rank">
                        {bot.rank <= 3 ? <Trophy size={13} aria-hidden="true" className={`rank-icon rank-${bot.rank}`} /> : null}
                        {bot.rank}
                      </td>
                      <td>
                        <div className="leaderboard-bot-name">{bot.botName}</div>
                        <div className="leaderboard-creator">{bot.creator}</div>
                      </td>
                      <td><span className="leaderboard-strategy-badge">{bot.strategy}</span></td>
                      <td className={`leaderboard-roi ${(bot[roiKey] as number) >= 0 ? 'positive' : 'negative'}`}>
                        {formatRoi(bot[roiKey] as number)}
                      </td>
                      <td>{formatSol(bot.tvlSol)}</td>
                      <td>{bot.copierCount}</td>
                      <td>{formatBps(bot.feeBps)}</td>
                      <td>{bot.winRate.toFixed(1)}%</td>
                      <td>
                        <button
                          className="leaderboard-copy-button"
                          onClick={() => setSelectedBot(bot)}
                          aria-label={`Copy bot ${bot.botName}`}
                        >
                          Copy Bot
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Copy Bot Modal */}
          {selectedBot && (
            <div
              className="leaderboard-modal-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="copy-modal-title"
              onClick={e => { if (e.target === e.currentTarget) setSelectedBot(null); }}
            >
              <div className="leaderboard-modal">
                <div className="leaderboard-modal-header">
                  <h2 id="copy-modal-title">Copy Bot — {selectedBot.botName}</h2>
                  <button
                    className="leaderboard-modal-close"
                    onClick={() => setSelectedBot(null)}
                    aria-label="Close copy bot dialog"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="leaderboard-modal-body">
                  <dl className="leaderboard-modal-dl">
                    <dt>Creator</dt><dd>{selectedBot.creator}</dd>
                    <dt>Creator Fee</dt><dd>{formatBps(selectedBot.feeBps)} of realized profit</dd>
                    <dt>Strategy</dt><dd>{selectedBot.strategy}</dd>
                    <dt>Strategy Version</dt><dd>v{selectedBot.strategyVersion}</dd>
                    <dt>Max Position Size</dt><dd>{formatBps(selectedBot.maxPositionBps)} of vault</dd>
                    <dt>Max Slippage</dt><dd>{formatBps(selectedBot.maxSlippageBps)}</dd>
                    <dt>Required Funding</dt><dd>{(selectedBot.requiredFundingLamports / 1e9).toFixed(3)} SOL minimum</dd>
                    <dt>Win Rate</dt><dd>{selectedBot.winRate.toFixed(1)}%</dd>
                  </dl>
                  <div className="leaderboard-modal-disclaimer">
                    <AlertTriangle size={13} aria-hidden="true" />
                    <span>Demo data — live leaderboard requires on-chain settlement records.</span>
                  </div>
                </div>
                <div className="leaderboard-modal-footer">
                  <button
                    className="connect-button"
                    onClick={() => { /* wallet connect approval UI — no transaction in this milestone */ alert('Connect wallet to proceed. (Wallet approval UI — no transaction in this milestone)'); }}
                    aria-label="Connect wallet to copy this bot"
                  >
                    <Layers size={14} aria-hidden="true" /> Connect Wallet to Copy
                  </button>
                  <button
                    className="leaderboard-cancel-button"
                    onClick={() => setSelectedBot(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <footer className="footer">
            <span>WELP UP · Solana mainnet</span>
            <span>Trading is risky. A token can lose all value.</span>
            <a href="/terms">Terms &amp; Conditions</a>
          </footer>
        </div>
      </section>
    </main>
  );
}
