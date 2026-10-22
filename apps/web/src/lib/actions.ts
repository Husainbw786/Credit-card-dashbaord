'use server';

import { revalidatePath } from 'next/cache';
import {
  PurchaseIntentSchema,
  findRoutes,
  type Category,
  type Channel,
  type PurchaseIntent,
  type Route,
} from '@smart-spend/engine';
import { activeProvider, fuzzyBrand, parseIntent, providerLabel, searchOffersOnline, type OfferSearchFailure, type OfferSearchResult, type ProviderName } from './llm';
import { getKnowledgeBase } from './kb';
import { slug, today, updateState } from './store';

export type RoutesResult =
  | { ok: true; brandName: string; intent: PurchaseIntent; routes: Route[]; parser?: ProviderName; parserLabel?: string; notes: string[] }
  | { ok: false; error: string; parser?: ProviderName; parserLabel?: string; notes: string[] };

const ONLINE_ONLY_CATEGORIES = new Set<Category>(['food_delivery', 'travel']);

function revalidateAll() {
  for (const p of ['/', '/cards', '/offers', '/strategies']) revalidatePath(p);
}

export async function computeRoutes(input: { brandId: string; amount: number; channel: Channel; inStoreNow: boolean }): Promise<RoutesResult> {
  const { kb } = await getKnowledgeBase();
  const brand = kb.brands.find((b) => b.id === input.brandId);
  if (!brand) return { ok: false, error: 'Pick a brand.', notes: [] };
  const parsed = PurchaseIntentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Enter a positive amount.', notes: [] };
  const routes = findRoutes(kb, parsed.data);
  return { ok: true, brandName: brand.name, intent: parsed.data, routes, notes: [] };
}

export async function askAssistant(message: string): Promise<RoutesResult> {
  const text = message.trim();
  if (!text) return { ok: false, error: 'Tell me what you want to buy and roughly how much it costs.', notes: [] };
  const { kb } = await getKnowledgeBase();
  const { parsed, provider: parser, warning } = await parseIntent(text, kb);
  const parserLabel = parser === 'local' ? 'the local parser' : providerLabel();
  const notes: string[] = [];
  if (warning) notes.push(warning);
  let brand = parsed.brandQuery ? fuzzyBrand(kb, parsed.brandQuery) : undefined;
  if (!brand && parsed.brandQuery) {
    // New merchant: add it with what we know and keep going; the user can correct it on the Offers page.
    const name = parsed.brandQuery.trim();
    const id = slug(name) || `brand-${Date.now().toString(36)}`;
    const category: Category = parsed.category ?? 'general';
    const onlineOnly = ONLINE_ONLY_CATEGORIES.has(category);
    await updateState((s) => {
      if (s.brands.some((b) => b.id === id)) return;
      s.brands.push({
        id,
        name,
        category,
        acceptsUpi: !onlineOnly,
        defaultChannel: onlineOnly ? 'online' : 'offline',
        redemption: { online: true, offlineStores: onlineOnly ? 'none' : 'select', partial: true, notes: 'Added automatically from a shopping request; verify gift card acceptance.' },
      });
    });
    const fresh = await getKnowledgeBase();
    kb.brands.splice(0, kb.brands.length, ...fresh.kb.brands);
    brand = kb.brands.find((b) => b.id === id);
    notes.push(`Added "${name}" as a new ${category.replace('_', ' ')} brand. Fix the category or gift card rules on the Offers page if that is wrong.`);
    revalidateAll();
  }
  if (!brand) {
    const known = kb.brands.slice(0, 12).map((b) => b.name).join(', ');
    return { ok: false, parser, parserLabel, notes, error: `Which shop or brand? For example: ${known}…` };
  }
  if (!parsed.amount) {
    return { ok: false, parser, parserLabel, notes, error: `How much is the bill at ${brand.name}?` };
  }
  const channel: Channel = parsed.channel ?? brand.defaultChannel ?? (ONLINE_ONLY_CATEGORIES.has(brand.category) ? 'online' : 'offline');
  if (!parsed.channel) notes.push(channel === 'online' ? `Assumed an online order at ${brand.name}; say "in store" if not.` : `Assumed you are paying at a ${brand.name} store; say "online" if not.`);
  const intent = PurchaseIntentSchema.parse({ brandId: brand.id, amount: parsed.amount, channel, inStoreNow: parsed.inStoreNow });
  const searched = await ensureFreshOffers(brand.id);
  notes.push(...searched.notes);
  const latest = searched.refreshed ? (await getKnowledgeBase()).kb : kb;
  const routes = findRoutes(latest, intent);
  return { ok: true, parser, parserLabel, brandName: brand.name, intent, routes, notes };
}

