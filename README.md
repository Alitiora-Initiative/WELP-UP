# WELP UP!

Self-learning Solana agent from [Alitiora Initiative](https://github.com/Alitiora-Initiative). It buys and sells memecoins and tokenized stocks with **real Jupiter swaps**. There is no paper broker in this repository.

It is not Space Ledger and it is not MIRA. It is not an investment product. Read [LIMITS.md](LIMITS.md) before you arm it.

## Browser frontend

The web app connects to a browser wallet through Wallet Standard (including Phantom) and never asks for a seed phrase or private key. It discovers live Solana pool signals, applies the 80–98 entry window, and requires the connected wallet to sign every Jupiter swap. Google-created Phantom wallets work through Phantom's normal connect and approval flow; there is no need to export a key.

```bash
npm install
npm run dev
```

Optional environment settings for the web app are `NEXT_PUBLIC_SOLANA_RPC_URL` (public mainnet RPC URL) and `JUPITER_API_KEY` (server-only; never prefix this with `NEXT_PUBLIC_`). The app works without a Jupiter key subject to Jupiter's keyless rate limits.

**The Python command-line runner below is a separate legacy path and still reads `SOLANA_PRIVATE_KEY` to sign on the machine running it. It does not connect to Phantom.** Do not put a Phantom secret or Google-auth wallet secret into that runner. Use the browser frontend for wallet-connected approvals.

## Rules that are not configurable downward

| Rule | Value |
| --- | --- |
| Minimum trade | 0.001 SOL |
| Minimum account equity | $0.50 |
| Entry window | analysis score 80 through 98, inclusive |
| Above 98 | skip. A perfect score is not a buy. |

You can raise the size floor or the equity floor. You cannot lower them.

## What it reads, and what it sends

- **Charts.** GeckoTerminal 5-minute USD candles plus pool liquidity, age, volume, and buy/sell counts. Indicators: EMA 9/21, RSI 14, higher-high / higher-low, volume expansion.
- **Routing.** Jupiter Swap v2 `GET https://api.jup.ag/swap/v2/order`.
- **Execution.** The order is signed locally and submitted to `POST https://api.jup.ag/swap/v2/execute`. The fill is the change in the wallet's SOL and token balance after the signature confirms. Quotes are not fills.
- **Marks.** Jupiter price v3 (`lite-api.jup.ag/price/v3`).
- **Tokenized stocks.** Symbols such as `TSLAx` and `AAPLx` are resolved through Jupiter token search and kept only when the name is an xStock or other tokenized-stock listing. Mints are cached in `data/stocks.json` after the first successful lookup.
- **Memecoins.** Solana trending pools quoted in SOL or a stablecoin, with at least $12k of pool liquidity and 30 candles of history.

## Learning

`data/brain.json` is a logistic model. Weights start at zero. They move only when a position this process opened is sold, the sell confirms, and the SOL balance change is known. A close counts as a positive label only above +0.5% after fees. Until 8 confirmed closes, the learned probability can shift the rule score by at most 12%. It never adds a simulated history.

## Run

Use a dedicated wallet. Anything already in that wallet can block an exit if the balance does not match the ledger.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# set SOLANA_PRIVATE_KEY and WELP_ARM=TRADE-LIVE
python -m welp universe   # real pools and xStock names, no orders
python -m welp status     # ledger, brain, equity
python -m welp once       # one live cycle
python -m welp run        # loop
```

`WELP_ARM` must be exactly `TRADE-LIVE`. A public RPC often fails to land a swap. Point `SOLANA_RPC_URL` at a mainnet endpoint you control. `JUPITER_API_KEY` is optional; keyless Jupiter is rate-limited, so the agent only asks Jupiter for a route after the chart screen passes.

The private key is an environment variable. It is not written to the ledger or the log. Do not delete `data/` while a position is open. The agent will forget a real bag.

## Tests

```bash
python -m unittest discover -s tests -v
```

The tests check the band, the size floor, the indicators, and the learner. They do not send transactions and they do not invent fills.

## Not built

No interface, no multi-wallet, no adoption of bags the agent did not buy, no leverage, no CEX, no backtest report, no claim that the score is a probability of profit.
