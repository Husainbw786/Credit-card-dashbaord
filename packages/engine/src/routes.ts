import { computeReward, pointValueFor, type Hop, type RewardResult } from './rewards';
import type {
  Brand,
  CardProduct,
  Channel,
  GiftCardOffer,
  KnowledgeBase,
  MerchantOffer,
  MyCard,
  Platform,
  Provenance,
  PurchaseIntent,
  Strategy,
} from './types';

export type Severity = 'info' | 'medium' | 'low';
export interface Catch {
  severity: Severity;
  message: string;
}
export interface LineItem {
  label: string;
  /** Positive = you pay, negative = saving / value back. */
  amount: number;
}
export interface RouteStep {
  n: number;
  action: string;
  detail?: string;
}
export type Confidence = 'high' | 'medium' | 'low';

export interface Route {
  id: string;
  strategyId: string;
  title: string;
  cardId: string;
  cardName: string;
  platformId?: string;
  steps: RouteStep[];
  billAmount: number;
  /** Cash that leaves your card(s). */
  youPay: number;
  /** Card rewards, valued in ₹. */
  rewardsValue: number;
  /** Merchant cashback offers paid later. */
  offerCashback: number;
  /** Leftover gift card balance you keep for later. */
  retainedValue: number;
  effectiveCost: number;
  savingsPct: number;
  breakdown: LineItem[];
  catches: Catch[];
  confidence: Confidence;
  /** Can be executed on the spot (no delayed gift card delivery). */
  instant: boolean;
  /** Cost computed without a discount number; any real discount makes it cheaper. */
  discountUnknown: boolean;
}

export interface FindOptions {
  topN?: number;
  /** ISO date used for staleness checks; defaults to now. */
  today?: string;
  /** Facts verified more than this many days ago get a medium catch. */
  staleAfterDays?: number;
}

