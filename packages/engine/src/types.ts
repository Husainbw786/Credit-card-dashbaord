import { z } from 'zod';

/**
 * Core schemas for the deal engine. Seed data is written against the *input*
 * types (defaults optional) and parsed once into the full types.
 */

export const ChannelSchema = z.enum(['online', 'offline', 'upi']);
export type Channel = z.infer<typeof ChannelSchema>;

export const CategorySchema = z.enum([
  'general',
  'jewellery',
  'fashion',
  'electronics',
  'grocery',
  'food_delivery',
  'dining',
  'travel',
  'pharmacy',
  'entertainment',
  'beauty',
  'home',
  'gift_card',
  'wallet_load',
  'fuel',
  'rent',
  'utilities',
  'insurance',
  'education',
  'government',
  'gaming',
  'railways',
  'tolls',
  'emi',
  'cash',
  'forex',
]);
export type Category = z.infer<typeof CategorySchema>;

export const NetworkSchema = z.enum(['visa', 'mastercard', 'rupay', 'amex', 'diners']);
export type Network = z.infer<typeof NetworkSchema>;

/** Every fact carries where it came from and when it was last checked. */
const provenance = {
  verifiedAt: z.string().optional(), // ISO date, e.g. 2026-10-22
  sourceUrl: z.string().optional(),
  sourceNote: z.string().optional(),
  notes: z.string().optional(),
};
export type Provenance = { verifiedAt?: string; sourceUrl?: string; sourceNote?: string; notes?: string };

export const RewardRuleSchema = z.object({
  ...provenance,
  id: z.string(),
  name: z.string(),
  kind: z.enum(['cashback', 'points']),
  /** cashback: fraction of spend (0.05 = 5%). points: points per rupee (0.1 = 10 pts per ₹100). */
  rate: z.number().nonnegative(),
  /** Channels the card is charged on. Undefined = any. */
  channels: z.array(ChannelSchema).optional(),
  /** Merchant / platform ids this rule is limited to. Undefined = any. */
  merchants: z.array(z.string()).optional(),
  /** Merchant categories this rule is limited to. Undefined = any. */
  categories: z.array(CategorySchema).optional(),
  /** Categories that fall through to the next rule. */
  excludedCategories: z.array(CategorySchema).optional(),
  /** Name of a cap group on the card (shared monthly/quarterly limit). */
  capGroup: z.string().optional(),
  /** Max reward per transaction, in the rule's unit (₹ for cashback, points for points). */
  perTxnCap: z.number().positive().optional(),
  minTxn: z.number().nonnegative().optional(),
  /** Higher wins when several rules match. */
  priority: z.number().int().default(0),
  /** Rule applies only when the user's card has these flags, e.g. { prime: true }. */
  requiresFlags: z.record(z.boolean()).optional(),
  enabled: z.boolean().default(true),
});
export type RewardRule = z.infer<typeof RewardRuleSchema>;
export type RewardRuleInput = z.input<typeof RewardRuleSchema>;

/** A matcher for spends that never earn anything on the card. */
export const NeverEarnSchema = z.object({
  categories: z.array(CategorySchema).optional(),
  merchants: z.array(z.string()).optional(),
  channels: z.array(ChannelSchema).optional(),
  reason: z.string().optional(),
});
export type NeverEarn = z.infer<typeof NeverEarnSchema>;

export const CapGroupSchema = z.object({
  limit: z.number().positive(),
  unit: z.enum(['rupees', 'points']).default('rupees'),
  period: z.enum(['month', 'quarter', 'year']).default('month'),
});
export type CapGroup = z.infer<typeof CapGroupSchema>;

