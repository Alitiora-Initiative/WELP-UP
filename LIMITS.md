# Current web application limits

This document describes the browser app as it is implemented today. It is not an authorization for unattended trading.

## Market analysis

- The web scanner evaluates a limited set of trending Solana pools with available chart history and liquidity.
- Current analysis is deterministic and rule-based. It scores candidates; it does not use an autonomous AI model to submit orders.
- A signal is eligible only for scores from 80 through 98 inclusive. A score does not measure the probability of profit.
- Data providers, price marks, charts, quotes, token names, and liquidity figures can be incomplete, delayed, manipulated, or unavailable.

## Manual swaps

| Control | Current value |
| --- | ---: |
| Buy input default | 0.001 SOL |
| Minimum buy | 0.001 SOL |
| Maximum buy | 0.02 SOL |
| Minimum estimated wallet equity to quote | $0.50 |
| SOL fee reserve check | 0.003 SOL |
| Maximum quoted buy price impact | 2.5% |
| Quote freshness window | 45 seconds |
| Entry signal score | 80–98 inclusive |

The buy amount is editable between the enforced minimum and maximum. Quotes are estimates. The wallet user must review and sign each transaction. The current app does not make unattended purchases, monitor open positions, or execute take-profit and stop-loss orders.

## Wallet and user history

- The web interface connects through the wallet's supported signing flow and never requests the user's private key or seed phrase.
- Profile transaction history reads signatures for the connected public address from Solana RPC, in selectable pages of 10, 25, 50, or 100.
- Portfolio snapshots and displayed strategy events are stored locally in the current browser, keyed by public wallet address. They are not synchronized and are not a complete ledger.
- Public wallet addresses and on-chain transactions are visible on Solana.

## Planned vault requirements

These controls are user-approved design goals only. The vault is not implemented or available:

- The user chooses and explicitly confirms the SOL allocation.
- The vault is isolated and funded by the user; the agent never receives the user's wallet private key.
- The user sets a total funding cap; a verified on-chain program enforces it.
- Maximum position size is 0.02 SOL unless the user later explicitly chooses a lower limit.
- The user can stop or revoke the agent's authority and withdraw available vault assets to their wallet at any time.
- AI market analysis, entry selection, trade execution, position monitoring, and take-profit/exit logic operate only under those enforced limits.
- The deployed program and executor receive independent security review, published addresses and audit details, explicit user consent, and tested revocation/withdrawal paths before real funds are enabled.

An interface setting by itself is not a secure on-chain limit. A withdrawal may require closing an open token position or withdrawing that token as-is; network congestion and liquidity can affect conversion and timing. The final implementation must describe this accurately before activation.

## Separate legacy runner

The Python CLI under `welp/` is a separate legacy path, not the browser product. It can read `SOLANA_PRIVATE_KEY` locally and is not covered by the browser wallet-signing statements above. See the README before running it.