interface Ctx {
  kb: KnowledgeBase;
  intent: PurchaseIntent;
  brand: Brand;
  cardById: Map<string, CardProduct>;
  platformById: Map<string, Platform>;
  today: Date;
  staleAfterDays: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function fmtInr(n: number): string {
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(round2(n));
}

function daysBetween(iso: string, today: Date): number {
  const then = new Date(iso);
  return Math.floor((today.getTime() - then.getTime()) / 86_400_000);
}

function provenanceCatches(ctx: Ctx, what: string, p: Provenance): Catch[] {
  if (!p.verifiedAt) {
    return [{ severity: 'low', message: `${what} has no verification date; treat it as unconfirmed.` }];
  }
  const age = daysBetween(p.verifiedAt, ctx.today);
  if (age > ctx.staleAfterDays) {
    return [
      {
        severity: 'medium',
        message: `${what} was last verified ${age} days ago (${p.verifiedAt}); re-check before relying on it.`,
      },
    ];
  }
  return [];
}

function rewardLabel(card: CardProduct, r: RewardResult): string {
  if (!r.rule) return `${card.name}: no reward`;
  if (r.rule.kind === 'points') {
    return `${card.name}: ${round2(r.cappedUnits)} pts × ${fmtInr(r.pointValue ?? 0)} (${r.rule.name})`;
  }
  return `${card.name}: ${r.rule.name}`;
}

function rewardCatches(ctx: Ctx, card: CardProduct, my: MyCard, hop: Hop, r: RewardResult, where: string): Catch[] {
  const out: Catch[] = [];
  if (r.blockedBy) {
    out.push({ severity: 'info', message: `No reward from ${card.name} at ${where}: ${r.blockedBy}.` });
    return out;
  }
  if (r.rule) {
    out.push(...provenanceCatches(ctx, `${card.name} rule "${r.rule.name}"`, r.rule));
    if (hop.category === 'gift_card' && card.giftCardPurchases === 'unknown') {
      out.push({
        severity: 'medium',
        message: `Not verified that gift card purchases on ${where} earn rewards on ${card.name}; assumed "${r.rule.name}".`,
      });
    }
    if (r.rule.kind === 'points') {
      const pv = pointValueFor(card, my);
      out.push({
        severity: 'info',
        message: `${card.name} points valued at ${fmtInr(pv)}/pt${card.pointValueNotes ? ` (${card.pointValueNotes})` : ''}.`,
      });
    }
  }
  if (r.capLimited) {
    const unit = r.rule?.kind === 'points' ? 'pts' : '₹';
    if (r.cappedUnits === 0) {
      out.push({ severity: 'info', message: `${card.name} cap for "${r.rule?.name}" is exhausted this period; no reward.` });
    } else {
      out.push({
        severity: 'info',
        message: `${card.name} reward limited by cap: ${round2(r.cappedUnits)} of ${round2(r.rawUnits)} ${unit}` +
          (r.capRemaining !== undefined ? ` (cap remaining ${round2(r.capRemaining)} ${unit})` : '') + '.',
      });
    }
  }
  return out;
}

function confidenceFrom(catches: Catch[]): Confidence {
  if (catches.some((c) => c.severity === 'low')) return 'low';
  if (catches.some((c) => c.severity === 'medium')) return 'medium';
  return 'high';
}

function finalize(r: Omit<Route, 'effectiveCost' | 'savingsPct' | 'confidence'>): Route {
  const effectiveCost = round2(r.youPay - r.rewardsValue - r.offerCashback - r.retainedValue);
  const savingsPct = round2(((r.billAmount - effectiveCost) / r.billAmount) * 100);
  return { ...r, youPay: round2(r.youPay), rewardsValue: round2(r.rewardsValue), effectiveCost, savingsPct, confidence: confidenceFrom(r.catches) };
}

// ---------- direct payment ----------

function candidateChannels(ctx: Ctx, card: CardProduct): Channel[] {
  const { channel } = ctx.intent;
  const isRupay = card.network === 'rupay';
  if (channel === 'upi') return isRupay ? ['upi'] : [];
  if (channel === 'offline') return isRupay && ctx.brand.acceptsUpi ? ['offline', 'upi'] : ['offline'];
  return ['online'];
}

function applicableMerchantOffers(ctx: Ctx, card: CardProduct, channel: Channel): MerchantOffer[] {
  return ctx.kb.merchantOffers.filter((o) => {
    if (o.brandId !== ctx.brand.id) return false;
    if (!o.channels.includes(channel)) return false;
    if (o.validTill && new Date(o.validTill) < ctx.today) return false;
    if (o.minSpend !== undefined && ctx.intent.amount < o.minSpend) return false;
    if (o.cardProductId && o.cardProductId !== card.id) return false;
    if (o.issuer && o.issuer !== card.issuer) return false;
    return true;
  });
}

function buildDirect(ctx: Ctx, strategy: Strategy, my: MyCard, card: CardProduct, channel: Channel, offer?: MerchantOffer): Route {
  const { brand, intent } = ctx;
  const bill = intent.amount;
  const breakdown: LineItem[] = [{ label: `Bill at ${brand.name}`, amount: bill }];
  const catches: Catch[] = [];
  let pay = bill;
  let offerCashback = 0;
  if (offer) {
    const saving = Math.min((bill * offer.pct) / 100, offer.cap ?? Infinity);
    if (offer.kind === 'cashback') offerCashback = saving;
    else pay -= saving;
    breakdown.push({ label: `${offer.kind} offer ${offer.pct}%${offer.code ? ` (code ${offer.code})` : ''}`, amount: -saving });
    catches.push(...provenanceCatches(ctx, `Merchant offer "${offer.id}"`, offer));
    if (offer.unconfirmed) catches.push({ severity: 'medium', message: `This ${offer.kind} offer was found online${offer.verifiedAt ? ` on ${offer.verifiedAt}` : ''}; confirm it applies before paying.` });
  }
  const hop: Hop = { channel, category: brand.category, merchantId: brand.id, amount: pay };
  const reward = computeReward(card, my, hop);
  breakdown.push({ label: rewardLabel(card, reward), amount: -reward.value });
  catches.push(...rewardCatches(ctx, card, my, hop, reward, brand.name));

  const via = channel === 'upi' ? ' via UPI' : '';
  const steps: RouteStep[] = [
    {
      n: 1,
      action: `Pay ${fmtInr(pay)} at ${brand.name} with ${card.name}${via}` + (offer ? ` using the ${offer.pct}% ${offer.kind} offer` : ''),
      detail: reward.rule ? `${reward.rule.name} → ${fmtInr(reward.value)} back` : `no reward (${reward.blockedBy})`,
    },
  ];
  return finalize({
    id: `direct:${my.id}:${channel}${offer ? ':' + offer.id : ''}`,
    strategyId: strategy.id,
    title: `Pay ${brand.name} directly with ${card.name}${via}${offer ? ` + ${offer.pct}% ${offer.kind} offer` : ''}`,
    cardId: my.id,
    cardName: card.name,
    steps,
    billAmount: bill,
    youPay: pay,
    rewardsValue: reward.value,
    offerCashback,
    retainedValue: 0,
    breakdown,
    catches,
    instant: true,
    discountUnknown: false,
  });
}

function directRoutes(ctx: Ctx, strategy: Strategy): Route[] {
  const out: Route[] = [];
  for (const my of ctx.kb.myCards) {
    const card = ctx.cardById.get(my.cardProductId);
    if (!card) continue;
    let best: Route | undefined;
    for (const channel of candidateChannels(ctx, card)) {
      const offers: (MerchantOffer | undefined)[] = [undefined, ...applicableMerchantOffers(ctx, card, channel)];
      for (const offer of offers) {
        const r = buildDirect(ctx, strategy, my, card, channel, offer);
        if (!best || r.effectiveCost < best.effectiveCost) best = r;
      }
    }
    if (best) out.push(best);
  }
  return out;
}

// ---------- gift card ----------

/** Smallest multiset of denominations whose sum is >= need. */
export function coverWithDenominations(need: number, denominations: number[]): number[] | undefined {
  const denoms = [...new Set(denominations)].filter((d) => d > 0).sort((a, b) => a - b);
  if (!denoms.length) return undefined;
  const maxD = denoms[denoms.length - 1]!;
  const limit = need + maxD;
  const best = new Array<number>(limit + 1).fill(Infinity);
  const from = new Array<number>(limit + 1).fill(0);
  best[0] = 0;
  for (let a = 1; a <= limit; a++) {
    for (const d of denoms) {
      if (d > a) break;
      const prev = best[a - d]!;
      if (prev + 1 < best[a]!) {
        best[a] = prev + 1;
        from[a] = d;
      }
    }
  }
  for (let total = need; total <= limit; total++) {
    if (best[total]! < Infinity) {
      const pieces: number[] = [];
      let a = total;
      while (a > 0) {
        const d = from[a]!;
        pieces.push(d);
        a -= d;
      }
      return pieces.sort((x, y) => y - x);
    }
  }
  return undefined;
}

interface FacePlan {
  face: number;
  pieces: number[];
  remainder: number;
  leftover: number;
}

function planFaceValue(offer: GiftCardOffer, brand: Brand, amount: number): FacePlan {
  const need = Math.ceil(amount);
  const maxCards = brand.redemption.maxCardsPerBill ?? Number.POSITIVE_INFINITY;
  let pieces: number[];
  if (offer.denominations?.length) {
    pieces = coverWithDenominations(need, offer.denominations) ?? [];
    if (pieces.length > maxCards) pieces = pieces.slice(0, maxCards);
  } else {
    const perCard = offer.maxAmount ?? need;
    let n = Math.max(1, Math.ceil(need / perCard));
    if (n > maxCards) n = maxCards;
    const face = Math.min(need, n * perCard);
    pieces = [];
    let left = face;
    for (let i = 0; i < n; i++) {
      const piece = Math.min(perCard, left);
      pieces.push(piece);
      left -= piece;
    }
    if (offer.minAmount && pieces.length === 1 && pieces[0]! < offer.minAmount) pieces = [offer.minAmount];
  }
  const face = pieces.reduce((s, p) => s + p, 0);
  return { face, pieces, remainder: Math.max(0, need - face), leftover: Math.max(0, face - need) };
}

function buildGiftCard(ctx: Ctx, strategy: Strategy, offer: GiftCardOffer, platform: Platform, my: MyCard, card: CardProduct, plan: FacePlan): Route {
  const { brand, intent, kb } = ctx;
  const bill = intent.amount;
  const breakdown: LineItem[] = [{ label: `Bill at ${brand.name}`, amount: bill }];
  const catches: Catch[] = [];

  const gcDiscount = (plan.face * offer.discountPct) / 100;
  const bonus = kb.platformCardBonuses.find((b) => b.platformId === platform.id && b.cardProductId === card.id);
  const bonusAmt = bonus ? Math.min((plan.face * bonus.extraDiscountPct) / 100, bonus.cap ?? Infinity) : 0;
  const fees = ((plan.face - gcDiscount - bonusAmt) * offer.feePct) / 100 + offer.feeFlat;
  const gcPay = plan.face - gcDiscount - bonusAmt + fees;

  if (plan.face !== bill) breakdown.push({ label: `Gift card face value (${plan.pieces.length} card${plan.pieces.length > 1 ? 's' : ''})`, amount: plan.face - bill });
  breakdown.push({ label: `${platform.name} discount ${offer.discountPct}%${offer.promoCode ? ` (code ${offer.promoCode})` : ''}`, amount: -gcDiscount });
  if (bonusAmt) breakdown.push({ label: `${platform.name} extra ${bonus!.extraDiscountPct}% with ${card.name}`, amount: -bonusAmt });
  if (fees) breakdown.push({ label: `${platform.name} fees`, amount: fees });

  const gcHop: Hop = { channel: 'online', category: 'gift_card', merchantId: platform.id, amount: gcPay };
  const gcReward = computeReward(card, my, gcHop);
  breakdown.push({ label: rewardLabel(card, gcReward), amount: -gcReward.value });
  catches.push(...rewardCatches(ctx, card, my, gcHop, gcReward, platform.name));

  let remainderReward: RewardResult = { rawUnits: 0, cappedUnits: 0, value: 0, capLimited: false };
  if (plan.remainder > 0) {
    const ch: Channel = intent.channel === 'upi' && card.network !== 'rupay' ? 'offline' : intent.channel;
    const hop: Hop = { channel: ch, category: brand.category, merchantId: brand.id, amount: plan.remainder };
    remainderReward = computeReward(card, my, hop);
    breakdown.push({ label: `Remainder ${fmtInr(plan.remainder)} paid directly`, amount: 0 });
    breakdown.push({ label: rewardLabel(card, remainderReward), amount: -remainderReward.value });
    catches.push(...rewardCatches(ctx, card, my, hop, remainderReward, brand.name));
  }
  if (plan.leftover > 0) {
    breakdown.push({ label: 'Leftover gift card balance (kept for later)', amount: -plan.leftover });
    catches.push({ severity: 'info', message: `${fmtInr(plan.leftover)} stays on the gift card; use it before it expires${brand.redemption.validityDays ? ` (${brand.redemption.validityDays} days)` : ''}.` });
  }

  // Offer + redemption catches
  if (offer.discountUnknown) {
    catches.push({ severity: 'medium', message: `${brand.name} is listed on ${platform.name} but the current discount has not been checked; cost shown at 0% off. Any discount makes this route cheaper.` });
  } else {
    catches.push(...provenanceCatches(ctx, `${platform.name} ${brand.name} gift card discount`, offer));
    if (offer.unconfirmed) catches.push({ severity: 'medium', message: `${offer.discountPct}% on ${platform.name} was found online${offer.verifiedAt ? ` on ${offer.verifiedAt}` : ''}; confirm it on the platform before buying.` });
  }
  // Online redemption of a brand e-gift card is standard; store acceptance is what needs checking.
  if (intent.channel !== 'online') catches.push(...provenanceCatches(ctx, `${brand.name} gift card redemption rules`, brand.redemption));
  if (intent.channel !== 'online' && brand.redemption.offlineStores === 'select') {
    catches.push({ severity: 'medium', message: `Only select ${brand.name} stores accept gift cards; confirm with this store before buying.` });
  }
  if (brand.redemption.stackableWithSale === false) {
    catches.push({ severity: 'info', message: `${brand.name} gift cards may not apply to sale or discounted items.` });
  }
  if (offer.maxPerMonth !== undefined && plan.face > offer.maxPerMonth) {
    catches.push({ severity: 'medium', message: `${platform.name} limits ${brand.name} gift cards to ${fmtInr(offer.maxPerMonth)} per month; this needs ${fmtInr(plan.face)}.` });
  }
  if (offer.delivery !== 'instant') {
    catches.push({ severity: 'info', message: `${platform.name} delivery is not instant; buy before you go to the store.` });
  }
  if (bonus) catches.push(...provenanceCatches(ctx, `${platform.name} bonus for ${card.name}`, bonus));

  const steps: RouteStep[] = [];
  const piecesText = plan.pieces.length > 1 ? ` as ${plan.pieces.length} cards (${plan.pieces.map(fmtInr).join(' + ')})` : '';
  steps.push({
    n: 1,
    action: `Buy ${fmtInr(plan.face)} ${brand.name} gift card on ${platform.name}${piecesText}${offer.discountUnknown ? ' (check the discount there)' : ` at ${offer.discountPct}% off`} → pay ${fmtInr(gcPay)} with ${card.name}` + (offer.promoCode ? ` (code ${offer.promoCode})` : ''),
    detail: gcReward.rule ? `${gcReward.rule.name} → ${fmtInr(gcReward.value)} back` : `no reward (${gcReward.blockedBy})`,
  });
  steps.push({
    n: 2,
    action: intent.channel === 'online'
      ? `Check out on ${brand.name} online and apply the gift card code`
      : `At ${brand.name}, share the gift card code and PIN with the cashier at billing`,
    detail: `covers ${fmtInr(Math.min(plan.face, bill))} of the bill`,
  });
  if (plan.remainder > 0) {
    steps.push({ n: 3, action: `Pay the remaining ${fmtInr(plan.remainder)} with ${card.name}`, detail: remainderReward.rule ? `${remainderReward.rule.name} → ${fmtInr(remainderReward.value)} back` : `no reward (${remainderReward.blockedBy})` });
  }

  return finalize({
    id: `gc:${offer.id}:${my.id}`,
    strategyId: strategy.id,
    title: `${platform.name} gift card (${offer.discountUnknown ? 'discount not checked' : `${offer.discountPct}% off`}) paid with ${card.name}`,
    cardId: my.id,
    cardName: card.name,
    platformId: platform.id,
    steps,
    billAmount: bill,
    youPay: gcPay + plan.remainder,
    rewardsValue: gcReward.value + remainderReward.value,
    offerCashback: 0,
    retainedValue: plan.leftover,
    breakdown,
    catches,
    instant: offer.delivery === 'instant',
    discountUnknown: offer.discountUnknown,
  });
}

function giftCardRoutes(ctx: Ctx, strategy: Strategy): Route[] {
  const { kb, brand, intent } = ctx;
  const out: Route[] = [];
  const concrete = new Set(kb.giftCardOffers.filter((o) => o.brandId === brand.id && !o.discountUnknown).map((o) => o.platformId));
  for (const offer of kb.giftCardOffers) {
    if (offer.brandId !== brand.id) continue;
    if (offer.discountUnknown && concrete.has(offer.platformId)) continue;
    const platform = ctx.platformById.get(offer.platformId);
    if (!platform) continue;
    if (offer.validTill && new Date(offer.validTill) < ctx.today) continue;
    if (intent.channel === 'online' && !brand.redemption.online) continue;
    if (intent.channel !== 'online' && brand.redemption.offlineStores === 'none') continue;
    if (intent.inStoreNow && offer.delivery !== 'instant') continue;
    const plan = planFaceValue(offer, brand, intent.amount);
    if (plan.face <= 0) continue;
    for (const my of kb.myCards) {
      const card = ctx.cardById.get(my.cardProductId);
      if (!card) continue;
      out.push(buildGiftCard(ctx, strategy, offer, platform, my, card, plan));
    }
  }
  return out;
}

// ---------- entry point ----------

export function findRoutes(kb: KnowledgeBase, intent: PurchaseIntent, opts: FindOptions = {}): Route[] {
  const brand = kb.brands.find((b) => b.id === intent.brandId);
  if (!brand) throw new Error(`Unknown brand "${intent.brandId}"`);
  const ctx: Ctx = {
    kb,
    intent,
    brand,
    cardById: new Map(kb.cards.map((c) => [c.id, c])),
    platformById: new Map(kb.platforms.map((p) => [p.id, p])),
    today: opts.today ? new Date(opts.today) : new Date(),
    staleAfterDays: opts.staleAfterDays ?? 60,
  };
  const routes: Route[] = [];
  for (const strategy of kb.strategies) {
    if (!strategy.enabled) continue;
    if (strategy.kind === 'direct') routes.push(...directRoutes(ctx, strategy));
    else if (strategy.kind === 'gift_card') routes.push(...giftCardRoutes(ctx, strategy));
  }
  routes.sort(
    (a, b) =>
      a.effectiveCost - b.effectiveCost ||
      Number(b.discountUnknown) - Number(a.discountUnknown) ||
      a.steps.length - b.steps.length ||
      a.title.localeCompare(b.title),
  );
  return opts.topN ? routes.slice(0, opts.topN) : routes;
}

/** Find a brand by id, name, or alias (case-insensitive). */
export function resolveBrand(kb: KnowledgeBase, query: string): Brand | undefined {
  const q = query.trim().toLowerCase();
  return kb.brands.find((b) => b.id === q || b.name.toLowerCase() === q || b.aliases.some((a) => a.toLowerCase() === q));
}