const FRESH_DAYS = 7;

function isFresh(verifiedAt: string | undefined, days = FRESH_DAYS): boolean {
  if (!verifiedAt) return false;
  return Date.now() - new Date(verifiedAt).getTime() < days * 86_400_000;
}

function matchPlatformId(platforms: { id: string; name: string }[], name: string): string | undefined {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return platforms.find((p) => p.id.replace(/[^a-z0-9]/g, '') === n || p.name.toLowerCase().replace(/[^a-z0-9]/g, '') === n)?.id;
}

function matchCardId(cards: { id: string; name: string; issuer: string }[], bank: string, card: string | null): string | undefined {
  const hay = `${bank} ${card ?? ''}`.toLowerCase();
  const byName = cards.filter((c) => hay.includes(c.name.toLowerCase().replace(/ credit card$/, '')));
  if (byName.length === 1) return byName[0]!.id;
  const byIssuer = cards.filter((c) => hay.includes(c.issuer.toLowerCase().split(' ')[0]!));
  return byIssuer.length === 1 ? byIssuer[0]!.id : undefined;
}

/**
 * If the brand has no gift card discount verified in the last week and the OpenAI
 * provider is available, search the web once a day and store what was found as
 * unconfirmed offers, so routes are ranked with real numbers.
 */
