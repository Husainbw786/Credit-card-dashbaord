import { z } from 'zod/v4';

export const ParsedIntentSchema = z.object({
  /** Brand name as written in the known list, or the merchant named in the message, or null. */
  brandQuery: z.string().nullable(),
  /** Bill amount in rupees, or null if not stated. */
  amount: z.number().nullable(),
  channel: z.enum(['online', 'offline', 'upi']).nullable(),
  /** True when the user is physically at the store right now. */
  inStoreNow: z.boolean(),
});
export type ParsedIntent = z.infer<typeof ParsedIntentSchema>;

export const GiftCardCandidateSchema = z.object({
  /** Platform name as found, e.g. Gyftr, Magicpin, Park+, Woohoo, Magnify, Zingoy. */
  platform: z.string(),
  /** Discount on face value in percent; null if the page did not state one. */
  discountPct: z.number().nullable(),
  promoCode: z.string().nullable(),
  /** Bank or card the discount is tied to, if any. */
  cardRequired: z.string().nullable(),
  /** Where the gift card can be redeemed: online, stores, both, or unknown. */
  redemption: z.enum(['online', 'stores', 'both', 'unknown']),
  sourceUrl: z.string(),
  /** Date the offer was seen or stated on the page, ISO if possible. */
  asOf: z.string().nullable(),
  notes: z.string().nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
});
export type GiftCardCandidate = z.infer<typeof GiftCardCandidateSchema>;

export const BankOfferCandidateSchema = z.object({
  bank: z.string(),
  card: z.string().nullable(),
  kind: z.enum(['instant', 'cashback', 'coupon']),
  pct: z.number(),
  cap: z.number().nullable(),
  minSpend: z.number().nullable(),
  channel: z.enum(['online', 'offline', 'both']),
  code: z.string().nullable(),
  validTill: z.string().nullable(),
  sourceUrl: z.string(),
  notes: z.string().nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
});
export type BankOfferCandidate = z.infer<typeof BankOfferCandidateSchema>;

export const OfferSearchSchema = z.object({
  giftCards: z.array(GiftCardCandidateSchema),
  bankOffers: z.array(BankOfferCandidateSchema),
  /** Two or three sentences on what was found and what could not be confirmed. */
  summary: z.string(),
});
export type OfferSearch = z.infer<typeof OfferSearchSchema>;

export interface Citation {
  url: string;
  title: string;
}

export type ProviderName = 'openai' | 'anthropic' | 'local';

export interface IntentParseResult {
  parsed: ParsedIntent;
  provider: ProviderName;
  warning?: string;
}

export interface OfferSearchResult {
  ok: true;
  provider: ProviderName;
  model: string;
  result: OfferSearch;
  citations: Citation[];
}

export interface OfferSearchFailure {
  ok: false;
  error: string;
}
