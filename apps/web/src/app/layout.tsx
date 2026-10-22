import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Nav } from '@/components/nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Smart Spend',
  description: 'The cheapest way to pay, using your cards and discounted gift cards.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        <Nav />
        <main className="mx-auto max-w-3xl px-4 pb-20 pt-5">{children}</main>
      </body>
    </html>
  );
}
