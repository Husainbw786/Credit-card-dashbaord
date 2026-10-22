'use client';

import { useState, useTransition } from 'react';
import type { Channel } from '@smart-spend/engine';
import { askAssistant, computeRoutes, type RoutesResult } from '@/lib/actions';
import { inr } from '@/lib/format';
import { RouteCard } from './route-card';
import { Button, Card, Field, Input, Muted, Select } from './ui';

type Mode = 'ask' | 'form';

export function ShopAssistant({ brands }: { brands: { id: string; name: string }[] }) {
  const [mode, setMode] = useState<Mode>('ask');
  const [message, setMessage] = useState('');
  const [brandId, setBrandId] = useState(brands[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState<Channel>('offline');
  const [inStoreNow, setInStoreNow] = useState(false);
  const [result, setResult] = useState<RoutesResult | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [pending, startTransition] = useTransition();

  function submitAsk(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setShowAll(false);
      setResult(await askAssistant(message));
    });
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setShowAll(false);
      setResult(await computeRoutes({ brandId, amount: Number(amount), channel, inStoreNow }));
    });
  }

  const visible = result?.ok ? (showAll ? result.routes : result.routes.slice(0, 3)) : [];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        {(['ask', 'form'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${mode === m ? 'bg-white shadow dark:bg-zinc-900' : 'text-zinc-600 dark:text-zinc-300'}`}
          >
            {m === 'ask' ? 'Just tell me' : 'Pick details'}
          </button>
        ))}
      </div>

      {mode === 'ask' ? (
        <form onSubmit={submitAsk} className="space-y-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder='e.g. "I am at the Giva showroom in Indore, bracelet is 12,000" or "buying a 2k Myntra order online"'
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
          />
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? 'Working…' : 'How should I pay?'}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitForm} className="grid grid-cols-2 gap-3">
          <Field label="Brand / shop" className="col-span-2 sm:col-span-1">
            <Select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bill amount (₹)" className="col-span-2 sm:col-span-1">
            <Input type="number" min={1} step="1" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10000" required />
          </Field>
          <Field label="Where" className="col-span-2 sm:col-span-1">
            <Select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              <option value="offline">Physical store</option>
              <option value="online">Online</option>
              <option value="upi">Store, paying by UPI</option>
            </Select>
          </Field>
          <label className="col-span-2 flex items-center gap-2 self-end text-sm sm:col-span-1">
            <input type="checkbox" checked={inStoreNow} onChange={(e) => setInStoreNow(e.target.checked)} className="h-4 w-4" />
            I&apos;m in the store right now (instant routes only)
          </label>
          <div className="col-span-2">
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? 'Working…' : 'Find the best way to pay'}
            </Button>
          </div>
        </form>
      )}

      {result && !result.ok && (
        <Card className="border-amber-300 dark:border-amber-800">
          <p className="text-sm">{result.error}</p>
          {result.notes.map((n, i) => (
            <Muted key={i} className="mt-1">{n}</Muted>
          ))}
        </Card>
      )}

      {result?.ok && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">
              {inr(result.intent.amount)} at {result.brandName}{' '}
              <span className="ml-1 text-sm font-normal text-zinc-500">
                {result.intent.channel === 'online' ? 'online' : result.intent.channel === 'upi' ? 'in store via UPI' : 'in store'}
                {result.intent.inStoreNow ? ', right now' : ''}
              </span>
            </h2>
            {result.notes.map((n, i) => (
              <Muted key={i}>{n}</Muted>
            ))}
            {result.parser && <Muted>Parsed by {result.parser === 'claude' ? 'Claude' : 'the local parser'}.</Muted>}
          </div>
          {visible.length === 0 && <Muted>No routes found. Add a gift card offer or a card first.</Muted>}
          {visible.map((r, i) => (
            <RouteCard key={r.id} route={r} rank={i + 1} />
          ))}
          {result.routes.length > 3 && (
            <Button variant="secondary" type="button" onClick={() => setShowAll((v) => !v)} className="w-full">
              {showAll ? 'Show top 3 only' : `Show all ${result.routes.length} routes`}
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
