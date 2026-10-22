import { fmtInr, groupRoutes, type Route } from './routes';
import type { KnowledgeBase, PurchaseIntent } from './types';

const badge: Record<Route['confidence'], string> = { high: 'HIGH', medium: 'MEDIUM', low: 'LOW' };

export function formatRoute(r: Route, rank: number): string {
  const lines: string[] = [];
  lines.push(`#${rank}  ${r.title}`);
  lines.push(`    pay ${fmtInr(r.youPay)}  →  effective ${fmtInr(r.effectiveCost)}  (${r.savingsPct}% off)   confidence: ${badge[r.confidence]}${r.instant ? '' : '   not instant'}`);
  for (const s of r.steps) {
    lines.push(`    ${s.n}. ${s.action}`);
    if (s.detail) lines.push(`       ${s.detail}`);
  }
  if (r.catches.length) {
    lines.push('    catches:');
    for (const c of r.catches) lines.push(`      [${c.severity}] ${c.message}`);
  }
  return lines.join('\n');
}

export function formatRoutes(kb: KnowledgeBase, intent: PurchaseIntent, routes: Route[], opts: { allCards?: boolean } = {}): string {
  const brand = kb.brands.find((b) => b.id === intent.brandId);
  const head = `Best ways to pay ${fmtInr(intent.amount)} at ${brand?.name ?? intent.brandId} (${intent.channel}${intent.inStoreNow ? ', in store now' : ''})`;
  let body: string;
  if (opts.allCards) {
    body = routes.map((r, i) => formatRoute(r, i + 1)).join('\n\n');
  } else {
    body = groupRoutes(routes)
      .map((g, i) => {
        const alt = g.alternatives.length
          ? `\n    other cards: ${g.alternatives.map((a) => `${a.cardName} ${fmtInr(a.effectiveCost)}`).join(' · ')}`
          : '';
        return formatRoute(g.best, i + 1) + alt;
      })
      .join('\n\n');
  }
  return `${head}\n${'='.repeat(head.length)}\n\n${body || 'No routes found.'}`;
}