async function ensureFreshOffers(brandId: string): Promise<{ refreshed: boolean; notes: string[] }> {
  if (activeProvider() !== 'openai') return { refreshed: false, notes: [] };
  const { kb, state } = await getKnowledgeBase();
  const brand = kb.brands.find((b) => b.id === brandId);
  if (!brand) return { refreshed: false, notes: [] };
  const hasFresh = kb.giftCardOffers.some((o) => o.brandId === brandId && !o.discountUnknown && isFresh(o.verifiedAt));
  const todayIso = today();
  if (hasFresh || state.autoSearch?.[brandId] === todayIso) return { refreshed: false, notes: [] };

  const found = await searchOffersOnline(brandId, kb);
  await updateState((s) => {
    s.autoSearch = { ...(s.autoSearch ?? {}), [brandId]: todayIso };
  });
  if (!found.ok) return { refreshed: false, notes: [`Tried to look up ${brand.name} discounts online: ${found.error}`] };

  const platforms = kb.platforms.filter((p) => p.type === 'gift_card').map((p) => ({ id: p.id, name: p.name }));
  const myCards = kb.myCards
    .map((m) => kb.cards.find((c) => c.id === m.cardProductId))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({ id: c.id, name: c.name, issuer: c.issuer }));
  const added: string[] = [];
  const skipped: string[] = [];
  await updateState((s) => {
    for (const g of found.result.giftCards) {
      const platformId = matchPlatformId(platforms, g.platform);
      if (!platformId || g.discountPct === null || g.discountPct <= 0) {
        skipped.push(`${g.platform}${g.discountPct === null ? ' (no % stated)' : ''}`);
        continue;
      }
      const id = `auto-${platformId}-${brandId}`;
      const existingIdx = s.giftCardOffers.findIndex((o) => o.id === id);
      const userRow = s.giftCardOffers.find((o) => o.platformId === platformId && o.brandId === brandId && o.source === 'user' && isFresh(o.verifiedAt, 14));
      if (userRow) continue; // keep what the user entered recently
      const row = {
        id,
        platformId,
        brandId,
        discountPct: g.discountPct,
        promoCode: g.promoCode ?? undefined,
        delivery: 'instant' as const,
        source: 'auto' as const,
        unconfirmed: true,
        discountUnknown: false,
        verifiedAt: todayIso,
        sourceUrl: g.sourceUrl,
        sourceNote: `Found by ${providerLabel()} web search (${g.confidence} confidence)${g.cardRequired ? `; needs ${g.cardRequired}` : ''}${g.notes ? `; ${g.notes}` : ''}`,
      };
      if (existingIdx >= 0) s.giftCardOffers[existingIdx] = row;
      else s.giftCardOffers.push(row);
      added.push(`${platforms.find((p) => p.id === platformId)?.name} ${g.discountPct}%`);
    }
    for (const [i, o] of found.result.bankOffers.entries()) {
      const cardProductId = matchCardId(myCards, o.bank, o.card);
      if (!cardProductId || o.pct <= 0) continue;
      const id = `auto-mo-${brandId}-${cardProductId}-${i}`;
      const channels = o.channel === 'both' ? (['online', 'offline'] as const) : ([o.channel] as const);
      const row = {
        id,
        brandId,
        cardProductId,
        kind: o.kind,
        pct: o.pct,
        cap: o.cap ?? undefined,
        minSpend: o.minSpend ?? undefined,
        channels: [...channels],
        code: o.code ?? undefined,
        validTill: o.validTill ?? undefined,
        source: 'auto' as const,
        unconfirmed: true,
        verifiedAt: todayIso,
        sourceUrl: o.sourceUrl,
        sourceNote: `Found by ${providerLabel()} web search (${o.confidence} confidence)${o.notes ? `; ${o.notes}` : ''}`,
      };
      const idx = s.merchantOffers.findIndex((m) => m.id === id);
      if (idx >= 0) s.merchantOffers[idx] = row;
      else s.merchantOffers.push(row);
      added.push(`${o.bank} ${o.pct}% ${o.kind}`);
    }
  });
  revalidateAll();
  const notes: string[] = [];
  if (added.length) notes.push(`Checked online just now and found: ${added.join(', ')}. Marked unconfirmed until you verify on the platform (Offers page).`);
  else notes.push(`Checked online just now; no current gift card discount found for ${brand.name}${skipped.length ? ` (${skipped.join(', ')} listed without a number)` : ''}.`);
  return { refreshed: added.length > 0, notes };
}

/** Live web research (OpenAI web_search) for a brand's gift card and bank offers. */
export async function lookupOffers(brandId: string): Promise<OfferSearchResult | OfferSearchFailure> {
  const { kb } = await getKnowledgeBase();
  return searchOffersOnline(brandId, kb);
}

// ---------- cards ----------

export async function setCardOwned(formData: FormData): Promise<void> {
  const cardProductId = String(formData.get('cardProductId') ?? '');
  const owned = formData.get('owned') === 'true';
  if (!cardProductId) return;
  await updateState((s) => {
    if (owned) {
      if (!s.myCards.some((m) => m.cardProductId === cardProductId)) {
        s.myCards.push({ id: `my-${cardProductId}`, cardProductId, capUsed: {}, flags: {} });
      }
    } else {
      s.myCards = s.myCards.filter((m) => m.cardProductId !== cardProductId);
    }
  });
  revalidateAll();
}

