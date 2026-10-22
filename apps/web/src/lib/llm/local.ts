import type { Brand, KnowledgeBase } from '@smart-spend/engine';
import type { ParsedIntent } from './types';

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when `needle` appears in `hay` as a whole word (not inside another word). */
function containsWord(hay: string, needle: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRe(needle)}([^a-z0-9]|$)`).test(hay);
}

export function fuzzyBrand(kb: KnowledgeBase, query: string): Brand | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  const exact = kb.brands.find((b) => b.id === q || b.name.toLowerCase() === q || b.aliases.some((a) => a.toLowerCase() === q));
  if (exact) return exact;
  // Longest brand name/alias that appears as a whole word in the query, or (for short
  // queries such as a typed name) a brand name that contains the query.
  let best: { brand: Brand; len: number } | undefined;
  for (const b of kb.brands) {
    for (const candidate of [b.name, b.id, ...b.aliases]) {
      const c = candidate.toLowerCase();
      const hit = containsWord(q, c) || (q.length >= 4 && c.includes(q));
      if (hit) {
        const len = Math.min(c.length, q.length);
        if (!best || len > best.len) best = { brand: b, len };
      }
    }
  }
  return best?.brand;
}

function parseAmount(text: string): number | null {
  // "₹12,000", "12,000 rs", "700rs", "45k", "1.5 lakh"
  const re = /(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakh|lac|l)?(?:\s*(?:rs\.?|rupees|inr|₹))?(?![a-z0-9])/gi;
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

const STOP = new Set(['the', 'a', 'an', 'my', 'their', 'store', 'shop', 'showroom', 'outlet', 'mall', 'online', 'website', 'app', 'for', 'of', 'with', 'around', 'about', 'worth', 'rs', 'inr', 'and', 'to', 'in', 'at', 'on', 'from', 'today', 'now', 'right', 'is', 'costs', 'cost', 'price', 'value', 'bill']);

/** Guess a merchant name from "at X" / "from X" / "on X" (preferred) or "buying X" when no known brand matches. */
function guessBrandName(lower: string): string | null {
  const patterns = [
    /(?:^|[^a-z])(?:at|from|on)\s+([a-z][a-z0-9&'.-]*)(?:\s+([a-z][a-z0-9&'.-]*))?/g,
    /(?:^|[^a-z])(?:buy(?:ing)?|order(?:ing)?|shop(?:ping)?)\s+([a-z][a-z0-9&'.-]*)(?:\s+([a-z][a-z0-9&'.-]*))?/g,
  ];
  for (const re of patterns) {
    for (const m of lower.matchAll(re)) {
      if (!m[1] || STOP.has(m[1])) continue;
      const words = [m[1], m[2]].filter((w): w is string => Boolean(w) && !STOP.has(w!) && !/^\d/.test(w!));
      if (words.length === 0) continue;
      return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  return null;
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
  return { brandQuery: brand?.name ?? guessBrandName(lower), amount, channel, inStoreNow, category: null };
}
