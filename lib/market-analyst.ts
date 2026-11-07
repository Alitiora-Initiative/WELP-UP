export type AnalystAsset = {
  name: string;
  symbol: string;
  priceUsd: number | null;
  priceChange24h: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  organicScore: number | null;
  score: number | null;
  verified: boolean;
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
      liquidityUsd: finite(asset.liquidityUsd),
      volume24hUsd: finite(asset.volume24hUsd),
      organicScore: finite(asset.organicScore),
      score: finite(asset.score),
      verified: asset.verified === true,
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
