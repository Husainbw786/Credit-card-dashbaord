import { describe, expect, it } from 'vitest';
import { loadKnowledgeBase } from '../src/data/index';
import { computeReward } from '../src/rewards';
import { coverWithDenominations, findRoutes } from '../src/routes';
import type { KnowledgeBase } from '../src/types';

const TODAY = '2026-10-22';

function card(kb: KnowledgeBase, id: string) {
  const c = kb.cards.find((x) => x.id === id);
  const m = kb.myCards.find((x) => x.cardProductId === id);
  if (!c || !m) throw new Error(`missing ${id}`);
  return { c, m };
}

describe('Giva showroom example', () => {
  const kb = loadKnowledgeBase();
  const routes = findRoutes(kb, { brandId: 'giva', amount: 10_000, channel: 'offline', inStoreNow: true }, { today: TODAY });

  it('ranks Gyftr gift card + Cashback SBI Card first at ₹8,265', () => {
    const top = routes[0]!;
    expect(top.strategyId).toBe('gift_card');
    expect(top.platformId).toBe('gyftr');
    expect(top.cardId).toBe('my-sbi-cashback');
    expect(top.youPay).toBe(8700);
    expect(top.rewardsValue).toBe(435);
    expect(top.effectiveCost).toBe(8265);
    expect(top.savingsPct).toBe(17.35);
    expect(top.confidence).toBe('high');
    expect(top.instant).toBe(true);
    expect(top.steps.map((s) => s.n)).toEqual([1, 2]);
  });

  it('puts SimplyCLICK (5X on Gyftr) second', () => {
    const second = routes[1]!;
    expect(second.cardId).toBe('my-sbi-simplyclick');
    expect(second.rewardsValue).toBe(108.75);
    expect(second.effectiveCost).toBe(8591.25);
  });

  it('gives Swiggy HDFC nothing on the gift card purchase', () => {
    const r = routes.find((x) => x.strategyId === 'gift_card' && x.cardId === 'my-hdfc-swiggy')!;
    expect(r.rewardsValue).toBe(0);
    expect(r.effectiveCost).toBe(8700);
    expect(r.catches.some((c) => c.message.includes('gift card purchases are excluded'))).toBe(true);
  });

  it('pays no cashback for jewellery directly on Cashback SBI Card', () => {
    const r = routes.find((x) => x.strategyId === 'direct' && x.cardId === 'my-sbi-cashback')!;
    expect(r.rewardsValue).toBe(0);
    expect(r.effectiveCost).toBe(10_000);
  });

  it('gives the RuPay card 1% in Jewels at the showroom (card or UPI)', () => {
    const r = routes.find((x) => x.strategyId === 'direct' && x.cardId === 'my-jupiter-edge-plus')!;
    expect(r.rewardsValue).toBe(100); // 5 Jewels/₹100 × ₹0.20
    expect(r.effectiveCost).toBe(9900);
  });

  it('every gift card route beats every direct route', () => {
    const worstGc = Math.max(...routes.filter((r) => r.strategyId === 'gift_card').map((r) => r.effectiveCost));
    const bestDirect = Math.min(...routes.filter((r) => r.strategyId === 'direct').map((r) => r.effectiveCost));
    expect(worstGc).toBeLessThan(bestDirect);
  });
});

