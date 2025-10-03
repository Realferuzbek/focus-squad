import './globals.css';
import { ReactNode } from 'react';
export const metadata = { title: 'Focus Squad', description: 'Study with Feruzbek — Focus Squad' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
