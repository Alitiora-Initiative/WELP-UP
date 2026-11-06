import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://welpup.fun';
  const now = new Date();
  const routes = [
    '', '/markets', '/signals', '/swap', '/portfolio', '/profile', '/settings',
    '/automation', '/agent', '/autonomous', '/agent-monitor', '/vault', '/strategy-marketplace',
    '/history', '/activity-logs', '/governance', '/risk-dashboard', '/api-keys',
    '/referral', '/token-explorer', '/support', '/system-status', '/docs',
    '/whitepaper', '/safety', '/terms', '/privacy',
  ];
  return routes.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: path === '' ? 1 : path === '/markets' || path === '/swap' ? 0.9 : 0.7,
  }));
}
