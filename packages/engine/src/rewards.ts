import type { CardProduct, Category, Channel, MyCard, RewardRule } from './types.js';

/** One place where a card gets charged. */
export interface Hop {
  channel: Channel;
  category: Category;
  merchantId: string;
  amount: number;
}

export interface RewardResult {
  rule?: RewardRule;
  /** ₹ for cashback rules, points for points rules, before any cap. */
  rawUnits: number;
  /** After per-transaction and period caps. */
  cappedUnits: number;
  /** Rupee value after converting points. */
  value: number;
  pointValue?: number;
  capLimited: boolean;
  capRemaining?: number;
  /** Set when the spend earns nothing, with the reason. */
  blockedBy?: string;
}

const ZERO: RewardResult = { rawUnits: 0, cappedUnits: 0, value: 0, capLimited: false };

function listIncludes<T>(list: T[] | undefined, value: T): boolean {
  return list === undefined || list.includes(value);
}

/** Returns the reason this hop never earns on the card, if any. */
export function neverEarnReason(card: CardProduct, hop: Hop): string | undefined {
  if (hop.category === 'gift_card' && card.giftCardPurchases === 'excluded') {
    return 'gift card purchases are excluded from rewards';
  }
  for (const n of card.neverEarn) {
    const catOk = n.categories ? n.categories.includes(hop.category) : true;
    const merchOk = n.merchants ? n.merchants.includes(hop.merchantId) : true;
    const chanOk = n.channels ? n.channels.includes(hop.channel) : true;
    if (catOk && merchOk && chanOk) {
      return n.reason ?? `${hop.category} spends are excluded`;
    }
  }
  return undefined;
}

export function pickRule(card: CardProduct, my: MyCard, hop: Hop): RewardRule | undefined {
  const candidates = card.rules.filter((r) => {
    if (!r.enabled) return false;
    if (!listIncludes(r.channels, hop.channel)) return false;
    if (!listIncludes(r.merchants, hop.merchantId)) return false;
    if (!listIncludes(r.categories, hop.category)) return false;
    if (r.excludedCategories?.includes(hop.category)) return false;
    if (r.minTxn !== undefined && hop.amount < r.minTxn) return false;
    if (r.requiresFlags) {
      for (const [flag, want] of Object.entries(r.requiresFlags)) {
        if ((my.flags[flag] ?? false) !== want) return false;
      }
    }
    return true;
  });
  candidates.sort((a, b) => b.priority - a.priority || b.rate - a.rate);
  return candidates[0];
}

export function pointValueFor(card: CardProduct, my: MyCard): number {
  return my.pointValueOverride ?? card.pointValue ?? 0;
}

/** Reward the card gives for charging this hop, after caps and exclusions. */
export function computeReward(card: CardProduct, my: MyCard, hop: Hop): RewardResult {
  const blocked = neverEarnReason(card, hop);
  if (blocked) return { ...ZERO, blockedBy: blocked };
  const rule = pickRule(card, my, hop);
  if (!rule) return { ...ZERO, blockedBy: 'no reward rule matches this spend' };

  const rawUnits = rule.rate * hop.amount;
  let cappedUnits = rawUnits;
  let capLimited = false;
  let capRemaining: number | undefined;

  if (rule.perTxnCap !== undefined && cappedUnits > rule.perTxnCap) {
    cappedUnits = rule.perTxnCap;
    capLimited = true;
  }
  if (rule.capGroup) {
    const group = card.capGroups[rule.capGroup];
    if (group) {
      const used = my.capUsed[rule.capGroup] ?? 0;
      capRemaining = Math.max(0, group.limit - used);
      if (cappedUnits > capRemaining) {
        cappedUnits = capRemaining;
        capLimited = true;
      }
    }
  }
  const pointValue = rule.kind === 'points' ? pointValueFor(card, my) : undefined;
  const value = rule.kind === 'points' ? cappedUnits * (pointValue ?? 0) : cappedUnits;
  return { rule, rawUnits, cappedUnits, value, pointValue, capLimited, capRemaining };
}
