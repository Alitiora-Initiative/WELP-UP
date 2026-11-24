# WELP UP — Global Markets Terminal

A separate terminal-first market research and internal paper-trading service for US-listed stocks/ETFs and crypto spot markets. It does not modify the existing WELP UP Solana wallet signing or swap modules.

## Provider policy

- Crypto spot quotes and OHLCV candles: public OKX market-data API; no API key is required for the public endpoints.
- US stocks and ETFs: Yahoo Finance through yfinance. This is an unofficial research adapter, may be delayed or incomplete, and is not an execution-grade licensed feed.
- News: GDELT article discovery is the no-key fallback. Marketaux can be enabled with a token. Reddit OAuth is optional and remains disabled until an approved API application is configured.
- The application stores article headlines, source metadata and links, not copied full articles.
- No artificial/sample prices are used in the production feed path. A provider failure is displayed as UNAVAILABLE; new paper entries are rejected if price data is stale or missing.

## Paper portfolio guardrails

- Initial virtual equity: $10.00.
- Cash reserve: $6.00; maximum aggregate exposure: $4.00.
- Per-position cap: $2.00; maximum two concurrent positions.
- Planned stop distance: 2.5%, with at most $0.05 risk per entry; take-profit reference: 5%.
- Maximum two new entries per UTC day and six per UTC week.
- A persistent kill switch engages at a 20% decline from initial equity or the portfolio high-water mark.
- If the kill switch activates, the engine attempts to close positions only using fresh provider quotes. When no fresh quote is available, the position remains marked for liquidation pending; no fictional exit price is generated.
- Autonomous entries are OFF by default and require both the CLI flag --auto-paper and WELP_AUTO_PAPER=true in the local .env file.

The $6 reserve and drawdown lock are risk controls, not guarantees. Gaps, network outages, fees, trading halts and slippage can still produce losses beyond a stop price.

## Simulated, not connected

The $10 book is a local SQLite ledger, not an Alpaca or OKX account. Paper fills apply conservative estimated fees and slippage to the latest reference quote. They are simulated fills, not exchange executions. Paper short P&L does not model borrow fees, recalls, locate availability or margin rules. Options are research-only; no option orders are supported. No live broker or exchange orders are implemented in this version.

## Install and launch

Windows PowerShell:

    py -3 -m venv .venv
    .venv\Scripts\Activate.ps1
    python -m pip install --upgrade pip
    pip install -r market_terminal\requirements.txt
    Copy-Item market_terminal\.env.example .env
    python -m market_terminal status
    python -m market_terminal dashboard --interval 30

Or double-click run-market-terminal.bat from the repository root.

Linux/macOS:

    python3 -m venv .venv
    . .venv/bin/activate
    python -m pip install --upgrade pip
    pip install -r market_terminal/requirements.txt
    cp market_terminal/.env.example .env
    python -m market_terminal status
    python -m market_terminal dashboard --interval 30

## Terminal commands

    python -m market_terminal scan
    python -m market_terminal quote NVDA
    python -m market_terminal quote BTC-USDT
    python -m market_terminal chart NVDA --limit 60
    python -m market_terminal research NVDA
    python -m market_terminal options NVDA
    python -m market_terminal news "NVIDIA OR semiconductor earnings"
    python -m market_terminal news --reddit
    python -m market_terminal buy BTC-USDT 1.00
    python -m market_terminal short NVDA 1.00
    python -m market_terminal close BTC-USDT
    python -m market_terminal watch --interval 60

## Research coverage

Yahoo Finance research includes company profile and selected valuation, profitability, growth, leverage, annual/quarterly financial statements, dividends, splits, analyst/holder/insider/earnings datasets where the provider returns them, headlines and options chains. Technical screening uses EMA(12/26), RSI(14) and momentum with transparent deterministic rules. News discovery uses GDELT or optional Marketaux. The Reddit connector is a read-only OAuth path and requires API approval. TradingView links are provided for manual charts; the terminal fetches its own data.

The rule scorer is not a language model, does not forecast profits and does not control risk policy. This build should be treated as a research and paper-test baseline, not as a trading recommendation.

## Persistence and operations

SQLite WAL persists quotes, candles, headline links, signals, positions, trades, risk decisions and equity snapshots under ~/.welp-market-terminal/market_terminal.sqlite3 by default. Keep the database on persistent storage and back it up before upgrades. For continuous monitoring, use the systemd template in deploy/welp-market-terminal.service on a Linux VPS; adjust the service account and paths. Keep Vercel/Netlify for the public website rather than running the continuous polling loop as a serverless function.

## Before any live execution

This version has no live trading switch. A future broker adapter must add provider order-state reconciliation, country eligibility/KYC review, data licensing checks, a fully separate live-risk profile, extensive paper/live parity tests and an independent security audit. No API credentials or wallet keys are needed for the local simulator.

Not investment advice. Stocks, crypto, shorts and options can lose money; simulated results are not evidence of live performance.
