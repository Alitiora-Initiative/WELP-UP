import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: 'https://welpup.fun/sitemap.xml',
    host: 'https://welpup.fun',
  };
}
