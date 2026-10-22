import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';
import type { Brand, KnowledgeBase } from '@smart-spend/engine';

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

export type Parser = 'claude' | 'local';

const MODEL = process.env.SMART_SPEND_MODEL || 'claude-opus-5-5';

export function fuzzyBrand(kb: KnowledgeBase, query: string): Brand | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  const exact = kb.brands.find((b) => b.id === q || b.name.toLowerCase() === q || b.aliases.some((a) => a.toLowerCase() === q));
  if (exact) return exact;
  // Longest brand name/alias contained in the query, or query contained in the name.
  let best: { brand: Brand; len: number } | undefined;
  for (const b of kb.brands) {
    for (const candidate of [b.name, b.id, ...b.aliases]) {
      const c = candidate.toLowerCase();
      if (q.includes(c) || c.includes(q)) {
        const len = Math.min(c.length, q.length);
        if (!best || len > best.len) best = { brand: b, len };
      }
    }
  }
  return best?.brand;
}

function parseAmount(text: string): number | null {
  const re = /(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakh|lac|l)?\b/gi;
  let best: number | null = null;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1]!.replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0) continue;
    const unit = (m[2] ?? '').toLowerCase();
    const value = unit === 'k' || unit === 'thousand' ? n * 1000 : unit === 'lakh' || unit === 'lac' || unit === 'l' ? n * 100_000 : n;
    if (best === null || value > best) best = value;
  }
  return best;
}

export function localParse(message: string, kb: KnowledgeBase): ParsedIntent {
  const lower = message.toLowerCase();
  const brand = fuzzyBrand(kb, lower);
  const amount = parseAmount(lower);
  let channel: ParsedIntent['channel'] = null;
  if (/\bupi\b/.test(lower)) channel = 'upi';
  else if (/\b(online|website|site|app|\.com|\.in|checkout|cart)\b/.test(lower)) channel = 'online';
  else if (/\b(store|showroom|shop|outlet|mall|counter|billing|cashier)\b/.test(lower)) channel = 'offline';
  const inStoreNow = /\b(i'?m at|i am at|am in|i'?m in|standing|right now|now at|at the (store|shop|showroom|counter|billing))\b/.test(lower);
  return { brandQuery: brand?.name ?? null, amount, channel, inStoreNow };
}

export async function parseIntent(message: string, kb: KnowledgeBase): Promise<{ parsed: ParsedIntent; parser: Parser; warning?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { parsed: localParse(message, kb), parser: 'local' };
  }
  try {
    const client = new Anthropic();
    const brandList = kb.brands.map((b) => `${b.name} (${b.category})`).join(', ');
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 2048,
      output_config: { effort: 'low', format: zodOutputFormat(ParsedIntentSchema) },
      system:
        'You extract a purchase intent from a short message written by an Indian credit card user who wants the cheapest way to pay. ' +
        `Known brands: ${brandList}. ` +
        'brandQuery: the matching known brand name, else the merchant named in the message, else null. ' +
        'amount: the bill in rupees as a number ("12k" = 12000, "1.5 lakh" = 150000), else null. ' +
        'channel: "offline" for a physical store/showroom/shop, "online" for a website or app, "upi" only if they say they will pay by UPI, null if unclear. ' +
        'inStoreNow: true only if they are at the store right now.',
      messages: [{ role: 'user', content: message }],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return { parsed: localParse(message, kb), parser: 'local', warning: 'Model did not return a parse; used the local parser.' };
    }
    return { parsed: response.parsed_output, parser: 'claude' };
  } catch (err) {
    const msg = err instanceof Anthropic.APIError ? `API error ${err.status}` : 'request failed';
    return { parsed: localParse(message, kb), parser: 'local', warning: `Claude parsing unavailable (${msg}); used the local parser.` };
  }
}
