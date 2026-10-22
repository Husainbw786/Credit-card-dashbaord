'use client';

import { useState, useTransition } from 'react';
import { addGiftCardOffer, addMerchantOffer, lookupOffers } from '@/lib/actions';
import type { OfferSearchFailure, OfferSearchResult } from '@/lib/llm/types';
import { Badge, Button, Card, Muted, Select, inputClass } from './ui';

export interface LookupOption {
  id: string;
  name: string;
}

interface Props {
  brands: LookupOption[];
  platforms: LookupOption[];
  cards: { id: string; name: string; issuer: string }[];
  initialBrandId?: string;
  /** When true, the brand is fixed (used under shop results). */
  fixedBrand?: boolean;
  searchAvailable: boolean;
  providerLabel: string;
}

function matchPlatform(platforms: LookupOption[], name: string): string | undefined {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return platforms.find((p) => p.id.replace(/[^a-z0-9]/g, '') === n || p.name.toLowerCase().replace(/[^a-z0-9]/g, '') === n)?.id;
}

function matchCard(cards: Props['cards'], bank: string, card: string | null): string {
  const hay = `${bank} ${card ?? ''}`.toLowerCase();
  const byName = card ? cards.find((c) => hay.includes(c.name.toLowerCase().split(' ')[0]!) && c.issuer.toLowerCase().split(' ')[0] && hay.includes(c.issuer.toLowerCase().split(' ')[0]!)) : undefined;
  if (byName) return byName.id;
  const byIssuer = cards.filter((c) => hay.includes(c.issuer.toLowerCase().split(' ')[0]!));
  return byIssuer.length === 1 ? byIssuer[0]!.id : '';
}

export function OfferLookup({ brands, platforms, cards, initialBrandId, fixedBrand = false, searchAvailable, providerLabel }: Props) {
  const [brandId, setBrandId] = useState(initialBrandId ?? brands[0]?.id ?? '');
  const [result, setResult] = useState<OfferSearchResult | OfferSearchFailure | null>(null);
  const [pending, startTransition] = useTransition();
  const brandName = brands.find((b) => b.id === brandId)?.name ?? brandId;

  function run() {
    startTransition(async () => {
      setResult(await lookupOffers(brandId));
    });
  }

  return (
    <Card className="border-dashed">
      <div className="flex flex-wrap items-end gap-2">
        {!fixedBrand && (
          <div className="min-w-40 flex-1">
            <Select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <Button type="button" variant="secondary" onClick={run} disabled={pending || !searchAvailable}>
          {pending ? 'Searching the web…' : `Search the web for ${brandName} discounts`}
        </Button>
      </div>
      <Muted className="mt-1">
        {searchAvailable
          ? `Uses ${providerLabel} with live web search. Results are suggestions with sources; nothing is saved until you add it.`
          : 'Web search needs OPENAI_API_KEY in the environment.'}
      </Muted>

      {result && !result.ok && <p className="mt-3 text-sm text-red-700 dark:text-red-300">{result.error}</p>}

      {result?.ok && (
        <div className="mt-3 space-y-3">
          <p className="text-sm">{result.result.summary}</p>

          {result.result.giftCards.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold">Gift card discounts found</h4>
              <ul className="mt-1 space-y-2">
                {result.result.giftCards.map((g, i) => {
                  const platformId = matchPlatform(platforms, g.platform);
                  return (
                    <li key={i} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{g.platform}</span>
                        <span className="text-emerald-700 dark:text-emerald-300">{g.discountPct === null ? 'discount not stated' : `${g.discountPct}% off`}</span>
                        <Badge tone={g.confidence}>{g.confidence}</Badge>
                        {g.cardRequired && <Badge>needs {g.cardRequired}</Badge>}
                        <Badge>{g.redemption === 'unknown' ? 'redemption unknown' : `redeem ${g.redemption}`}</Badge>
                      </div>
                      {g.notes && <Muted className="mt-1">{g.notes}</Muted>}
                      <a href={g.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-blue-700 underline dark:text-blue-300">
                        {g.sourceUrl}
                      </a>
                      <form action={addGiftCardOffer} className="mt-2 flex flex-wrap items-center gap-2">
                        <input type="hidden" name="brandId" value={brandId} />
                        <input type="hidden" name="sourceUrl" value={g.sourceUrl} />
                        <input type="hidden" name="sourceNote" value={`Found by ${providerLabel} web search${g.asOf ? ` (as of ${g.asOf})` : ''}`} />
                        <input type="hidden" name="promoCode" value={g.promoCode ?? ''} />
                        <select name="platformId" defaultValue={platformId ?? platforms[0]?.id} className={`${inputClass} w-36`}>
                          {platforms.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <input name="discountPct" type="number" min={0} max={100} step="0.5" defaultValue={g.discountPct ?? ''} required placeholder="%" className={`${inputClass} w-20`} />
                        <Button type="submit" variant="secondary">
                          Add to offers
                        </Button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {result.result.bankOffers.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold">Bank and merchant offers found</h4>
              <ul className="mt-1 space-y-2">
                {result.result.bankOffers.map((o, i) => (
                  <li key={i} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {o.bank}
                        {o.card ? ` · ${o.card}` : ''}
                      </span>
                      <span className="text-emerald-700 dark:text-emerald-300">
                        {o.pct}% {o.kind}
                        {o.cap ? ` up to ₹${o.cap}` : ''}
                      </span>
                      <Badge tone={o.confidence}>{o.confidence}</Badge>
                      <Badge>{o.channel}</Badge>
                      {o.validTill && <Badge>till {o.validTill}</Badge>}
                    </div>
                    {o.notes && <Muted className="mt-1">{o.notes}</Muted>}
                    <a href={o.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-blue-700 underline dark:text-blue-300">
                      {o.sourceUrl}
                    </a>
                    <form action={addMerchantOffer} className="mt-2 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="brandId" value={brandId} />
                      <input type="hidden" name="kind" value={o.kind} />
                      <input type="hidden" name="pct" value={o.pct} />
                      <input type="hidden" name="cap" value={o.cap ?? ''} />
                      <input type="hidden" name="minSpend" value={o.minSpend ?? ''} />
                      <input type="hidden" name="code" value={o.code ?? ''} />
                      <input type="hidden" name="validTill" value={o.validTill ?? ''} />
                      <input type="hidden" name="sourceUrl" value={o.sourceUrl} />
                      <input type="hidden" name="sourceNote" value={`Found by ${providerLabel} web search`} />
                      {(o.channel === 'online' || o.channel === 'both') && <input type="hidden" name="channel:online" value="on" />}
                      {(o.channel === 'offline' || o.channel === 'both') && <input type="hidden" name="channel:offline" value="on" />}
                      <select name="cardProductId" defaultValue={matchCard(cards, o.bank, o.card)} className={`${inputClass} w-56`}>
                        <option value="">Any card / coupon</option>
                        {cards.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" variant="secondary">
                        Add to offers
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.result.giftCards.length === 0 && result.result.bankOffers.length === 0 && <Muted>Nothing concrete found. Try again later or enter what you see on the platforms.</Muted>}

          {result.citations.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-zinc-500">Sources ({result.citations.length})</summary>
              <ul className="mt-1 space-y-0.5">
                {result.citations.map((c) => (
                  <li key={c.url}>
                    <a href={c.url} target="_blank" rel="noreferrer" className="text-blue-700 underline dark:text-blue-300">
                      {c.title || c.url}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <Muted>Model: {result.model}. Added offers are stamped with today&apos;s date and the source URL.</Muted>
        </div>
      )}
    </Card>
  );
}