export async function updateMyCard(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const capGroups = String(formData.get('capGroups') ?? '').split(',').filter(Boolean);
  const flagNames = String(formData.get('flagNames') ?? '').split(',').filter(Boolean);
  const override = Number(formData.get('pointValueOverride'));
  await updateState((s) => {
    const my = s.myCards.find((m) => m.id === id);
    if (!my) return;
    my.capUsed = my.capUsed ?? {};
    for (const g of capGroups) {
      const v = Number(formData.get(`cap:${g}`));
      my.capUsed[g] = Number.isFinite(v) && v > 0 ? v : 0;
    }
    my.flags = my.flags ?? {};
    for (const f of flagNames) my.flags[f] = formData.get(`flag:${f}`) === 'on';
    my.pointValueOverride = Number.isFinite(override) && override > 0 ? override : undefined;
    my.nickname = String(formData.get('nickname') ?? '').trim() || undefined;
  });
  revalidateAll();
}

export async function resetCaps(): Promise<void> {
  await updateState((s) => {
    for (const m of s.myCards) m.capUsed = {};
  });
  revalidateAll();
}

export async function addCustomCard(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim();
  const issuer = String(formData.get('issuer') ?? '').trim() || 'Unknown';
  const network = String(formData.get('network') ?? 'visa') as 'visa' | 'mastercard' | 'rupay' | 'amex' | 'diners';
  const onlinePct = Number(formData.get('onlinePct')) || 0;
  const offlinePct = Number(formData.get('offlinePct')) || 0;
  const giftCardPurchases = String(formData.get('giftCardPurchases') ?? 'unknown') as 'earns' | 'excluded' | 'unknown';
  if (!name) return;
  const id = `custom-${slug(name)}`;
  await updateState((s) => {
    if (s.customCards.some((c) => c.id === id)) return;
    s.customCards.push({
      id,
      issuer,
      name,
      network,
      giftCardPurchases,
      verifiedAt: today(),
      sourceNote: 'Entered by user',
      rules: [
        ...(onlinePct > 0
          ? [{ id: `${id}-online`, name: `${onlinePct}% on online spends`, kind: 'cashback' as const, rate: onlinePct / 100, channels: ['online' as const], priority: 10, verifiedAt: today() }]
          : []),
        ...(offlinePct > 0
          ? [{ id: `${id}-offline`, name: `${offlinePct}% on offline spends`, kind: 'cashback' as const, rate: offlinePct / 100, channels: ['offline' as const, 'upi' as const], priority: 5, verifiedAt: today() }]
          : []),
      ],
    });
    s.myCards.push({ id: `my-${id}`, cardProductId: id, capUsed: {}, flags: {} });
  });
  revalidateAll();
}

export async function deleteCustomCard(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  await updateState((s) => {
    s.customCards = s.customCards.filter((c) => c.id !== id);
    s.myCards = s.myCards.filter((m) => m.cardProductId !== id);
  });
  revalidateAll();
}

// ---------- brands ----------

export async function addBrand(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  const id = slug(name);
  const category = String(formData.get('category') ?? 'general') as Category;
  const offlineStores = String(formData.get('offlineStores') ?? 'all') as 'all' | 'select' | 'none';
  const validity = Number(formData.get('validityDays'));
  await updateState((s) => {
    if (s.brands.some((b) => b.id === id)) return;
    s.brands.push({
      id,
      name,
      category,
      acceptsUpi: formData.get('acceptsUpi') === 'on',
      redemption: {
        online: formData.get('online') === 'on',
        offlineStores,
        partial: true,
        validityDays: Number.isFinite(validity) && validity > 0 ? validity : undefined,
        verifiedAt: today(),
        sourceNote: 'Entered by user',
      },
    });
  });
  revalidateAll();
}

export async function deleteBrand(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  await updateState((s) => {
    s.brands = s.brands.filter((b) => b.id !== id);
    s.hiddenBrands = [...new Set([...(s.hiddenBrands ?? []), id])];
    s.giftCardOffers = s.giftCardOffers.filter((o) => o.brandId !== id);
    s.merchantOffers = s.merchantOffers.filter((o) => o.brandId !== id);
  });
  revalidateAll();
}

// ---------- gift card offers ----------