export const CardProductSchema = z.object({
  ...provenance,
  id: z.string(),
  issuer: z.string(),
  name: z.string(),
  network: NetworkSchema,
  annualFee: z.number().nonnegative().optional(),
  feeWaiverSpend: z.number().nonnegative().optional(),
  /** ₹ per point for points cards. */
  pointValue: z.number().positive().optional(),
  pointValueNotes: z.string().optional(),
  neverEarn: z.array(NeverEarnSchema).default([]),
  /** Whether buying a gift card (on a gift card platform) earns this card's normal reward. */
  giftCardPurchases: z.enum(['earns', 'excluded', 'unknown']).default('unknown'),
  capGroups: z.record(CapGroupSchema).default({}),
  rules: z.array(RewardRuleSchema),
});
export type CardProduct = z.infer<typeof CardProductSchema>;
export type CardProductInput = z.input<typeof CardProductSchema>;

export const MyCardSchema = z.object({
  id: z.string(),
  cardProductId: z.string(),
  nickname: z.string().optional(),
  /** Reward already earned this period, by cap group, in that group's unit. */
  capUsed: z.record(z.number().nonnegative()).default({}),
  pointValueOverride: z.number().positive().optional(),
  flags: z.record(z.boolean()).default({}),
});
export type MyCard = z.infer<typeof MyCardSchema>;
export type MyCardInput = z.input<typeof MyCardSchema>;

export const PlatformSchema = z.object({
  ...provenance,
  id: z.string(),
  name: z.string(),
  type: z.enum(['gift_card', 'portal', 'marketplace', 'wallet']),
  url: z.string().optional(),
});
export type Platform = z.infer<typeof PlatformSchema>;
export type PlatformInput = z.input<typeof PlatformSchema>;

export const RedemptionSchema = z.object({
  ...provenance,
  online: z.boolean(),
  offlineStores: z.enum(['all', 'select', 'none']),
  partial: z.boolean().default(true),
  stackableWithSale: z.boolean().optional(),
  maxCardsPerBill: z.number().int().positive().optional(),
  validityDays: z.number().int().positive().optional(),
});
export type Redemption = z.infer<typeof RedemptionSchema>;

export const BrandSchema = z.object({
  ...provenance,
  id: z.string(),
  name: z.string(),
  category: CategorySchema,
  acceptsUpi: z.boolean().default(true),
  aliases: z.array(z.string()).default([]),
  /** Channel assumed when the user does not say where they are buying. */
  defaultChannel: ChannelSchema.optional(),
  redemption: RedemptionSchema,
});
export type Brand = z.infer<typeof BrandSchema>;
export type BrandInput = z.input<typeof BrandSchema>;

export const GiftCardOfferSchema = z.object({
  ...provenance,
  id: z.string(),
  platformId: z.string(),
  brandId: z.string(),
  discountPct: z.number().min(0).max(100),
  feePct: z.number().min(0).default(0),
  feeFlat: z.number().min(0).default(0),
  promoCode: z.string().optional(),
  denominations: z.array(z.number().positive()).optional(),
  minAmount: z.number().positive().optional(),
  maxAmount: z.number().positive().optional(),
  /** Platform limit on how much of this brand you can buy per month. */
  maxPerMonth: z.number().positive().optional(),
  delivery: z.enum(['instant', 'delayed']).default('instant'),
  validTill: z.string().optional(),
});
export type GiftCardOffer = z.infer<typeof GiftCardOfferSchema>;
export type GiftCardOfferInput = z.input<typeof GiftCardOfferSchema>;

/** Extra discount a platform gives when you pay with a specific card. */
export const PlatformCardBonusSchema = z.object({
  ...provenance,
  id: z.string(),
  platformId: z.string(),
  cardProductId: z.string(),
  extraDiscountPct: z.number().min(0).max(100),
  cap: z.number().positive().optional(),
  promoCode: z.string().optional(),
});
export type PlatformCardBonus = z.infer<typeof PlatformCardBonusSchema>;
export type PlatformCardBonusInput = z.input<typeof PlatformCardBonusSchema>;

