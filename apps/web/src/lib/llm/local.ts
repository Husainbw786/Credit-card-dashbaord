import type { Brand, KnowledgeBase } from '@smart-spend/engine';
import type { ParsedIntent } from './types';

export function fuzzyBrand(kb: KnowledgeBase, query: string): Brand | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  const exact = kb.brands.find((b) => b.id === q || b.name.toLowerCase() === q || b.aliases.some((a) => a.toLowerCase() === q));
  if (exact) return exact;
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

/** Rule-based fallback when no LLM provider is configured. */
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