export async function addGiftCardOffer(formData: FormData): Promise<void> {
  const platformId = String(formData.get('platformId') ?? '');
  const brandId = String(formData.get('brandId') ?? '');
  const discountPct = Number(formData.get('discountPct'));
  if (!platformId || !brandId || !Number.isFinite(discountPct)) return;
  const num = (k: string) => {
    const v = Number(formData.get(k));
    return Number.isFinite(v) && v > 0 ? v : undefined;
  };
  await updateState((s) => {
    s.giftCardOffers.push({
      id: `${platformId}-${brandId}-${Date.now().toString(36)}`,
      platformId,
      brandId,
      discountPct,
      promoCode: String(formData.get('promoCode') ?? '').trim() || undefined,
      delivery: formData.get('delivery') === 'delayed' ? 'delayed' : 'instant',
      maxPerMonth: num('maxPerMonth'),
      minAmount: num('minAmount'),
      maxAmount: num('maxAmount'),
      feePct: num('feePct') ?? 0,
      source: 'user',
      verifiedAt: today(),
      sourceUrl: String(formData.get('sourceUrl') ?? '').trim() || undefined,
      sourceNote: String(formData.get('sourceNote') ?? '').trim() || 'Entered by user',
    });
  });
  revalidateAll();
}

export async function setOfferVerified(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const verified = formData.get('verified') === 'true';
  const discount = Number(formData.get('discountPct'));
  await updateState((s) => {
    const o = s.giftCardOffers.find((x) => x.id === id);
    if (!o) return;
    o.verifiedAt = verified ? today() : undefined;
    if (verified) {
      o.unconfirmed = false;
      o.discountUnknown = false;
      o.source = 'user';
    }
    if (verified && Number.isFinite(discount) && discount >= 0 && discount <= 100) o.discountPct = discount;
  });
  revalidateAll();
}

export async function deleteGiftCardOffer(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  await updateState((s) => {
    s.giftCardOffers = s.giftCardOffers.filter((o) => o.id !== id);
    s.hiddenOffers = [...new Set([...(s.hiddenOffers ?? []), id])];
  });
  revalidateAll();
}

// ---------- merchant offers ----------

export async function addMerchantOffer(formData: FormData): Promise<void> {
  const brandId = String(formData.get('brandId') ?? '');
  const pct = Number(formData.get('pct'));
  if (!brandId || !Number.isFinite(pct)) return;
  const channels = (['online', 'offline', 'upi'] as const).filter((c) => formData.get(`channel:${c}`) === 'on');
  const cardProductId = String(formData.get('cardProductId') ?? '') || undefined;
  const num = (k: string) => {
    const v = Number(formData.get(k));
    return Number.isFinite(v) && v > 0 ? v : undefined;
  };
  await updateState((s) => {
    s.merchantOffers.push({
      id: `${brandId}-${Date.now().toString(36)}`,
      brandId,
      cardProductId,
      kind: (String(formData.get('kind') ?? 'instant') as 'instant' | 'cashback' | 'coupon'),
      pct,
      cap: num('cap'),
      minSpend: num('minSpend'),
      channels: channels.length ? channels : ['online', 'offline'],
      code: String(formData.get('code') ?? '').trim() || undefined,
      validTill: String(formData.get('validTill') ?? '').trim() || undefined,
      source: 'user',
      verifiedAt: today(),
      sourceUrl: String(formData.get('sourceUrl') ?? '').trim() || undefined,
      sourceNote: String(formData.get('sourceNote') ?? '').trim() || 'Entered by user',
    });
  });
  revalidateAll();
}

export async function deleteMerchantOffer(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  await updateState((s) => {
    s.merchantOffers = s.merchantOffers.filter((o) => o.id !== id);
  });
  revalidateAll();
}

// ---------- strategies ----------

export async function setStrategyEnabled(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const enabled = formData.get('enabled') === 'true';
  await updateState((s) => {
    s.strategies[id] = enabled;
  });
  revalidateAll();
}
