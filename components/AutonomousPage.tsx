'use client';

import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { Bot, CircleHelp, Info, Pause, Play, Plus, ShieldAlert, ShieldCheck, Sparkles, Trash2, TrendingUp, Wallet, X, Zap } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { WalletConnectionControl } from '@/components/WalletConnectionControl';
import { calculatePaperGridTick, paperGridIndex, paperStopReason, validatePaperBotSettings } from '@/lib/paper-bots';

type Strategy = 'AI Grid' | 'Momentum' | 'DCA';
type Direction = 'Long' | 'Short' | 'Neutral';
type BotStatus = 'Draft' | 'Armed' | 'Running' | 'Paused' | 'Stopped';
type StartCondition = 'Instant' | 'Below reference by 1%' | 'Above reference by 1%' | 'Signal confirmation';
type StopCondition = 'Manual' | 'Take profit / stop loss' | 'Run time limit';

type PaperBot = {
  id: string;
  name: string;
  strategy: Strategy;
  symbol: string;
  direction: Direction;
  investment: number;
  lowerPrice: number;
  upperPrice: number;
  referencePrice: number;
  currentPrice: number;
  gridCount: number;
  takeProfitPct: number;
  stopLossPct: number;
  startCondition: StartCondition;
  stopCondition: StopCondition;
  durationHours: number;
  status: BotStatus;
  createdAt: number;
  startedAt: number | null;
  elapsedMs: number;
  gridIndex: number;
  gridFills: number;
  cycles: number;
  gridProfit: number;
  unpairedPnl: number;
  stopReason: string;
};

type Draft = {
  name: string;
  strategy: Strategy;
  symbol: string;
  direction: Direction;
  investment: string;
  lowerPrice: string;
  upperPrice: string;
  referencePrice: string;
  gridCount: string;
  takeProfitPct: string;
  stopLossPct: string;
  startCondition: StartCondition;
  stopCondition: StopCondition;
  durationHours: string;
};

const STORAGE_KEY = 'welp-paper-bots-v1';
const BOTS_UPDATED_EVENT = 'welp-paper-bots-updated';
const EMPTY_BOTS: PaperBot[] = [];
const CLOCK_INTERVAL_MS = 30_000;

let cachedStorageValue: string | null | undefined;
let cachedBots: PaperBot[] = EMPTY_BOTS;

function currentTime() {
  return Date.now();
}

function currentClockSnapshot() {
  return Math.floor(currentTime() / CLOCK_INTERVAL_MS) * CLOCK_INTERVAL_MS;
}

function getServerBotsSnapshot() {
  return EMPTY_BOTS;
}

function readSavedBots() {
  if (typeof window === 'undefined') return EMPTY_BOTS;
  let saved: string | null;
  try {
    saved = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY_BOTS;
  }
  if (saved === cachedStorageValue) return cachedBots;
  cachedStorageValue = saved;
  try {
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    cachedBots = Array.isArray(parsed) ? parsed.filter(isPaperBot) : EMPTY_BOTS;
  } catch {
    cachedBots = EMPTY_BOTS;
  }
  return cachedBots;
}

function subscribeToBots(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(BOTS_UPDATED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(BOTS_UPDATED_EVENT, onStoreChange);
  };
}

function subscribeToClock(onStoreChange: () => void) {
  const interval = window.setInterval(onStoreChange, CLOCK_INTERVAL_MS);
  return () => window.clearInterval(interval);
}

function updateSavedBots(update: (current: PaperBot[]) => PaperBot[]) {
  const next = update(readSavedBots());
  const serialized = JSON.stringify(next);
  window.localStorage.setItem(STORAGE_KEY, serialized);
  cachedStorageValue = serialized;
  cachedBots = next;
  window.dispatchEvent(new Event(BOTS_UPDATED_EVENT));
}

const DEFAULT_DRAFT: Draft = {
  name: '',
  strategy: 'AI Grid',
  symbol: 'SOLUSDT',
  direction: 'Long',
  investment: '100',
  lowerPrice: '95',
  upperPrice: '105',
  referencePrice: '100',
  gridCount: '8',
  takeProfitPct: '4',
  stopLossPct: '3',
  startCondition: 'Instant',
  stopCondition: 'Take profit / stop loss',
  durationHours: '24',
};

