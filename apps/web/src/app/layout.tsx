import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Nav } from '@/components/nav';
import { storeInfo } from '@/lib/store';
import './globals.css';

export const metadata: Metadata = {
  title: 'Smart Spend',
  description: 'The cheapest way to pay, using your cards and discounted gift cards.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: ReactNode }) {
  const store = storeInfo();
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        <Nav />
        {!store.persistent && (
          <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Edits are stored in this server&apos;s temp directory and reset on redeploy. Add an Upstash Redis database (Vercel Marketplace) so they persist.
          </div>
        )}
        <main className="mx-auto max-w-3xl px-4 pb-20 pt-5">{children}</main>
      </body>
    </html>
  );
}
