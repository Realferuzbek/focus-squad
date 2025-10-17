import './globals.css';
import type { Metadata } from 'next';
import NextTopLoader from 'nextjs-toploader';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next' 
import { Analytics } from "@vercel/analytics/next"

const siteUrl = 'https://studywithferuzbek.vercel.app';
const siteTitle = 'Studywithferuzbek';
const siteDescription = 'Focus Squad — study together, level up.';

const sans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: `%s | ${siteTitle}`,
  },
  description: siteDescription,
  keywords: [
    'Studywithferuzbek',
    'Focus Squad',
    'coworking',
    'productivity',
    'study with me',
    'community',
  ],
  authors: [{ name: 'Studywithferuzbek' }],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: siteTitle,
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: '/logo.svg',
        width: 512,
        height: 512,
        alt: siteTitle,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
    images: ['/logo.svg'],
  },
  icons: {
    icon: [{ url: '/logo.svg', type: 'image/svg+xml' }],
    shortcut: ['/logo.svg'],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} font-sans`}>
      <body className="font-sans bg-[#07070b] text-white">
        <NextTopLoader showSpinner={false} />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