describe('caps and flags', () => {
  it('limits SBI cashback to the remaining monthly cap', () => {
    const kb = loadKnowledgeBase();
    const { c, m } = card(kb, 'sbi-cashback');
    m.capUsed.online = 1900;
    const r = computeReward(c, m, { channel: 'online', category: 'gift_card', merchantId: 'gyftr', amount: 8700 });
    expect(r.rawUnits).toBe(435);
    expect(r.cappedUnits).toBe(100);
    expect(r.capLimited).toBe(true);
    const routes = findRoutes(kb, { brandId: 'giva', amount: 10_000, channel: 'offline', inStoreNow: false }, { today: TODAY });
    const top = routes[0]!;
    expect(top.cardId).toBe('my-sbi-simplyclick'); // SBI Cashback drops to ₹8,600 and loses the top spot
    const sbi = routes.find((x) => x.cardId === 'my-sbi-cashback' && x.strategyId === 'gift_card')!;
    expect(sbi.effectiveCost).toBe(8600);
    expect(sbi.catches.some((x) => x.message.includes('limited by cap'))).toBe(true);
  });

  it('applies the per-transaction cap on Jupiter shopping', () => {
    const kb = loadKnowledgeBase();
    const { c, m } = card(kb, 'jupiter-edge-plus');
    const r = computeReward(c, m, { channel: 'online', category: 'general', merchantId: 'amazon', amount: 5000 });
    expect(r.rawUnits).toBe(2500);
    expect(r.cappedUnits).toBe(1000);
    expect(r.value).toBe(200);
  });

  it('switches Amazon Pay ICICI between Prime and non-Prime rates', () => {
    const kb = loadKnowledgeBase();
    const { c, m } = card(kb, 'amazon-pay-icici');
    const hop = { channel: 'online' as const, category: 'general' as const, merchantId: 'amazon', amount: 1000 };
    expect(computeReward(c, m, hop).value).toBe(50);
    m.flags.prime = false;
    expect(computeReward(c, m, hop).value).toBe(30);
  });

  it('gives nothing for Flipkart gift cards on Flipkart Axis but 1% elsewhere', () => {
    const kb = loadKnowledgeBase();
    const { c, m } = card(kb, 'flipkart-axis');
    expect(computeReward(c, m, { channel: 'online', category: 'gift_card', merchantId: 'flipkart', amount: 1000 }).value).toBe(0);
    expect(computeReward(c, m, { channel: 'online', category: 'gift_card', merchantId: 'gyftr', amount: 1000 }).value).toBe(10);
  });
});

describe('platform comparison and catches', () => {
  it('prefers the platform with the deeper discount and flags unverified ones', () => {
    const kb = loadKnowledgeBase();
    kb.giftCardOffers.push({ id: 'magicpin-giva', platformId: 'magicpin', brandId: 'giva', discountPct: 16, feePct: 0, feeFlat: 0, delivery: 'instant', source: 'user', unconfirmed: false, discountUnknown: false });
    const routes = findRoutes(kb, { brandId: 'giva', amount: 10_000, channel: 'offline', inStoreNow: false }, { today: TODAY });
    expect(routes[0]!.platformId).toBe('magicpin');
    expect(routes[0]!.effectiveCost).toBe(7980);
    expect(routes[0]!.confidence).toBe('low'); // no verifiedAt on the Magicpin offer
  });

  it('hides delayed-delivery offers when in store now', () => {
    const kb = loadKnowledgeBase();
    kb.giftCardOffers.push({ id: 'woohoo-giva', platformId: 'woohoo', brandId: 'giva', discountPct: 20, feePct: 0, feeFlat: 0, delivery: 'delayed', verifiedAt: TODAY, source: 'user', unconfirmed: false, discountUnknown: false });
    const now = findRoutes(kb, { brandId: 'giva', amount: 10_000, channel: 'offline', inStoreNow: true }, { today: TODAY });
    expect(now.some((r) => r.platformId === 'woohoo')).toBe(false);
    const later = findRoutes(kb, { brandId: 'giva', amount: 10_000, channel: 'offline', inStoreNow: false }, { today: TODAY });
    expect(later[0]!.platformId).toBe('woohoo');
    expect(later[0]!.instant).toBe(false);
  });

  it('marks stale facts', () => {
    const kb = loadKnowledgeBase();
    kb.giftCardOffers[0]!.verifiedAt = '2026-01-01';
    const routes = findRoutes(kb, { brandId: 'giva', amount: 10_000, channel: 'offline', inStoreNow: false }, { today: TODAY });
    expect(routes[0]!.confidence).toBe('medium');
    expect(routes[0]!.catches.some((c) => c.message.includes('last verified'))).toBe(true);
  });

  it('skips gift cards for online-only brands when buying offline', () => {
    const kb = loadKnowledgeBase();
    kb.giftCardOffers.push({ id: 'gyftr-myntra', platformId: 'gyftr', brandId: 'myntra', discountPct: 10, feePct: 0, feeFlat: 0, delivery: 'instant', verifiedAt: TODAY, source: 'user', unconfirmed: false, discountUnknown: false });
    const offline = findRoutes(kb, { brandId: 'myntra', amount: 3000, channel: 'offline', inStoreNow: false }, { today: TODAY });
    expect(offline.every((r) => r.strategyId === 'direct')).toBe(true);
    const online = findRoutes(kb, { brandId: 'myntra', amount: 3000, channel: 'online', inStoreNow: false }, { today: TODAY });
    expect(online[0]!.strategyId).toBe('gift_card');
  });

  it('handles denominations, leftover balance and remainder', () => {
    expect(coverWithDenominations(1200, [500, 1000])).toEqual([1000, 500]);
    expect(coverWithDenominations(1000, [500, 1000])).toEqual([1000]);
    const kb = loadKnowledgeBase();
    kb.giftCardOffers[0]!.denominations = [500, 1000, 2000];
    const routes = findRoutes(kb, { brandId: 'giva', amount: 2700, channel: 'offline', inStoreNow: false }, { today: TODAY });
    const top = routes[0]!;
    expect(top.retainedValue).toBe(300);
    expect(top.catches.some((c) => c.message.includes('stays on the gift card'))).toBe(true);
    kb.giftCardOffers[0]!.denominations = undefined;
    kb.giftCardOffers[0]!.maxAmount = 5000;
    kb.brands.find((b) => b.id === 'giva')!.redemption.maxCardsPerBill = 1;
    const capped = findRoutes(kb, { brandId: 'giva', amount: 8000, channel: 'offline', inStoreNow: false }, { today: TODAY })[0]!;
    expect(capped.steps).toHaveLength(3);
    expect(capped.youPay).toBe(5000 * 0.87 + 3000);
  });
});

