import './globals.css';
import { ReactNode } from 'react';
export const metadata = { title: 'Focus Squad', description: 'Study with Feruzbek — Focus Squad' };

export const metadata = {
  title: 'Studywithferuzbek',
  description: 'Focus Squad — study together, level up.',
  icons: {
    icon: [
      { url: '/logo.svg', type: 'image/svg+xml' }, // works now
      { url: '/favicon.ico' }                      // add later if you export one
    ],
  },
  openGraph: {
    title: 'Studywithferuzbek',
    description: 'Focus Squad — study together, level up.',
    url: 'https://studywithferuzbek.vercel.app',
    siteName: 'Studywithferuzbek',
    images: ['/opengraph-image.png'], // add this file when ready
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
