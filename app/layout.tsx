import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/components/Providers';
import { TerminalShell } from '@/components/TerminalShell';
import './globals.css';
import './terminal.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://welpup.fun'),
  title: { default: 'WELP UP! — Solana Market Console', template: '%s · WELP UP!' },
  description: 'A non-custodial Solana market console with live Jupiter data, published rule scores and wallet-approved swaps.',
  applicationName: 'WELP UP!',
  keywords: ['Solana', 'Jupiter', 'market scanner', 'token research', 'wallet-approved swap'],
  alternates: { canonical: 'https://welpup.fun' },
  openGraph: {
    type: 'website',
    url: 'https://welpup.fun',
    siteName: 'WELP UP!',
    title: 'WELP UP! — Solana Market Console',
    description: 'Live Solana market data, transparent rule scores and wallet-approved execution.',
    images: [{ url: '/welp-up-logo.svg', width: 512, height: 512, alt: 'WELP UP! logo' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WELP UP! — Solana Market Console',
    description: 'Live Solana market data, transparent rule scores and wallet-approved execution.',
  },
  robots: { index: true, follow: true },
  icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/icon.svg', type: 'image/svg+xml' }], apple: [{ url: '/icon.svg', type: 'image/svg+xml' }] },

};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: "(function(){try{var t=localStorage.getItem('welp-theme');if(t==='dark'){document.documentElement.classList.add('dark');}else if(t==='light'){document.documentElement.classList.add('light');}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark');}else{document.documentElement.classList.add('light');}var s=localStorage.getItem('welp-text-scale');if(s==='compact'){document.documentElement.style.setProperty('--text-scale','0.875');}else if(s==='large'){document.documentElement.style.setProperty('--text-scale','1.125');}else{document.documentElement.style.setProperty('--text-scale','1');}}catch(e){}})();",
          }}
        />
        <Providers><TerminalShell>{children}</TerminalShell></Providers>
      </body>
    </html>
  );
}