const TEMPLATES = [
  { label: 'SOL range grid', strategy: 'AI Grid' as Strategy, symbol: 'SOLUSDT', direction: 'Long' as Direction, investment: '50', lowerPrice: '92.97', upperPrice: '113.65', referencePrice: '103.31', gridCount: '5' },
  { label: 'XRP trend follower', strategy: 'Momentum' as Strategy, symbol: 'XRPUSDT', direction: 'Long' as Direction, investment: '30', lowerPrice: '1.05', upperPrice: '2.01', referencePrice: '1.53', gridCount: '4' },
  { label: 'SOL short grid', strategy: 'AI Grid' as Strategy, symbol: 'SOLUSDT', direction: 'Short' as Direction, investment: '25', lowerPrice: '84.76', upperPrice: '127.16', referencePrice: '105.96', gridCount: '2' },
];

function isPaperBot(value: unknown): value is PaperBot {
  if (!value || typeof value !== 'object') return false;
  const bot = value as Partial<PaperBot>;
  return typeof bot.id === 'string' && typeof bot.name === 'string' &&
    ['AI Grid', 'Momentum', 'DCA'].includes(String(bot.strategy)) &&
    typeof bot.symbol === 'string' && ['Long', 'Short', 'Neutral'].includes(String(bot.direction)) &&
    ['Instant', 'Below reference by 1%', 'Above reference by 1%', 'Signal confirmation'].includes(String(bot.startCondition)) &&
    ['Manual', 'Take profit / stop loss', 'Run time limit'].includes(String(bot.stopCondition)) &&
    ['Draft', 'Armed', 'Running', 'Paused', 'Stopped'].includes(String(bot.status)) &&
    [bot.investment, bot.lowerPrice, bot.upperPrice, bot.referencePrice, bot.currentPrice, bot.gridCount, bot.takeProfitPct,
      bot.stopLossPct, bot.durationHours, bot.createdAt, bot.elapsedMs, bot.gridIndex, bot.gridFills, bot.cycles,
      bot.gridProfit, bot.unpairedPnl].every((number) => typeof number === 'number' && Number.isFinite(number)) &&
    (bot.startedAt === null || (typeof bot.startedAt === 'number' && Number.isFinite(bot.startedAt))) &&
    typeof bot.stopReason === 'string';
}

function formatUsd(value: number, digits = 2) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function formatRuntime(milliseconds: number) {
  const minutes = Math.floor(Math.max(0, milliseconds) / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days) return days + 'd ' + (hours % 24) + 'h';
  return hours + 'h ' + (minutes % 60) + 'm';
}

function liveRuntime(bot: PaperBot, now: number) {
  return bot.elapsedMs + (bot.status === 'Running' && bot.startedAt ? now - bot.startedAt : 0);
}

function makeBot(draft: Draft, now: number): PaperBot {
  const lowerPrice = Number(draft.lowerPrice);
  const upperPrice = Number(draft.upperPrice);
  const referencePrice = Number(draft.referencePrice);
  const gridCount = Number(draft.gridCount);
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(now) + Math.random().toString(36).slice(2),
    name: draft.name.trim() || draft.symbol + ' ' + draft.strategy,
    strategy: draft.strategy,
    symbol: draft.symbol.trim().toUpperCase(),
    direction: draft.direction,
    investment: Number(draft.investment),
    lowerPrice,
    upperPrice,
    referencePrice,
    currentPrice: referencePrice,
    gridCount,
    takeProfitPct: Number(draft.takeProfitPct),
    stopLossPct: Number(draft.stopLossPct),
    startCondition: draft.startCondition,
    stopCondition: draft.stopCondition,
    durationHours: Number(draft.durationHours),
    status: 'Draft',
    createdAt: now,
    startedAt: null,
    elapsedMs: 0,
    gridIndex: paperGridIndex(referencePrice, lowerPrice, upperPrice, gridCount),
    gridFills: 0,
    cycles: 0,
    gridProfit: 0,
    unpairedPnl: 0,
    stopReason: '',
  };
}