describe('seeded brands and partner rates', () => {
  it('parses the seed and keeps brand ids unique', () => {
    const kb = loadKnowledgeBase();
    const ids = kb.brands.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(40);
  });

  it("gives SimplyCLICK 10X on Domino's online and Swiggy HDFC 10% on Swiggy", () => {
    const kb = loadKnowledgeBase();
    const dominos = findRoutes(kb, { brandId: 'dominos', amount: 700, channel: 'online', inStoreNow: false }, { today: TODAY });
    const sc = dominos.find((r) => r.cardId === 'my-sbi-simplyclick')!;
    expect(sc.rewardsValue).toBe(17.5); // 10 pts per ₹100 × ₹0.25
    const swiggy = findRoutes(kb, { brandId: 'swiggy', amount: 1000, channel: 'online', inStoreNow: false }, { today: TODAY });
    expect(swiggy[0]!.cardId).toBe('my-hdfc-swiggy');
    expect(swiggy[0]!.rewardsValue).toBe(100);
  });
});

describe('unknown-discount catalogue rows', () => {
  it("proposes Gyftr + Cashback SBI Card for Domino's online even without a discount number", () => {
    const kb = loadKnowledgeBase();
    const routes = findRoutes(kb, { brandId: 'dominos', amount: 700, channel: 'online', inStoreNow: false }, { today: TODAY });
    const top = routes[0]!;
    expect(top.strategyId).toBe('gift_card');
    expect(top.platformId).toBe('gyftr');
    expect(top.cardId).toBe('my-sbi-cashback');
    expect(top.discountUnknown).toBe(true);
    expect(top.effectiveCost).toBe(665); // 0% discount, 5% online cashback
    expect(top.title).toContain('discount not checked');
    expect(top.catches.some((c) => c.message.includes('not been checked'))).toBe(true);
  });

  it('hides the catalogue row once a real discount is known for that platform', () => {
    const kb = loadKnowledgeBase();
    kb.giftCardOffers.push({ id: 'gyftr-dominos-live', platformId: 'gyftr', brandId: 'dominos', discountPct: 10, feePct: 0, feeFlat: 0, delivery: 'instant', verifiedAt: TODAY, source: 'auto', unconfirmed: true, discountUnknown: false });
    const routes = findRoutes(kb, { brandId: 'dominos', amount: 700, channel: 'online', inStoreNow: false }, { today: TODAY });
    const gyftr = routes.filter((r) => r.platformId === 'gyftr' && r.cardId === 'my-sbi-cashback');
    expect(gyftr).toHaveLength(1);
    expect(gyftr[0]!.effectiveCost).toBe(598.5); // 700 × 0.9 × 0.95
    expect(gyftr[0]!.confidence).toBe('medium');
    expect(gyftr[0]!.catches.some((c) => c.message.includes('found online'))).toBe(true);
  });

  it('keeps Giva at 14 routes (no catalogue row for a brand with a real offer)', () => {
    const kb = loadKnowledgeBase();
    const routes = findRoutes(kb, { brandId: 'giva', amount: 10_000, channel: 'offline', inStoreNow: false }, { today: TODAY });
    expect(routes).toHaveLength(14);
  });
});
