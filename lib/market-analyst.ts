export type AnalystAsset = {
  name: string;
  symbol: string;
  priceUsd: number | null;
  priceChange24h: number | null;
  priceChange1h: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  marketCapUsd: number | null;
  holders: number;
  turnover: number | null;
  buyPressure: number | null;
  topHoldersPercent: number | null;
  organicScore: number | null;
  score: number | null;
  verified: boolean;
  suspicious: boolean;
  eligible: boolean;
  blockers: string[];
  warnings: string[];
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function finite(value: unknown): number | null {
  const parsed = Number(value);
  return value === null || value === undefined || value === '' || !Number.isFinite(parsed) ? null : parsed;
}

function strings(value: unknown, limit = 4): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(0, limit).map((item) => item.slice(0, 180))
    : [];
}

export function normalizeAnalystQuestion(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const question = value.trim();
  return question.length > 0 && question.length <= 500 ? question : null;
}

export function buildAnalystSnapshot(value: unknown): { updatedAt: string | null; total: number; assets: AnalystAsset[] } {
  const feed = record(value);
  const rows = Array.isArray(feed.assets) ? feed.assets : [];
  const assets = rows.slice(0, 18).map((entry): AnalystAsset => {
    const asset = record(entry);
    return {
      name: typeof asset.name === 'string' ? asset.name.slice(0, 80) : 'Unknown token',
      symbol: typeof asset.symbol === 'string' ? asset.symbol.slice(0, 20) : '—',
      priceUsd: finite(asset.priceUsd),
      priceChange24h: finite(asset.priceChange24h),
      priceChange1h: finite(asset.priceChange1h),
      liquidityUsd: finite(asset.liquidityUsd),
      volume24hUsd: finite(asset.volume24hUsd),
      marketCapUsd: finite(asset.marketCapUsd),
      holders: Math.max(0, Math.trunc(finite(asset.holders) ?? 0)),
      turnover: finite(asset.turnover),
      buyPressure: finite(asset.buyPressure),
      topHoldersPercent: finite(asset.topHoldersPercent),
      organicScore: finite(asset.organicScore),
      score: finite(asset.score),
      verified: asset.verified === true,
      suspicious: asset.suspicious === true,
      eligible: asset.eligible === true,
      blockers: strings(asset.blockers),
      warnings: strings(asset.warnings),
    };
  });
  return {
    updatedAt: typeof feed.updatedAt === 'string' ? feed.updatedAt : null,
    total: Number.isFinite(Number(feed.total)) ? Number(feed.total) : rows.length,
    assets,
  };
}

export function extractResponsesText(value: unknown): string {
  const response = record(value);
  const output = Array.isArray(response.output) ? response.output : [];
  const chunks: string[] = [];
  for (const item of output) {
    const message = record(item);
    if (message.type !== 'message' || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      const content = record(part);
      if (content.type === 'output_text' && typeof content.text === 'string') chunks.push(content.text);
    }
  }
  return chunks.join('\n').trim();
}

function money(value: number | null) {
  return value === null ? 'unavailable' : '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function percent(value: number | null) {
  return value === null ? 'unavailable' : value.toFixed(2) + '%';
}

function assetLine(asset: AnalystAsset) {
  return [
    asset.symbol || asset.name,
    'score ' + (asset.score === null ? 'n/a' : asset.score.toFixed(1)),
    'liquidity ' + money(asset.liquidityUsd),
    'volume24h ' + money(asset.volume24hUsd),
    'change24h ' + percent(asset.priceChange24h),
    asset.eligible ? 'eligible' : 'blocked',
    asset.blockers.length ? 'blocks: ' + asset.blockers.join('; ') : '',
    asset.warnings.length ? 'warnings: ' + asset.warnings.join('; ') : '',
  ].filter(Boolean).join(' · ');
}

/**
 * Deterministic analyst used when no external model credential is configured.
 * It answers only from the supplied live snapshot and never invents fields.
 */
export function buildDeterministicAnalystAnswer(snapshot: { updatedAt: string | null; total: number; assets: AnalystAsset[] }, question: string) {
  const assets = snapshot.assets;
  const eligible = assets.filter((asset) => asset.eligible);
  const blocked = assets.filter((asset) => !asset.eligible);
  const ranked = [...assets].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (b.liquidityUsd ?? -1) - (a.liquidityUsd ?? -1));
  const top = ranked.slice(0, 5);
  const query = question.toLowerCase();
  const named = assets.find((asset) =>
    query.includes(asset.symbol.toLowerCase()) || query.includes(asset.name.toLowerCase()),
  );
  const wantsRisk = /risk|block|danger|safe|warning/.test(query);
  const wantsLiquidity = /liquid|depth|volume/.test(query);
  const wantsCompare = /compare|versus|vs|best|top|strongest/.test(query);

  const lines = [
    'Conclusion: the live snapshot contains ' + assets.length + ' analyzed assets from a feed total of ' + snapshot.total + ', with ' + eligible.length + ' eligible and ' + blocked.length + ' blocked in this slice.',
    'Feed timestamp: ' + (snapshot.updatedAt ?? 'unavailable') + '.',
  ];

  if (named) {
    lines.push('Named asset: ' + assetLine(named) + '.');
    if (named.blockers.length) lines.push('Primary concern: ' + named.blockers.join('; ') + '.');
    if (named.warnings.length) lines.push('Secondary concern: ' + named.warnings.join('; ') + '.');
    if (!named.blockers.length && !named.warnings.length) lines.push('No feed-reported blocker or warning is present for this asset in the supplied snapshot.');
  } else if (wantsRisk) {
    const risky = blocked.slice(0, 5);
    lines.push(risky.length
      ? 'Highest-risk rows in this snapshot: ' + risky.map(assetLine).join('\n')
      : 'No blocked assets appear in the analyzed slice; verify the remaining warnings before treating that as safety.');
  } else if (wantsLiquidity) {
    const deepest = [...assets].sort((a, b) => (b.liquidityUsd ?? -1) - (a.liquidityUsd ?? -1)).slice(0, 5);
    lines.push('Deepest liquidity rows: ' + deepest.map(assetLine).join('\n'));
  } else if (wantsCompare || true) {
    lines.push('Top scored rows: ' + (top.length ? top.map(assetLine).join('\n') : 'none available'));
  }

  lines.push('Interpretation: scores and blockers are deterministic feed calculations, not profit predictions. Missing fields remain missing rather than estimated.');
  lines.push('Execution boundary: this analyst has no wallet, signing, transaction, or order-placement capability.');
  return lines.join('\n');
}