export function AutonomousPage() {
  const bots = useSyncExternalStore(subscribeToBots, readSavedBots, getServerBotsSnapshot);
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const now = useSyncExternalStore(subscribeToClock, currentClockSnapshot, () => 0);
  const [feedback, setFeedback] = useState('');
  const [formError, setFormError] = useState('');
  const [markInputs, setMarkInputs] = useState<Record<string, string>>({});

  const totalInvestment = bots.reduce((sum, bot) => sum + bot.investment, 0);
  const totalPnl = bots.reduce((sum, bot) => sum + bot.gridProfit + bot.unpairedPnl, 0);
  const runningCount = bots.filter((bot) => bot.status === 'Running').length;
  const totalCycles = bots.reduce((sum, bot) => sum + bot.cycles, 0);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFormError('');
  }

  function changeBots(update: (current: PaperBot[]) => PaperBot[]) {
    try {
      updateSavedBots(update);
      return true;
    } catch {
      setFeedback('This browser could not save the paper bot. Check browser storage permissions or free space.');
      return false;
    }
  }

  function applyTemplate(index: number) {
    const template = TEMPLATES[index];
    setDraft((current) => ({ ...current, ...template, name: template.label, startCondition: 'Instant', stopCondition: 'Take profit / stop loss' }));
    setFeedback(template.label + ' loaded into the builder.');
  }

  function createBot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const investment = Number(draft.investment);
    const lower = Number(draft.lowerPrice);
    const upper = Number(draft.upperPrice);
    const reference = Number(draft.referencePrice);
    const grids = Number(draft.gridCount);
    const tp = Number(draft.takeProfitPct);
    const sl = Number(draft.stopLossPct);
    const hours = Number(draft.durationHours);
    const validationError = validatePaperBotSettings({
      symbol: draft.symbol,
      investment,
      lowerPrice: lower,
      upperPrice: upper,
      referencePrice: reference,
      gridCount: grids,
      takeProfitPct: tp,
      stopLossPct: sl,
      durationHours: hours,
    }, bots.length);
    if (validationError) return setFormError(validationError);
    const bot = makeBot(draft, Date.now());
    if (!changeBots((current) => [bot, ...current])) return;
    setMarkInputs((current) => ({ ...current, [bot.id]: String(bot.currentPrice) }));
    setDraft(DEFAULT_DRAFT);
    setFormError('');
    setFeedback(bot.name + ' added as a paper bot.');
  }

  function startBot(id: string) {
    const stamp = currentTime();
    if (!changeBots((current) => current.map((bot) => {
      if (bot.id !== id || bot.status === 'Stopped') return bot;
      if (bot.startCondition !== 'Instant') {
        return { ...bot, status: 'Armed', startedAt: null, stopReason: '' };
      }
      return { ...bot, status: 'Running', startedAt: stamp, stopReason: '' };
    }))) return;
    setFeedback('Paper run started. No exchange order was sent.');
  }

  function confirmSignal(id: string) {
    if (!changeBots((current) => current.map((bot) => bot.id === id && bot.status === 'Armed'
      ? { ...bot, status: 'Running', startedAt: currentTime(), stopReason: '' }
      : bot))) return;
    setFeedback('Signal confirmed in paper mode.');
  }

  function pauseBot(id: string) {
    const stamp = currentTime();
    if (!changeBots((current) => current.map((bot) => bot.id === id && bot.status === 'Running'
      ? { ...bot, status: 'Paused', elapsedMs: liveRuntime(bot, stamp), startedAt: null }
      : bot))) return;
    setFeedback('Paper run paused.');
  }

  function stopBot(id: string) {
    const stamp = currentTime();
    if (!changeBots((current) => current.map((bot) => bot.id === id
      ? { ...bot, status: 'Stopped', elapsedMs: liveRuntime(bot, stamp), startedAt: null, stopReason: bot.stopReason || 'Stopped manually' }
      : bot))) return;
    setFeedback('Paper bot stopped.');
  }

  function removeBot(id: string) {
    if (!changeBots((current) => current.filter((bot) => bot.id !== id))) return;
    setFeedback('Paper bot removed from this browser.');
  }

  function applyPaperPrice(bot: PaperBot) {
    const mark = Number(markInputs[bot.id] ?? bot.currentPrice);
    if (!Number.isFinite(mark) || mark <= 0) {
      setFeedback('Enter a positive paper price before applying a tick.');
      return;
    }
    const stamp = currentTime();
    if (!changeBots((current) => current.map((latest) => {
      if (latest.id !== bot.id || !['Running', 'Armed'].includes(latest.status)) return latest;
      const belowTrigger = latest.startCondition === 'Below reference by 1%' && mark <= latest.referencePrice * 0.99;
      const aboveTrigger = latest.startCondition === 'Above reference by 1%' && mark >= latest.referencePrice * 1.01;
      if (latest.status === 'Armed') {
        if (belowTrigger || aboveTrigger) return { ...latest, currentPrice: mark, gridIndex: paperGridIndex(mark, latest.lowerPrice, latest.upperPrice, latest.gridCount), status: 'Running', startedAt: stamp, stopReason: '' };
        return { ...latest, currentPrice: mark };
      }
      const { index, newFills, newCycles, gridProfit, unpairedPnl } = calculatePaperGridTick(latest, mark);
      const total = gridProfit + unpairedPnl;
      const reason = paperStopReason({
        mark,
        lowerPrice: latest.lowerPrice,
        upperPrice: latest.upperPrice,
        totalPnl: total,
        investment: latest.investment,
        takeProfitPct: latest.takeProfitPct,
        stopLossPct: latest.stopLossPct,
        stopCondition: latest.stopCondition,
        runtimeMs: liveRuntime(latest, stamp),
        durationHours: latest.durationHours,
      });
      const stopped = Boolean(reason);
      return {
        ...latest,
        currentPrice: mark,
        gridIndex: index,
        gridFills: latest.gridFills + newFills,
        cycles: latest.cycles + newCycles,
        gridProfit,
        unpairedPnl,
        status: stopped ? 'Stopped' : latest.status,
        elapsedMs: stopped ? liveRuntime(latest, stamp) : latest.elapsedMs,
        startedAt: stopped ? null : latest.startedAt,
        stopReason: reason || latest.stopReason,
      };
    }))) return;
    setFeedback('Paper mark applied. Fill and PnL figures are simulated.');
  }

  return (
    <main className="app-shell">
      <AppSidebar active="autonomous" status={runningCount ? runningCount + ' paper run' + (runningCount === 1 ? '' : 's') + ' active' : 'Paper trading only'} network="paper" />
      <section className="workspace" id="top">
        <header className="topbar">
          <div className="breadcrumb"><span>WORKSPACE</span><span className="crumb-slash">/</span><strong>AI Bot Studio</strong></div>
          <div className="topbar-right">
            <span className="studio-mode"><span /> PAPER ONLY</span>
            <WalletConnectionControl />
          </div>
        </header>

        <div className="page-content studio-page">
          <section className="studio-intro">
            <div>
              <p className="eyebrow"><Bot size={14} /> STRATEGY STUDIO <span className="studio-version">BETA</span></p>
              <h1>Build a strategy.<br /><em>Test it safely.</em></h1>
              <p className="studio-lede">Create and manage grid, momentum, and DCA bots in a paper account. Your settings stay in this browser.</p>
            </div>
            <div className="studio-live-pill"><span /> LOCAL PAPER ACCOUNT</div>
          </section>

          <div className="studio-safety-banner" role="note">
            <ShieldAlert size={19} />
            <div><strong>Simulation only — no live orders</strong><span>No exchange or AI provider is connected. Paper prices are entered manually; performance is illustrative and saved only on this device.</span></div>
            <CircleHelp size={17} />
          </div>

          <section className="studio-stats" aria-label="Paper account overview">
            <article className="studio-stat">
              <div className="studio-stat-top"><span>PAPER EQUITY</span><Wallet size={15} /></div>
              <strong>{formatUsd(totalInvestment + totalPnl)}</strong>
              <small>Allocated {formatUsd(totalInvestment)}</small>
            </article>
            <article className="studio-stat">
              <div className="studio-stat-top"><span>TOTAL PAPER P&amp;L</span><TrendingUp size={15} /></div>
              <strong className={totalPnl >= 0 ? 'studio-positive' : 'studio-negative'}>{totalPnl > 0 ? '+' : ''}{formatUsd(totalPnl, 4)}</strong>
              <small>Grid profit + unpaired P&amp;L</small>
            </article>
            <article className="studio-stat">
              <div className="studio-stat-top"><span>ACTIVE PAPER BOTS</span><Bot size={15} /></div>
              <strong>{runningCount}<small className="studio-stat-unit"> / {bots.length}</small></strong>
              <small>Running in this browser</small>
            </article>
            <article className="studio-stat">
              <div className="studio-stat-top"><span>GRID CYCLES</span><Zap size={15} /></div>
              <strong>{totalCycles}</strong>
              <small>Manually simulated</small>
            </article>
          </section>

          <div className="studio-main-grid">
            <section className="studio-panel studio-bots-panel">
              <div className="studio-panel-heading">
                <div><p className="eyebrow">YOUR STRATEGIES</p><h2>Paper bots <span className="studio-count">{bots.length}</span></h2></div>
                <span className="studio-panel-note"><span /> DATA SAVED LOCALLY</span>
              </div>

              {bots.length === 0 ? (
                <div className="studio-empty">
                  <span className="studio-empty-icon"><Sparkles size={22} /></span>
                  <strong>Your strategy desk is ready</strong>
                  <p>Create a bot from the builder or start with one of these editable templates.</p>
                  <div className="studio-templates">
                    {TEMPLATES.map((template, index) => <button key={template.label} type="button" onClick={() => applyTemplate(index)}><span><Zap size={14} /> {template.label}</span><Plus size={15} /></button>)}
                  </div>
                </div>
              ) : (
                <div className="studio-table-scroll">
                  <table className="studio-bot-table">
                    <thead><tr>
                      <th>BOT</th><th>INVESTED</th><th>TOTAL P&amp;L</th><th>GRID PROFIT</th><th>UNPAIRED P&amp;L</th><th>PRICE RANGE</th><th>GRIDS / CYCLES</th><th>RUNTIME</th><th>START / STOP</th><th>STATUS</th><th>ACTIONS</th>
                    </tr></thead>
                    <tbody>{bots.map((bot) => {
                      const pnl = bot.gridProfit + bot.unpairedPnl;
                      const percentage = bot.investment ? pnl / bot.investment * 100 : 0;
                      return <tr key={bot.id}>
                        <td><div className="studio-bot-name"><span className="studio-coin">{bot.symbol.slice(0, 1)}</span><div><strong>{bot.name}</strong><small>{bot.symbol} · {bot.strategy} · {bot.direction}</small></div></div></td>
                        <td>{formatUsd(bot.investment)}</td>
                        <td className={pnl >= 0 ? 'studio-positive' : 'studio-negative'}>{pnl > 0 ? '+' : ''}{formatUsd(pnl, 4)}<small className="studio-cell-sub">{percentage.toFixed(2)}%</small></td>
                        <td>{formatUsd(bot.gridProfit, 4)}</td>
                        <td className={bot.unpairedPnl >= 0 ? 'studio-positive' : 'studio-negative'}>{bot.unpairedPnl > 0 ? '+' : ''}{formatUsd(bot.unpairedPnl, 4)}</td>
                        <td><span className="studio-range">{bot.lowerPrice} — {bot.upperPrice}</span><small className="studio-cell-sub">Mark {bot.currentPrice}</small></td>
                        <td>{bot.gridCount}<small className="studio-cell-sub">{bot.gridFills} fills · {bot.cycles} cycles</small></td>
                        <td>{formatRuntime(liveRuntime(bot, now))}</td>
                        <td><small className="studio-cell-sub studio-condition">{bot.startCondition}</small><small className="studio-cell-sub studio-condition">{bot.stopCondition}</small></td>
                        <td><span className={'studio-status studio-status-' + bot.status.toLowerCase()}><i />{bot.status}</span>{bot.stopReason && <small className="studio-cell-sub studio-stop-reason">{bot.stopReason}</small>}</td>
                        <td><div className="studio-actions">
                          {(bot.status === 'Draft' || bot.status === 'Paused' || bot.status === 'Stopped') && bot.status !== 'Stopped' && <button type="button" className="studio-icon-action" onClick={() => startBot(bot.id)} aria-label={'Start ' + bot.name} title={bot.startCondition === 'Instant' ? 'Start paper run' : 'Arm start condition'}><Play size={15} /></button>}
                          {bot.status === 'Armed' && bot.startCondition === 'Signal confirmation' && <button type="button" className="studio-icon-action" onClick={() => confirmSignal(bot.id)} aria-label={'Confirm signal for ' + bot.name} title="Confirm signal in paper mode"><Sparkles size={15} /></button>}
                          {bot.status === 'Running' && <button type="button" className="studio-icon-action" onClick={() => pauseBot(bot.id)} aria-label={'Pause ' + bot.name} title="Pause paper run"><Pause size={15} /></button>}
                          {bot.status !== 'Stopped' && <button type="button" className="studio-icon-action studio-icon-stop" onClick={() => stopBot(bot.id)} aria-label={'Stop ' + bot.name} title="Stop bot"><X size={15} /></button>}
                          <button type="button" className="studio-icon-action studio-icon-delete" onClick={() => removeBot(bot.id)} aria-label={'Delete ' + bot.name} title="Remove bot"><Trash2 size={15} /></button>
                        </div></td>
                      </tr>;
                    })}</tbody>
                  </table>
                </div>
              )}

              {bots.length > 0 && <div className="studio-paper-tick">
                <div><strong><Zap size={14} /> Simulate a paper price tick</strong><span>Enter a mark to calculate hypothetical grid fills and P&amp;L.</span></div>
                <div className="studio-tick-list">{bots.filter((bot) => bot.status === 'Running' || bot.status === 'Armed').map((bot) => <label key={bot.id}><span>{bot.symbol}</span><input type="number" min="0.00000001" step="any" value={markInputs[bot.id] ?? String(bot.currentPrice)} onChange={(event) => setMarkInputs((current) => ({ ...current, [bot.id]: event.target.value }))} aria-label={'Paper price for ' + bot.name} /><button type="button" onClick={() => applyPaperPrice(bot)}>Apply</button></label>)}</div>
                {bots.every((bot) => bot.status !== 'Running' && bot.status !== 'Armed') && <small>Start or arm a bot to enter a paper price.</small>}
              </div>}

              <div className="studio-table-foot"><span><Info size={14} /> P&amp;L and grid fills are estimates from manual paper-price updates.</span><span>Nothing here places orders.</span></div>
            </section>

            <aside className="studio-panel studio-builder" id="create-bot">
              <div className="studio-panel-heading">
                <div><p className="eyebrow">BOT BUILDER</p><h2>Create a bot <Plus size={16} /></h2></div>
                <span className="studio-step">01 / 03</span>
              </div>
              <form className="studio-form" onSubmit={createBot}>
                <label className="studio-field"><span>Bot name <small>Optional</small></span><input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} placeholder="e.g. SOL range rider" maxLength={36} /></label>
                <div className="studio-form-row">
                  <label className="studio-field"><span>Strategy</span><select value={draft.strategy} onChange={(event) => updateDraft('strategy', event.target.value as Strategy)}><option>AI Grid</option><option>Momentum</option><option>DCA</option></select></label>
                  <label className="studio-field"><span>Market / symbol</span><input value={draft.symbol} onChange={(event) => updateDraft('symbol', event.target.value.toUpperCase())} maxLength={18} aria-label="Market symbol" /></label>
                </div>
                <div className="studio-field"><span>Direction</span><div className="studio-directions">{(['Long', 'Short', 'Neutral'] as Direction[]).map((direction) => <button type="button" key={direction} className={draft.direction === direction ? 'selected' : ''} onClick={() => updateDraft('direction', direction)}>{direction}</button>)}</div></div>
                <label className="studio-field"><span>Investment</span><div className="studio-input-unit"><span>$</span><input type="number" min="10" max="1000000" step="0.01" value={draft.investment} onChange={(event) => updateDraft('investment', event.target.value)} required /><b>USDT</b></div><small className="studio-help">Paper allocation only · min $10</small></label>

                <div className="studio-subheading"><span>GRID SETTINGS</span><i /></div>
                <div className="studio-form-row studio-form-row-three">
                  <label className="studio-field"><span>Range low</span><div className="studio-input-unit"><span>$</span><input type="number" min="0.00000001" step="any" value={draft.lowerPrice} onChange={(event) => updateDraft('lowerPrice', event.target.value)} required /></div></label>
                  <label className="studio-field"><span>Range high</span><div className="studio-input-unit"><span>$</span><input type="number" min="0.00000001" step="any" value={draft.upperPrice} onChange={(event) => updateDraft('upperPrice', event.target.value)} required /></div></label>
                  <label className="studio-field"><span>Grid qty</span><input type="number" min="2" max="100" step="1" value={draft.gridCount} onChange={(event) => updateDraft('gridCount', event.target.value)} required /></label>
                </div>
                <label className="studio-field"><span>Paper reference price</span><div className="studio-input-unit"><span>$</span><input type="number" min="0.00000001" step="any" value={draft.referencePrice} onChange={(event) => updateDraft('referencePrice', event.target.value)} required /><b>MANUAL</b></div></label>

                <div className="studio-subheading"><span>RISK &amp; CONDITIONS</span><i /></div>
                <div className="studio-form-row">
                  <label className="studio-field"><span>Take profit</span><div className="studio-input-unit"><input type="number" min="0.1" max="100" step="0.1" value={draft.takeProfitPct} onChange={(event) => updateDraft('takeProfitPct', event.target.value)} required /><b>%</b></div></label>
                  <label className="studio-field"><span>Stop loss</span><div className="studio-input-unit"><input type="number" min="0.1" max="100" step="0.1" value={draft.stopLossPct} onChange={(event) => updateDraft('stopLossPct', event.target.value)} required /><b>%</b></div></label>
                </div>
                <div className="studio-form-row">
                  <label className="studio-field"><span>Start condition</span><select value={draft.startCondition} onChange={(event) => updateDraft('startCondition', event.target.value as StartCondition)}><option>Instant</option><option>Below reference by 1%</option><option>Above reference by 1%</option><option>Signal confirmation</option></select></label>
                  <label className="studio-field"><span>Stop condition</span><select value={draft.stopCondition} onChange={(event) => updateDraft('stopCondition', event.target.value as StopCondition)}><option>Manual</option><option>Take profit / stop loss</option><option>Run time limit</option></select></label>
                </div>
                {draft.stopCondition === 'Run time limit' && <label className="studio-field"><span>Maximum runtime</span><div className="studio-input-unit"><input type="number" min="1" max="720" step="1" value={draft.durationHours} onChange={(event) => updateDraft('durationHours', event.target.value)} /><b>HOURS</b></div></label>}

                <div className="studio-risk-note"><ShieldCheck size={15} /><span>Fixed 1× paper exposure. No wallet signing, leverage, exchange API keys, or live trading.</span></div>
                {formError && <p className="studio-form-error" role="alert">{formError}</p>}
                <button className="studio-create-button" type="submit"><Plus size={16} /> Create paper bot</button>
                <p className="studio-form-caption"><Sparkles size={12} /> Strategy presets are rule templates; no AI model is connected.</p>
              </form>
            </aside>
          </div>

          <section className="studio-disclosure">
            <div><ShieldAlert size={17} /><strong>Paper mode is not a prediction of live results.</strong></div>
            <p>Price updates are entered by you and saved in this browser. Simulated fills omit fees, slippage, funding, liquidity, and exchange rules. Shorts and grid profit are hypothetical. Never use these figures as a return guarantee.</p>
          </section>

          <footer className="footer">
            <span>WELP UP · AI Bot Studio</span><span>Local paper trading · Fixed 1× exposure</span><a href="/terms">Terms &amp; Conditions</a><a href="https://github.com/Alitiora-Initiative/WELP-UP" target="_blank" rel="noreferrer">Source</a>
          </footer>
        </div>
        <div className="studio-feedback" aria-live="polite">{feedback}</div>
      </section>
    </main>
  );
}
