import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'GG Fund',
  description: 'Cloudflare-first Next.js workspace for China fund market, portfolio, and AI analysis.',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: ['/icon.svg'],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
