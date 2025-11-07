import './globals.css';
import type { Metadata } from 'next';
import NextTopLoader from 'nextjs-toploader';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next' 
import { Analytics } from "@vercel/analytics/next"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://studywithferuzbek.vercel.app';
const SITE_TITLE = 'Study with Feruzbek';
const SITE_DESCRIPTION = 'Study tracker, timers, streaks & productivity tools by Feruzbek.';

function sanitizeGoogleVerification(raw?: string | null) {
  if (!raw) return null;
  const trimmed = raw.trim();
  const contentMatch = trimmed.match(/content=["']?([^"'>\s]+)["']?/i);
  if (contentMatch) return contentMatch[1];
  if (trimmed.startsWith('<meta')) {
    const fallbackMatch = trimmed.match(/["']([^"']+)["']/);
    if (fallbackMatch) return fallbackMatch[1];
    return null;
  }
  return trimmed.replace(/<[^>]+>/g, '').trim() || null;
}

const GOOGLE_SITE_VERIFICATION =
  sanitizeGoogleVerification(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION) ||
  '0o6FVChUObGWIeZwtJr98EohQyDziejqoVX9TyxAQcc';

const sans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s | Study with Feruzbek',
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'Study with Feruzbek',
    'Focus Squad',
    'coworking',
    'productivity',
    'study with me',
    'community',
  ],
  authors: [{ name: SITE_TITLE }],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/logo.svg',
        width: 512,
        height: 512,
        alt: SITE_TITLE,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/logo.svg'],
  },
  icons: {
    icon: [{ url: '/logo.svg', type: 'image/svg+xml' }],
    shortcut: ['/logo.svg'],
  },
  robots: { index: true, follow: true },
  verification: {
    google: GOOGLE_SITE_VERIFICATION,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} font-sans`}>
      <head>
        <meta name="google-site-verification" content={GOOGLE_SITE_VERIFICATION} />
      </head>
      <body className="font-sans bg-[#07070b] text-white">
        <NextTopLoader showSpinner={false} />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
