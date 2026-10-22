import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { ReasoningEffort } from 'openai/resources/shared';
import type { Brand, KnowledgeBase } from '@smart-spend/engine';
import {
  CATEGORY_VALUES,
  OfferSearchSchema,
  ParsedIntentSchema,
  type Citation,
  type OfferSearch,
  type OfferSearchResult,
  type ParsedIntent,
} from './types';

/** OpenAI Responses API. Default model per the user's choice; override with OPENAI_MODEL. */
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-6.1-sol';

/** Only sent when OPENAI_REASONING_EFFORT is set, so the model's own default applies otherwise. */
function reasoning(): { effort: ReasoningEffort } | undefined {
  const v = process.env.OPENAI_REASONING_EFFORT as ReasoningEffort | undefined;
  return v ? { effort: v } : undefined;
}

let client: OpenAI | undefined;
function getClient(): OpenAI {
  if (!client) client = new OpenAI();
  return client;
}

export function describeOpenAIError(err: unknown): string {
  if (err instanceof OpenAI.AuthenticationError) return 'OpenAI rejected the API key';
  if (err instanceof OpenAI.RateLimitError) return 'OpenAI rate limit hit; try again shortly';
  if (err instanceof OpenAI.BadRequestError) return `OpenAI rejected the request: ${err.message}`;
  if (err instanceof OpenAI.APIError) return `OpenAI error ${err.status ?? ''}: ${err.message}`;
  return err instanceof Error ? err.message : 'request failed';
}

export async function parseIntentOpenAI(message: string, kb: KnowledgeBase): Promise<ParsedIntent | null> {
  const brandList = kb.brands.map((b) => `${b.name} (${b.category})`).join(', ');
  const response = await getClient().responses.parse({
    model: OPENAI_MODEL,
    reasoning: reasoning(),
    instructions:
      'You extract a purchase intent from a short message written by an Indian credit card user who wants the cheapest way to pay. ' +
      `Known brands: ${brandList}. ` +
      'brandQuery: the matching known brand name, else the merchant named in the message, else null. ' +
      'amount: the bill in rupees as a number ("12k" = 12000, "1.5 lakh" = 150000), else null. ' +
      'channel: "offline" for a physical store/showroom/shop, "online" for a website or app, "upi" only if they say they will pay by UPI, null if unclear. ' +
      'inStoreNow: true only if they are at the store right now. ' +
      'category: the merchant category from this list that fits the brand best: ' + CATEGORY_VALUES.join(', ') + '; null only if you cannot tell.',
    input: message,
    text: { format: zodTextFormat(ParsedIntentSchema, 'purchase_intent') },
  });
  return response.output_parsed ?? null;
}

function collectCitations(output: OpenAI.Responses.ResponseOutputItem[]): Citation[] {
  const seen = new Map<string, Citation>();
  for (const item of output) {
    if (item.type !== 'message') continue;
    for (const part of item.content) {
      if (part.type !== 'output_text') continue;
      for (const a of part.annotations) {
        if (a.type === 'url_citation' && !seen.has(a.url)) seen.set(a.url, { url: a.url, title: a.title });
      }
    }
  }
  return [...seen.values()];
}

function searchPrompt(brand: Brand, kb: KnowledgeBase): { instructions: string; input: string } {
  const platforms = kb.platforms.filter((p) => p.type === 'gift_card').map((p) => p.name).join(', ');
  const cards = kb.myCards
    .map((m) => kb.cards.find((c) => c.id === m.cardProductId))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => `${c.name} (${c.issuer})`)
    .join(', ');
  return {
    instructions:
      'You research current ways to save on a purchase at an Indian merchant. Use web search. ' +
      'Report only what a page actually states, with the page URL as sourceUrl for every item. ' +
      'Prefer the platforms\' own pages and this week\'s posts over old blog roundups; mark anything older than two months or unclear as low confidence. ' +
      'Discount percentages are on gift card face value. Do not invent numbers: if a platform lists the brand but no discount is visible, set discountPct to null. ' +
      'Never include affiliate-only "cashback" sites as gift card discounts.',
    input:
      `Merchant: ${brand.name} (${brand.category}, India).\n` +
      `1. Which of these gift card platforms currently sell ${brand.name} gift cards and at what discount: ${platforms}? Include any other reputable Indian platform you find.\n` +
      `2. Any current bank instant-discount, cashback or coupon offers at ${brand.name}, especially for these cards: ${cards}.\n` +
      'Return the structured result.',
  };
}

const WEB_SEARCH_TOOL: OpenAI.Responses.Tool = {
  type: 'web_search',
  search_context_size: 'high',
  user_location: { type: 'approximate', country: 'IN' },
};

/**
 * One Responses API call with the built-in web_search tool and a structured output
 * format. If the API rejects that combination, fall back to a search call that
 * writes findings as text, then a second call that structures them.
 */
export async function searchOffersOpenAI(brand: Brand, kb: KnowledgeBase): Promise<OfferSearchResult> {
  const c = getClient();
  const { instructions, input } = searchPrompt(brand, kb);
  try {
    const response = await c.responses.parse({
      model: OPENAI_MODEL,
      reasoning: reasoning(),
      instructions,
      input,
      tools: [WEB_SEARCH_TOOL],
      text: { format: zodTextFormat(OfferSearchSchema, 'offer_search') },
    });
    if (response.output_parsed) {
      return { ok: true, provider: 'openai', model: OPENAI_MODEL, result: response.output_parsed, citations: collectCitations(response.output) };
    }
  } catch (err) {
    if (!(err instanceof OpenAI.BadRequestError)) throw err;
  }
  // Two-step fallback.
  const research = await c.responses.create({
    model: OPENAI_MODEL,
    reasoning: reasoning(),
    instructions,
    input: input + '\nWrite your findings as a detailed list with the URL after each item.',
    tools: [WEB_SEARCH_TOOL],
  });
  const findings = research.output_text;
  const structured = await c.responses.parse({
    model: OPENAI_MODEL,
    reasoning: reasoning(),
    instructions: 'Convert these research notes into the structured result. Keep every URL as sourceUrl. Do not add anything that is not in the notes.',
    input: findings,
    text: { format: zodTextFormat(OfferSearchSchema, 'offer_search') },
  });
  const result: OfferSearch = structured.output_parsed ?? { giftCards: [], bankOffers: [], summary: findings.slice(0, 600) };
  return { ok: true, provider: 'openai', model: OPENAI_MODEL, result, citations: collectCitations(research.output) };
}
