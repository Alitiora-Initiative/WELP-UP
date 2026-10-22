import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://welpup.fun';
  const now = new Date();
  const routes = [
    '', '/dashboard', '/signals', '/swap', '/safety',
    '/activity', '/profile', '/autonomous', '/vault', '/terms', '/privacy',
  ];
  return routes.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: path === '' ? 1 : 0.7,
  }));
}
