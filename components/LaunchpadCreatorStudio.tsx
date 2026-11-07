'use client';

import { useMemo, useState } from 'react';
import {
  calculateCreatorFeeRoute,
  formatBaseUnits,
  SUPPORTED_TOKEN_DECIMALS,
  validateLaunchSupply,
  type SupportedTokenDecimals,
} from '@/lib/launchpad-config';

const ONE_SOL_LAMPORTS = 1_000_000_000n;

function formatRate(basisPoints: number): string {
  return (basisPoints / 100).toFixed(2) + '%';
}

export function LaunchpadCreatorStudio() {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [supply, setSupply] = useState('');
  const [decimals, setDecimals] = useState<SupportedTokenDecimals | null>(null);
  const [creatorFeeBps, setCreatorFeeBps] = useState(0);

  const validation = useMemo(
    () => validateLaunchSupply(supply, decimals),
    [supply, decimals],
  );
  const feePreview = useMemo(
    () => calculateCreatorFeeRoute(ONE_SOL_LAMPORTS, creatorFeeBps),
    [creatorFeeBps],
  );
  const nameValid = name.trim().length >= 1 && name.trim().length <= 32;
  const symbolValid = /^[A-Za-z0-9]{1,10}$/.test(symbol.trim());
  const readyForFutureProgram = validation.ok && nameValid && symbolValid;

  return (
    <section className="lp-studio glass-panel" aria-labelledby="lp-studio-title">
      <div className="lp-studio-heading">
        <div>
          <p className="lp-kicker">CREATOR STUDIO / CONFIGURATION PREVIEW</p>
          <h2 id="lp-studio-title">Engineer your token.</h2>
          <p className="lp-muted">
            Choose your own supply, fraction precision and creator-fee rate.
            200,000,000 tokens is one example, not a fixed platform limit.
          </p>
        </div>
        <span className="lp-lock-state">PROGRAM NOT ENABLED</span>
      </div>

      <div className="lp-form-grid">
        <label className="lp-field">
          <span>Token name</span>
          <input
            autoComplete="off"
            maxLength={32}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Welp Coin"
            value={name}
          />
          <small>1–32 characters.</small>
        </label>

        <label className="lp-field">
          <span>Ticker</span>
          <input
            autoComplete="off"
            maxLength={10}
            onChange={(event) => setSymbol(event.target.value.toUpperCase())}
            placeholder="e.g. WELP"
            value={symbol}
          />
          <small>1–10 letters or numbers.</small>
        </label>

        <label className="lp-field lp-supply-field">
          <span>Total supply <b>WHOLE TOKENS</b></span>
          <input
            inputMode="numeric"
            maxLength={10}
            onChange={(event) => setSupply(event.target.value)}
            placeholder="Enter 0 to 1,000,000,000"
            value={supply}
          />
          <small>
            Creator setting: 0 to 1,000,000,000 whole tokens. Zero is preview-only
            and cannot become a tradable launch.
          </small>
        </label>

        <fieldset className="lp-decimals-field">
          <legend>Fraction precision (0–9 decimals)</legend>
          <div className="lp-decimals-options">
            {SUPPORTED_TOKEN_DECIMALS.map((value) => (
              <button
                aria-pressed={decimals === value}
                className={decimals === value ? 'lp-decimal-option is-selected' : 'lp-decimal-option'}
                key={value}
                onClick={() => setDecimals(value)}
                type="button"
              >
                <strong>{value}</strong>
                <small>{value === 0 ? 'Whole units' : 'Decimal places'}</small>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="lp-fee-field">
          <div className="lp-fee-heading">
            <label htmlFor="lp-creator-fee">Creator trading fee</label>
            <strong>{formatRate(creatorFeeBps)}</strong>
          </div>
          <input
            id="lp-creator-fee"
            className="lp-range-input"
            max={300}
            min={0}
            onChange={(event) => setCreatorFeeBps(Number(event.target.value))}
            step={1}
            type="range"
            value={creatorFeeBps}
          />
          <div className="lp-range-labels">
            <span>0.00%</span>
            <span>1.50%</span>
            <span>3.00% maximum</span>
          </div>
          <small className="lp-muted">
            This is the creator fee on eligible WELP-routed swap volume. The
            treasury receives 0.5% of the resulting creator-fee amount; the
            remainder is the creator reward. It is not an additional 0.5% of
            gross trade volume.
          </small>
        </div>
      </div>

      <div className="lp-preview glass-card" aria-live="polite">
        <div className="lp-preview-top">
          <div>
            <span className="lp-kicker">ON-CHAIN CONFIGURATION PREVIEW</span>
            <strong>
              {readyForFutureProgram ? name.trim() + ' (' + symbol.trim() + ')' : 'Configuration summary'}
            </strong>
          </div>
          <span className="lp-preview-badge">NOT A DEPLOYED TOKEN</span>
        </div>

        {!supply.trim() || decimals === null ? (
          <p className="lp-preview-instruction">
            Enter a whole-token supply and choose decimal precision to calculate
            the raw mint amount and launch-specific 5% wallet cap.
          </p>
        ) : validation.ok ? (
          <div className="lp-metric-grid">
            <div className="lp-metric">
              <span>Maximum supply</span>
              <strong>{validation.wholeSupply.toLocaleString('en-US')}</strong>
              <small>whole tokens</small>
            </div>
            <div className="lp-metric">
              <span>Mint decimals</span>
              <strong>{validation.decimals}</strong>
              <small>fixed at mint creation</small>
            </div>
            <div className="lp-metric">
              <span>Raw mint supply</span>
              <strong>{validation.maxSupplyBaseUnits.toString()}</strong>
              <small>base units</small>
            </div>
            <div className="lp-metric">
              <span>Early-window wallet cap</span>
              <strong>{validation.earlyWalletLimitWholeTokens}</strong>
              <small>whole-token equivalent (5%)</small>
            </div>
          </div>
        ) : (
          <p className="lp-validation-message">{validation.error}</p>
        )}

        {validation.ok && !validation.launchable && (
          <p className="lp-warning">
            Zero supply is available as a configuration preview, but it cannot
            create a tradable launch, accept purchases or graduate to a pool.
            Set a positive supply to launch.
          </p>
        )}

        {validation.ok && validation.launchable && validation.earlyWindowPurchasesBlockedByGranularity && (
          <p className="lp-warning">
            With this zero-decimal supply, 5% is less than one indivisible token.
            The on-chain early-window rule must reject purchases during that
            window rather than round the cap above 5%.
          </p>
        )}

        {validation.ok && (
          <p className="lp-raw-note">
            5% cap in raw units: {formatBaseUnits(validation.earlyWalletLimitBaseUnits, validation.decimals)}
            {' '}· Total supply is user-selected per launch.
          </p>
        )}

        <div className="lp-fee-breakdown">
          <p className="lp-kicker">CREATOR FEE EXAMPLE / 1.00 SOL ELIGIBLE VOLUME</p>
          <div className="lp-fee-breakdown-grid">
            <div>
              <span>Creator fee ({formatRate(creatorFeeBps)})</span>
              <strong>{formatBaseUnits(feePreview.creatorFeeLamports, 9)} SOL</strong>
            </div>
            <div>
              <span>Treasury share (0.5% of fee)</span>
              <strong>{formatBaseUnits(feePreview.treasuryShareLamports, 9)} SOL</strong>
            </div>
            <div>
              <span>Creator reward</span>
              <strong>{formatBaseUnits(feePreview.creatorRewardLamports, 9)} SOL</strong>
            </div>
          </div>
          <p className="lp-raw-note">
            This is a math preview, not a collected fee. The current on-chain
            treasury helper is not yet connected to the launch buy/sell or
            Raydium creator-fee collection path.
          </p>
        </div>
      </div>

      <div className="lp-studio-footer">
        <p>
          The fixed WELP policy fee remains separate: $0.50 USDC for launch
          creation and $0.10 USDC per supported trade/transfer. The creator fee
          slider does not replace or silently modify that policy. No fee is
          collected by this preview.
        </p>
        <button className="btn-cool-green lp-create-disabled" disabled type="button">
          Token creation unavailable until audited deployment
        </button>
      </div>

      {(name.length > 0 && !nameValid) || (symbol.length > 0 && !symbolValid) ? (
        <p className="lp-validation-message">
          Check the token name (max 32 characters) and ticker (1–10 letters or numbers).
        </p>
      ) : null}
    </section>
  );
}
