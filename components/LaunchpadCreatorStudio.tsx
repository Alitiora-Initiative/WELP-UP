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
  const formValid = validation.ok && validation.launchable && nameValid && symbolValid;

  return (
    <section className="lp-studio glass-panel" aria-labelledby="lp-studio-title">
      <div className="lp-studio-heading">
        <div>
          <p className="lp-kicker">MAINNET LAUNCHPAD</p>
          <h2 id="lp-studio-title">Token launch configuration.</h2>
          <p className="lp-muted">
            Configure the token parameters that a future verified mainnet launch transaction must enforce.
            No token is minted or transaction submitted by this configuration screen.
          </p>
        </div>
        <span className="lp-lock-state">PROGRAM NOT DEPLOYED</span>
      </div>

      <div className="lp-form-grid">
        <label className="lp-field">
          <span>Token name</span>
          <input
            autoComplete="off"
            maxLength={32}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter token name"
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
            placeholder="Enter ticker"
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
            placeholder="Enter whole-token supply"
            value={supply}
          />
          <small>
            Supply range: 0–1,000,000,000 whole tokens. Zero can be reviewed but cannot be launched.
          </small>
        </label>

        <fieldset className="lp-decimals-field">
          <legend>Mint precision (0–9 decimals)</legend>
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
      </div>

      <div className="lp-preview glass-card" aria-live="polite">
        <div className="lp-preview-top">
          <div>
            <span className="lp-kicker">VALIDATED CONFIGURATION</span>
            <strong>{formValid ? name.trim() + ' (' + symbol.trim() + ')' : 'Token parameters'}</strong>
          </div>
          <span className="lp-preview-badge">NOT MINTED</span>
        </div>

        {!supply.trim() || decimals === null ? (
          <p className="lp-preview-instruction">
            Enter a whole-token supply and choose mint precision to validate the raw mint amount and per-wallet early-window cap.
          </p>
        ) : validation.ok ? (
          <div className="lp-metric-grid">
            <div className="lp-metric">
              <span>Total supply</span>
              <strong>{validation.wholeSupply.toLocaleString('en-US')}</strong>
              <small>whole tokens</small>
            </div>
            <div className="lp-metric">
              <span>Mint decimals</span>
              <strong>{validation.decimals}</strong>
              <small>immutable after mint creation</small>
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

        {validation.ok && !validation.launchable ? (
          <p className="lp-warning">
            Zero supply is not launchable. A mainnet mint must have a positive, fully accounted supply.
          </p>
        ) : null}

        {validation.ok && validation.launchable && validation.earlyWindowPurchasesBlockedByGranularity ? (
          <p className="lp-warning">
            Five percent is below one indivisible token unit for this configuration. The on-chain early-window rule must reject purchases rather than round the cap upward.
          </p>
        ) : null}

        {validation.ok ? (
          <p className="lp-raw-note">
            Early-window cap in raw units: {formatBaseUnits(validation.earlyWalletLimitBaseUnits, validation.decimals)}
          </p>
        ) : null}
      </div>

      <div className="lp-studio-footer">
        <p>
          WELP protocol swap fee: <strong>0.50% of gross swap input</strong>.
          One hundred percent is credited to the treasury at collection. After the 14-day epoch, 60% of eligible new fees is released to the published developer recipient and 40% remains as protected treasury reserve.
          The fee must be transferred atomically with each WELP-controlled swap. No fee is being collected by this page.
        </p>
        <p className="lp-warning" role="status">
          Mainnet launch creation is unavailable: the launch program has not been deployed and source-verified, and there is no audited mint, buy, sell, escrow or graduation instruction to sign.
        </p>
      </div>

      {(name.length > 0 && !nameValid) || (symbol.length > 0 && !symbolValid) ? (
        <p className="lp-validation-message">
          Enter a valid token name (1–32 characters) and ticker (1–10 letters or numbers).
        </p>
      ) : null}
    </section>
  );
}
