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
import { fuzzyBrand, parseIntent, providerLabel, searchOffersOnline, type OfferSearchFailure, type OfferSearchResult, type ProviderName } from './llm';
import { getKnowledgeBase } from './kb';
import { slug, today, updateState } from './store';

export type RoutesResult =
  | { ok: true; brandName: string; intent: PurchaseIntent; routes: Route[]; parser?: ProviderName; parserLabel?: string; notes: string[] }
  | { ok: false; error: string; parser?: ProviderName; parserLabel?: string; notes: string[] };

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
  const brand = parsed.brandQuery ? fuzzyBrand(kb, parsed.brandQuery) : undefined;
  if (!brand) {
    const known = kb.brands.map((b) => b.name).join(', ');
    return {
      ok: false,
      parser,
      parserLabel,
      notes,
      error: parsed.brandQuery
        ? `I don't know "${parsed.brandQuery}" yet. Add it on the Offers page, or pick one of: ${known}.`
        : `Which shop or brand? I know: ${known}.`,
    };
  }
  if (!parsed.amount) {
    return { ok: false, parser, parserLabel, notes, error: `How much is the bill at ${brand.name}?` };
  }
  const channel: Channel = parsed.channel ?? 'offline';
  if (!parsed.channel) notes.push('Assumed you are paying at a physical store; say "online" if not.');
  const intent = PurchaseIntentSchema.parse({ brandId: brand.id, amount: parsed.amount, channel, inStoreNow: parsed.inStoreNow });
  const routes = findRoutes(kb, intent);
  return { ok: true, parser, parserLabel, brandName: brand.name, intent, routes, notes };
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
    if (verified && Number.isFinite(discount) && discount >= 0 && discount <= 100) o.discountPct = discount;
  });
  revalidateAll();
}

export async function deleteGiftCardOffer(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  await updateState((s) => {
    s.giftCardOffers = s.giftCardOffers.filter((o) => o.id !== id);
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
