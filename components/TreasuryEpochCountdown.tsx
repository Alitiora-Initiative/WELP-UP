'use client';

import { useEffect, useState } from 'react';

const EPOCH_SECONDS = 1_209_600;

function formatRemaining(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [days + 'd', hours + 'h', minutes + 'm', seconds + 's'].join(' ');
}

/**
 * Displays a countdown only when supplied with a timestamp decoded from the
 * verified on-chain TreasuryAccount. The browser clock is informational;
 * disburse_treasury_funds enforces the epoch using the Solana Clock sysvar.
 */
export function TreasuryEpochCountdown({
  lastDistributionTimestamp,
}: {
  lastDistributionTimestamp: number | null;
}) {
  const [nowSeconds, setNowSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (
      lastDistributionTimestamp === null ||
      !Number.isSafeInteger(lastDistributionTimestamp) ||
      lastDistributionTimestamp < 0
    ) {
      return;
    }

    // Subscribe to the browser clock; the first visible tick appears within
    // one second. The program independently checks the Solana Clock sysvar.
    const interval = window.setInterval(
      () => setNowSeconds(Math.floor(Date.now() / 1_000)),
      1_000,
    );
    return () => window.clearInterval(interval);
  }, [lastDistributionTimestamp]);

  const hasTimestamp =
    lastDistributionTimestamp !== null &&
    Number.isSafeInteger(lastDistributionTimestamp) &&
    lastDistributionTimestamp >= 0;

  const unlockTimestamp = hasTimestamp
    ? lastDistributionTimestamp + EPOCH_SECONDS
    : null;
  const remaining =
    unlockTimestamp !== null && nowSeconds !== null
      ? Math.max(0, unlockTimestamp - nowSeconds)
      : null;

  return (
    <section className="lp-treasury-epoch glass-panel" aria-labelledby="lp-treasury-epoch-title">
      <div className="lp-treasury-epoch-copy">
        <p className="lp-kicker">TREASURY / DISTRIBUTION WINDOW</p>
        <h2 id="lp-treasury-epoch-title">Two-week release lock.</h2>
        <p>
          The 14-day epoch is checked against Solana&apos;s on-chain Clock. A browser
          countdown never authorizes a withdrawal.
        </p>
      </div>
      <div className="lp-treasury-epoch-value" aria-live="polite">
        {remaining === null ? (
          <>
            <strong>— — —</strong>
            <small>Waiting for verified Treasury PDA state</small>
          </>
        ) : remaining > 0 ? (
          <>
            <strong>{formatRemaining(remaining)}</strong>
            <small>Approximate time until the on-chain gate may mature</small>
          </>
        ) : (
          <>
            <strong>Epoch matured</strong>
            <small>The contract must still confirm the Solana Clock and balance.</small>
          </>
        )}
      </div>
    </section>
  );
}