export const MerchantOfferSchema = z.object({
  ...provenance,
  id: z.string(),
  brandId: z.string(),
  cardProductId: z.string().optional(),
  issuer: z.string().optional(),
  kind: z.enum(['instant', 'cashback', 'coupon']),
  pct: z.number().min(0).max(100),
  cap: z.number().positive().optional(),
  minSpend: z.number().nonnegative().optional(),
  channels: z.array(ChannelSchema),
  validTill: z.string().optional(),
  code: z.string().optional(),
});
export type MerchantOffer = z.infer<typeof MerchantOfferSchema>;
export type MerchantOfferInput = z.input<typeof MerchantOfferSchema>;

export const StrategySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['direct', 'gift_card']),
  enabled: z.boolean().default(true),
  description: z.string().optional(),
});
export type Strategy = z.infer<typeof StrategySchema>;
export type StrategyInput = z.input<typeof StrategySchema>;

export const PurchaseIntentSchema = z.object({
  brandId: z.string(),
  amount: z.number().positive(),
  channel: ChannelSchema,
  /** Only show routes you can execute right now (instant gift card delivery). */
  inStoreNow: z.boolean().default(false),
  city: z.string().optional(),
});
export type PurchaseIntent = z.infer<typeof PurchaseIntentSchema>;
export type PurchaseIntentInput = z.input<typeof PurchaseIntentSchema>;

export const KnowledgeBaseSchema = z.object({
  cards: z.array(CardProductSchema),
  myCards: z.array(MyCardSchema),
  platforms: z.array(PlatformSchema),
  brands: z.array(BrandSchema),
  giftCardOffers: z.array(GiftCardOfferSchema).default([]),
  platformCardBonuses: z.array(PlatformCardBonusSchema).default([]),
  merchantOffers: z.array(MerchantOfferSchema).default([]),
  strategies: z.array(StrategySchema),
});
export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;
export type KnowledgeBaseInput = z.input<typeof KnowledgeBaseSchema>;

/** Validate a knowledge base and check cross references. */
export function parseKnowledgeBase(input: KnowledgeBaseInput): KnowledgeBase {
  const kb = KnowledgeBaseSchema.parse(input);
  const cardIds = new Set(kb.cards.map((c) => c.id));
  const platformIds = new Set(kb.platforms.map((p) => p.id));
  const brandIds = new Set(kb.brands.map((b) => b.id));
  const problems: string[] = [];
  for (const c of kb.cards) {
    for (const r of c.rules) {
      if (r.capGroup && !c.capGroups[r.capGroup]) {
        problems.push(`card ${c.id}: rule ${r.id} refers to unknown cap group ${r.capGroup}`);
      }
      if (r.kind === 'points' && !c.pointValue) {
        problems.push(`card ${c.id}: points rule ${r.id} but card has no pointValue`);
      }
    }
  }
  for (const m of kb.myCards) {
    if (!cardIds.has(m.cardProductId)) problems.push(`my card ${m.id}: unknown card product ${m.cardProductId}`);
  }
  for (const o of kb.giftCardOffers) {
    if (!platformIds.has(o.platformId)) problems.push(`offer ${o.id}: unknown platform ${o.platformId}`);
    if (!brandIds.has(o.brandId)) problems.push(`offer ${o.id}: unknown brand ${o.brandId}`);
  }
  for (const b of kb.platformCardBonuses) {
    if (!platformIds.has(b.platformId)) problems.push(`bonus ${b.id}: unknown platform ${b.platformId}`);
    if (!cardIds.has(b.cardProductId)) problems.push(`bonus ${b.id}: unknown card ${b.cardProductId}`);
  }
  for (const o of kb.merchantOffers) {
    if (!brandIds.has(o.brandId)) problems.push(`merchant offer ${o.id}: unknown brand ${o.brandId}`);
    if (o.cardProductId && !cardIds.has(o.cardProductId)) {
      problems.push(`merchant offer ${o.id}: unknown card ${o.cardProductId}`);
    }
  }
  if (problems.length) throw new Error(`Knowledge base is inconsistent:\n- ${problems.join('\n- ')}`);
  return kb;
}
