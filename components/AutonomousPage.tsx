'use client';

import { useState } from 'react';
import { Activity, ArrowDownUp, Bot, ChevronRight, CircleHelp, ExternalLink, LoaderCircle, Play, Pause, Settings, ShieldCheck, TrendingUp, Wallet, Zap } from 'lucide-react';
import { useConnectedWallet, WalletReadyGate } from '@solana/kit-plugin-wallet/react';
import { client } from '@/components/Providers';
import { AppSidebar } from '@/components/AppSidebar';
import { WalletConnect } from '@/components/WalletConnect';

type StrategyConfig = {
  name: string;
  description: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  minAllocation: number;
  maxAllocation: number;
  maxPositionSize: number;
  enabled: boolean;
};

type BotStatus = {
  running: boolean;
  uptime: string;
  tradesExecuted: number;
  totalProfit: number;
  activePositions: number;
};

const STRATEGIES: StrategyConfig[] = [
  {
    name: 'Momentum Hunter',
    description: 'Identifies tokens with strong upward momentum and enters during pullbacks',
    riskLevel: 'Medium',
    minAllocation: 0.1,
    maxAllocation: 1.0,
    maxPositionSize: 0.02,
    enabled: false,
  },
  {
    name: 'Liquidity Sniper',
    description: 'Targets newly launched tokens with increasing liquidity and volume',
    riskLevel: 'High',
    minAllocation: 0.05,
    maxAllocation: 0.5,
    maxPositionSize: 0.015,
    enabled: false,
  },
  {
    name: 'Conservative Builder',
    description: 'Slow accumulation of established tokens with strong fundamentals',
    riskLevel: 'Low',
    minAllocation: 0.5,
    maxAllocation: 2.0,
    maxPositionSize: 0.02,
    enabled: false,
  },
];

