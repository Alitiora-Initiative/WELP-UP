# WELP UP! written limits

This file is the contract. If the code and this file disagree, this file wins and the code is wrong.

## What it will do

- Send real Solana transactions through Jupiter Swap v2 (`GET /swap/v2/order`, `POST /swap/v2/execute`) on mainnet.
- Read real charts from GeckoTerminal OHLCV (5-minute USD candles) and real pool stats.
- Mark SOL and tokens with the Jupiter price API.
- Buy memecoins and tokenized stocks (xStock names resolved from Jupiter's token search) only when the final analysis score is inside **80 through 98 inclusive**.
- Size every entry at least **0.001 SOL**, and only if account equity is at least **$0.50**.
- Update its weights only after a confirmed round trip, using the SOL balance change on the wallet (fees included).

## What it will not do

- No paper broker, no dry-run, no backtest, no simulated fills, no replayed candles as trades.
- No trade when the score is under 80.
- No trade when the score is over 98. A perfect 99 or 100 is a skip, not a stronger buy.
- No trade smaller than 0.001 SOL. The floor cannot be lowered by an environment variable.
- No new entry when equity is under $0.50. That floor cannot be lowered either.
- No shorts, no leverage, no perpetual markets, no CEX orders.
- No MEV bundles, no private mempool, no sandwiching.
- No second wallet, no copy-trading, no social posting.
- No learning from quotes that were not filled. A failed or unconfirmed swap does not teach the model.
- No management of tokens it did not itself buy. A dedicated wallet is required.
- No promise of profit. A 0.001 SOL memecoin trade can go to zero.

## Money rules

| Rule | Value |
| --- | --- |
| Minimum entry | 0.001 SOL |
| Minimum equity to open | 0.50 USD |
| Confidence window | 80 to 98 inclusive |
| Fee reserve left in SOL | 0.003 SOL (tighten only upward) |
| Default max one entry | 0.02 SOL |
| Default open positions | 2 |
| Meme stop | -8% SOL |
| Stock stop | -5% SOL |
| Meme take-profit | +15% SOL, or trail after +8% |
| Stock take-profit | +8% SOL, or trail after +4% |
| Meme max hold | 6 hours |
| Stock max hold | 48 hours |

Exits are risk cuts. They do not have to sit inside 80–98. Entries do.

## Learning limits

- The model starts untrained. Early scores are the strict rule score.
- After 8 confirmed closes, the learned probability may move the score by up to 45%.
- A close is a win for the label only when SOL gained more than 0.5% after fees. That does not make the next trade safe.
- Weights live in `data/brain.json` on the machine that runs the agent. They are not in git.
- Deleting `data/` while a position is open makes the agent forget a real bag. Do not do that.

## Operating limits

- `WELP_ARM` must equal `TRADE-LIVE`. Anything else and the process exits before it talks to Jupiter execute.
- The private key is read from the environment. It is never written to the ledger, the log, or the repo.
- Public RPC endpoints drop transactions. A failed landing is a failed trade, not a retry storm.
- Jupiter keyless quota is small. The agent quotes only names that already passed the chart screen.
- This is not Space Ledger and not MIRA. It is not an investment product of Alitiora Initiative.
