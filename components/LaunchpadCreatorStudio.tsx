
'use client';

import { useMemo, useState } from 'react';
import {
  formatBaseUnits,
  SUPPORTED_TOKEN_DECIMALS,
  validateLaunchSupply,
  type SupportedTokenDecimals,
} from '@/lib/launchpad-config';

export function LaunchpadCreatorStudio() {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [supply, setSupply] = useState('');
  const [decimals, setDecimals] = useState<SupportedTokenDecimals | null>(null);

  const validation = useMemo(
    () => validateLaunchSupply(supply, decimals),
    [supply, decimals],
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
            Choose your own supply and precision. 200,000,000 tokens is one
            possible launch configuration, not a fixed platform limit.
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
            max="1000000000"
            min="1"
            onChange={(event) => setSupply(event.target.value)}
            placeholder="Enter 1 to 1,000,000,000"
            value={supply}
          />
          <small>
            Creator-defined maximum: 1 to 1,000,000,000 whole tokens. Zero is invalid.
          </small>
        </label>

        <fieldset className="lp-decimals-field">
          <legend>Fraction precision</legend>
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
                <small>{value === 0 ? 'Whole units' : value === 6 ? 'Stablecoin scale' : 'Solana scale'}</small>
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="lp-preview glass-card" aria-live="polite">
        <div className="lp-preview-top">
          <div>
            <span className="lp-kicker">ON-CHAIN SUPPLY PREVIEW</span>
            <strong>
              {readyForFutureProgram ? name.trim() + ' (' + symbol.trim() + ')' : 'Configuration summary'}
            </strong>
          </div>
          <span className="lp-preview-badge">NOT A DEPLOYED TOKEN</span>
        </div>

        {validation.ok ? (
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
          <p className="lp-validation-message">
            {validation.error}
          </p>
        )}

        {validation.ok && validation.earlyWindowPurchasesBlockedByGranularity && (
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
      </div>

      <div className="lp-studio-footer">
        <p>
          The creator fee policy is $0.50 USDC ($0.30 developer/operator / $0.20
          protocol treasury). It is policy only today; this preview does not
          charge a fee or submit a wallet transaction.
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
