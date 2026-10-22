import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://welpup.fun'),
  title: {
    default: 'WELP UP! — Solana market scanner and trading console',
    template: '%s · WELP UP!',
  },
  description:
    'WELP scans live Solana pools, explains every signal it finds, and lets you approve swaps in Phantom. Transparent rule scores, the reason behind each one, no seed phrase.',
  applicationName: 'WELP UP!',
  keywords: ['Solana', 'trading bot', 'Jupiter', 'memecoin scanner', 'tokenized stocks', 'DeFi'],
  alternates: { canonical: 'https://welpup.fun' },
  openGraph: {
    type: 'website',
    url: 'https://welpup.fun',
    siteName: 'WELP UP!',
    title: 'WELP UP! — Solana market scanner and trading console',
    description: 'Live Solana pool scanning with the reasons behind every score.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WELP UP! — Solana market scanner',
    description: 'Live Solana pool scanning with the reasons behind every score.',
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
