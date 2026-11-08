export const LAUNCH_BRAND_SUFFIX = 'WELP UP';
export const LAUNCH_SYMBOL_SUFFIX = 'WUP';

export function brandLaunchName(value: string) {
  const clean = value.trim().replace(/\s+/g, ' ').slice(0, 32);
  if (!clean) return '';
  const upper = clean.toUpperCase();
  return upper.endsWith(LAUNCH_BRAND_SUFFIX) ? clean : `${clean} ${LAUNCH_BRAND_SUFFIX}`.slice(0, 48);
}

export function brandLaunchSymbol(value: string) {
  const clean = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (!clean) return '';
  const suffix = LAUNCH_SYMBOL_SUFFIX;
  if (clean.endsWith(suffix)) return clean;
  const base = clean.slice(0, Math.max(1, 10 - suffix.length));
  return `${base}${suffix}`.slice(0, 10);
}

export function launchMetadataUri(origin: string, params: { mint: string; name: string; symbol: string; description: string }) {
  const url = new URL('/api/launch/metadata', origin);
  url.searchParams.set('mint', params.mint);
  url.searchParams.set('name', params.name);
  url.searchParams.set('symbol', params.symbol);
  url.searchParams.set('description', params.description);
  return url.toString();
}
