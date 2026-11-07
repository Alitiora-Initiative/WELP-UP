'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Bot, LoaderCircle, LockKeyhole, RefreshCw, Sparkles } from 'lucide-react';

type AgentStatus = {
  configured: boolean;
  model: string | null;
  mode: string;
  walletAccess: false;
  transactionAccess: false;
  executionEnabled: false;
};
type Analysis = {
  answer: string;
  model: string;
  marketUpdatedAt: string;
  assetsAnalyzed: number;
  mode: string;
};

const STARTERS = [
  'Summarize the current market snapshot and its main risks.',
  'Which assets have the strongest liquidity and organic activity, and what are their blockers?',
  'Compare the eligible and blocked groups without making price predictions.',
];

export function MarketAnalyst() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [question, setQuestion] = useState(STARTERS[0]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  async function checkStatus() {
    setChecking(true);
    try {
      const response = await fetch('/api/agent', { cache: 'no-store' });
      const data = await response.json() as AgentStatus;
      if (!response.ok) throw new Error('Could not read analyst status.');
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void checkStatus(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setAnalysis(null);
    setLoading(true);
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await response.json() as Analysis & { error?: string };
      if (!response.ok) throw new Error(data.error || 'The analyst could not answer.');
      setAnalysis(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The analyst could not answer.');
    } finally {
      setLoading(false);
    }
  }

  return <div className="space-y-5">
    <section className="terminal-panel">
      <div className="terminal-panel-heading">
        <span>READ-ONLY MODEL RUNTIME</span>
        <h2 className="flex items-center gap-2"><Bot size={19} /> WELP market analyst</h2>
      </div>
      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={'gate-state ' + (status?.configured ? 'good' : '')}>{checking ? 'CHECKING' : status?.configured ? 'CONFIGURED' : 'NOT CONFIGURED'}</span>
            <span>{status?.model || 'No model connected'}</span>
          </div>
          <button type="button" className="outline-button small" onClick={() => void checkStatus()} disabled={checking}>
            <RefreshCw size={13} className={checking ? 'spin' : ''} /> Refresh status
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="feature-stat"><span>MARKET INPUT</span><strong>LIVE FEED</strong><small>Jupiter Token API v2</small></div>
          <div className="feature-stat"><span>WALLET ACCESS</span><strong>NONE</strong><small>No balances or private data sent</small></div>
          <div className="feature-stat"><span>EXECUTION</span><strong>DISABLED</strong><small>Analysis cannot submit trades</small></div>
        </div>
        {!status?.configured ? <div className="notice-block" style={{ marginTop: 18 }}>
          <LockKeyhole size={18} />
          <div><strong>Connect a server-side model before using the analyst.</strong>
            <p>Add both <code>OPENAI_API_KEY</code> and <code>WELP_AI_MODEL</code> to the Vercel project’s server environment, scoped to Preview first. Choose a model enabled for your API project. Never use a <code>NEXT_PUBLIC_</code> prefix or place the key in browser code. Before enabling this publicly in Production, add durable rate limiting and provider spend controls. Until configured, no AI answer is generated.</p>
          </div>
        </div> : null}
      </div>
    </section>

    <section className="terminal-panel">
      <div className="terminal-panel-heading"><span>ASK ABOUT THE CURRENT SNAPSHOT</span><h2>Research, not instructions.</h2></div>
      <form className="p-5" onSubmit={ask}>
        <label className="field-label">YOUR QUESTION
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} rows={4} placeholder="Ask about liquidity, market structure, signal blockers or data quality…" disabled={!status?.configured || loading} />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {STARTERS.map((starter) => <button type="button" key={starter} className="outline-button small" onClick={() => setQuestion(starter)} disabled={!status?.configured || loading}>{starter}</button>)}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{question.length}/500 · Maximum 4 requests per minute per server instance</span>
          <button type="submit" className="primary-action" disabled={!status?.configured || loading || !question.trim()}>
            {loading ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />} {loading ? 'Analyzing live snapshot…' : 'Analyze market'}
          </button>
        </div>
        {error ? <p className="inline-message" role="alert">{error}</p> : null}
      </form>
    </section>

    {analysis ? <section className="terminal-panel">
      <div className="terminal-panel-heading"><span>MODEL OUTPUT · ANALYSIS ONLY</span><h2>Market research note</h2></div>
      <div className="p-5">
        <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span>Model · {analysis.model}</span>
          <span>Assets analyzed · {analysis.assetsAnalyzed}</span>
          <span>Feed · {new Date(analysis.marketUpdatedAt).toLocaleString()}</span>
        </div>
        <div className="whitespace-pre-wrap text-sm leading-7 text-foreground">{analysis.answer}</div>
        <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">AI-generated research can be wrong. Verify each figure against the live feed. This response is not a trade instruction and cannot execute a transaction.</p>
      </div>
    </section> : null}
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole size={13} /> The model receives only a compact public market snapshot and your question. It has no wallet, signing, transaction, or bot-execution tools.</p>
  </div>;
}