export function AutonomousPage() {
  const connected = useConnectedWallet(client);
  const [botStatus, setBotStatus] = useState<BotStatus>({
    running: false,
    uptime: '0h 0m',
    tradesExecuted: 0,
    totalProfit: 0,
    activePositions: 0,
  });
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyConfig | null>(null);
  const [allocation, setAllocation] = useState('0.1');
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const walletAddress = connected?.account.address ?? '';

  const toggleBot = async () => {
    // Gate 3+: mainnet autonomous trading stays disabled until vault
    // program is on-chain with caps, audit, and consent (see ROADMAP.md).
    return;
  };

  const enableStrategy = (strategy: StrategyConfig) => {
    setSelectedStrategy(strategy);
  };

  const riskColor = (level: string) => {
    switch (level) {
      case 'Low': return 'risk-low';
      case 'Medium': return 'risk-medium';
      case 'High': return 'risk-high';
      default: return '';
    }
  };

  return (
    <main className="app-shell">
      <AppSidebar active="autonomous" status={botStatus.running ? 'Bot running' : 'Bot stopped'} />

      <section className="workspace" id="top">
        <header className="topbar">
          <div className="breadcrumb"><span>WORKSPACE</span><span className="crumb-slash">/</span><strong>Autonomous Trading</strong></div>
          <div className="topbar-right">
            <span className={`market-open ${botStatus.running ? 'active' : ''}`}>
              <span className={`market-pip ${botStatus.running ? 'pulse' : ''}`} />
              {botStatus.running ? 'BOT ACTIVE' : 'BOT PAUSED'}
            </span>
            <WalletReadyGate client={client} fallback={<button className="connect-button" disabled><LoaderCircle className="spin" size={16} /> Finding wallet…</button>}>
              <WalletConnect />
            </WalletReadyGate>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow"><Bot size={14} /> AUTONOMOUS AI TRADING · COMING SOON</p>
              <h1>AI-Powered <em>Strategy.</em></h1>
              <p className="welcome-copy">Configure autonomous trading strategies inspired by Kucoin's advanced trading bots. The AI will analyze markets, execute trades, and manage positions within your safety limits.</p>
            </div>
            <div className="date-pill"><span className="date-dot" /> DEVNET · TESTING PHASE</div>
          </section>

          <div className="mainnet-banner" role="note">
            <ShieldCheck size={19} />
            <div><strong>Vault-based trading architecture</strong><span>Autonomous trading requires a separate vault with on-chain limits. Your wallet key never leaves your device.</span></div>
            <a href="/terms" target="_blank" rel="noreferrer" aria-label="Read terms and vault architecture"><CircleHelp size={17} /></a>
          </div>

          {/* Bot Status Overview */}
          <section className="stats-grid" aria-label="Bot status overview">
            <article className="stat-card">
              <div className="stat-top"><span>BOT STATUS</span><Bot size={16} /></div>
              <div className="stat-value">{botStatus.running ? 'Running' : 'Stopped'}</div>
              <div className="stat-foot">{botStatus.running ? `Uptime: ${botStatus.uptime}` : 'Ready to start'}</div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span>TRADES EXECUTED</span><Activity size={16} /></div>
              <div className="stat-value">{botStatus.tradesExecuted}</div>
              <div className="stat-foot">Since bot start</div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span>TOTAL PROFIT/LOSS</span><TrendingUp size={16} /></div>
              <div className={`stat-value ${botStatus.totalProfit >= 0 ? 'positive' : 'negative'}`}>
                {botStatus.totalProfit >= 0 ? '+' : ''}{botStatus.totalProfit.toFixed(2)}%
              </div>
              <div className="stat-foot">All-time performance</div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span>ACTIVE POSITIONS</span><Wallet size={16} /></div>
              <div className="stat-value">{botStatus.activePositions}</div>
              <div className="stat-foot">Currently held</div>
            </article>
          </section>

          <div className="content-grid">
            {/* Strategy Selection */}
            <section className="panel" id="strategies">
              <div className="panel-heading">
                <div><p className="eyebrow">TRADING STRATEGIES</p><h2>Choose your AI <span className="heading-live" /></h2></div>
                <div className="strategy-count">{STRATEGIES.length} available</div>
              </div>

              {!walletAddress ? (
                <div className="empty-state">
                  <div className="empty-icon"><Wallet size={20} /></div>
                  <strong>Connect wallet to configure strategies</strong>
                  <p>The autonomous bot requires a connected wallet to create a vault and manage trades.</p>
                </div>
              ) : (
                <div className="strategy-list">
                  {STRATEGIES.map((strategy, index) => (
                    <article
                      key={strategy.name}
                      className={`strategy-card ${selectedStrategy?.name === strategy.name ? 'selected' : ''}`}
                      onClick={() => enableStrategy(strategy)}
                    >
                      <div className="strategy-header">
                        <div className="strategy-icon">
                          <Zap size={20} />
                        </div>
                        <div className="strategy-info">
                          <strong>{strategy.name}</strong>
                          <span className={`risk-badge ${riskColor(strategy.riskLevel)}`}>{strategy.riskLevel} Risk</span>
                        </div>
                        <ChevronRight size={18} className="strategy-arrow" />
                      </div>
                      <p className="strategy-description">{strategy.description}</p>
                      <div className="strategy-metrics">
                        <div className="metric">
                          <span className="metric-label">Min Allocation</span>
                          <span className="metric-value">{strategy.minAllocation} SOL</span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Max Position</span>
                          <span className="metric-value">{strategy.maxPositionSize} SOL</span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Max Allocation</span>
                          <span className="metric-value">{strategy.maxAllocation} SOL</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <div className="panel-foot">
                <span><span className="foot-pip" /> AI-powered analysis · On-chain vault execution</span>
                <span>Review each strategy before activation</span>
              </div>
            </section>

            {/* Bot Configuration */}
            <section className="panel" id="configuration">
              <div className="panel-heading">
                <div><p className="eyebrow">BOT CONFIGURATION</p><h2>Settings <Settings size={17} /></h2></div>
              </div>

              {!selectedStrategy ? (
                <div className="empty-state">
                  <div className="empty-icon"><Settings size={20} /></div>
                  <strong>Select a strategy first</strong>
                  <p>Choose a trading strategy from the list to configure its parameters.</p>
                </div>
              ) : (
                <div className="config-content">
                  <div className="selected-strategy-header">
                    <div className="strategy-icon large">
                      <Zap size={24} />
                    </div>
                    <div>
                      <h3>{selectedStrategy.name}</h3>
                      <p>{selectedStrategy.description}</p>
                    </div>
                  </div>

                  <div className="config-section">
                    <label className="config-label">
                      <span>SOL Allocation</span>
                      <span className="config-hint">
                        Amount to fund the vault (min {selectedStrategy.minAllocation} - max {selectedStrategy.maxAllocation} SOL)
                      </span>
                    </label>
                    <div className="allocation-input">
                      <input
                        type="number"
                        min={selectedStrategy.minAllocation}
                        max={selectedStrategy.maxAllocation}
                        step="0.01"
                        value={allocation}
                        onChange={(e) => setAllocation(e.target.value)}
                        aria-label="SOL allocation amount"
                      />
                      <span className="allocation-unit">SOL</span>
                    </div>
                  </div>

                  <div className="config-section">
                    <label className="config-label">
                      <span>Max Position Size</span>
                      <span className="config-hint">Maximum per-trade limit</span>
                    </label>
                    <div className="config-value">{selectedStrategy.maxPositionSize} SOL</div>
                  </div>

                  <div className="config-section">
                    <label className="config-label">
                      <span>Risk Level</span>
                      <span className="config-hint">Strategy risk profile</span>
                    </label>
                    <span className={`risk-badge ${riskColor(selectedStrategy.riskLevel)} large`}>
                      {selectedStrategy.riskLevel}
                    </span>
                  </div>

                  <div className="safety-note">
                    <ShieldCheck size={16} />
                    <div>
                      <strong>Vault-based execution</strong>
                      <span>Your allocation will be transferred to a separate vault with on-chain limits. The bot can only trade within those limits.</span>
                    </div>
                  </div>

                  <button
                    className="primary-button"
                    disabled
                    title="Vault program not deployed. See ROADMAP gates 3–7."
                  >
                    <Play size={16} /> Start (available after vault gates)
                  </button>

                  <p className="config-caption">
                    <ShieldCheck size={13} /> Autonomous trading is UI-only until the on-chain vault is audited and enabled. No funds move from this page.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* Implementation Status */}
          <section className="safety-panel" id="status">
            <div className="safety-heading">
              <span className="safety-icon"><CircleHelp size={18} /></span>
              <div>
                <p className="eyebrow">IMPLEMENTATION STATUS</p>
                <h2>Roadmap to Autonomous Trading</h2>
              </div>
            </div>
            <div className="safety-rule">
              <strong>Phase 1</strong>
              <span>Vault architecture design<br /><small>Define on-chain authority and smart contract structure</small></span>
            </div>
            <div className="safety-rule">
              <strong>Phase 2</strong>
              <span>Devnet testing<br /><small>Implement vault, test all limits, and verify withdrawals</small></span>
            </div>
            <div className="safety-rule">
              <strong>Phase 3</strong>
              <span>Security audit<br /><small>Independent review of vault program and permissions</small></span>
            </div>
            <div className="safety-rule safety-rule-last">
              <strong>Phase 4</strong>
              <span>Mainnet launch<br /><small>After audit, legal review, and user consent</small></span>
            </div>
          </section>

          <footer className="footer">
            <span>WELP UP · Autonomous Trading</span>
            <span>Inspired by Kucoin strategy trading · Vault-based execution</span>
            <a href="/terms">Terms & Conditions</a>
            <a href="https://github.com/Alitiora-Initiative/WELP-UP" target="_blank" rel="noreferrer">Source <ExternalLink size={12} /></a>
          </footer>
        </div>
      </section>
    </main>
  );
}
