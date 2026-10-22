import type { Route } from '@smart-spend/engine';
import { inr, pct } from '@/lib/format';
import { Badge } from './ui';

const dot: Record<Route['catches'][number]['severity'], string> = {
  info: 'bg-zinc-400',
  medium: 'bg-amber-500',
  low: 'bg-red-500',
};

export function RouteCard({ route, rank, alternatives = [] }: { route: Route; rank: number; alternatives?: Route[] }) {
  const best = rank === 1;
  return (
    <article className={`rounded-xl border p-4 shadow-sm ${best ? 'border-emerald-400 bg-emerald-50/40 dark:border-emerald-700 dark:bg-emerald-950/20' : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">#{rank}{best ? ' · best' : ''}</div>
          <h3 className="mt-0.5 font-semibold leading-snug">{route.title}</h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={route.confidence}>{route.confidence} confidence</Badge>
          {!route.instant && <Badge>not instant</Badge>}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="You pay" value={inr(route.youPay)} />
        <Stat label="Effective" value={inr(route.effectiveCost)} strong />
        <Stat label="Saving" value={pct(route.savingsPct)} />
      </div>

      <ol className="mt-4 space-y-2">
        {route.steps.map((s) => (
          <li key={s.n} className="flex gap-2 text-sm">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">{s.n}</span>
            <div>
              <div>{s.action}</div>
              {s.detail && <div className="text-xs text-zinc-500 dark:text-zinc-400">{s.detail}</div>}
            </div>
          </li>
        ))}
      </ol>

      {alternatives.length > 0 && (
        <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
          <span className="font-medium">Same option with other cards:</span>{' '}
          {alternatives.map((a, i) => (
            <span key={a.id}>
              {i > 0 && ' · '}
              {a.cardName} <span className="tabular-nums">{inr(a.effectiveCost)}</span>
            </span>
          ))}
        </p>
      )}

      {route.catches.length > 0 && (
        <ul className="mt-4 space-y-1">
          {route.catches.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot[c.severity]}`} />
              <span>{c.message}</span>
            </li>
          ))}
        </ul>
      )}

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">Show the math</summary>
        <table className="mt-2 w-full">
          <tbody>
            {route.breakdown.map((b, i) => (
              <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="py-1 pr-2">{b.label}</td>
                <td className={`py-1 text-right tabular-nums ${b.amount < 0 ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>{b.amount < 0 ? '−' : ''}{inr(Math.abs(b.amount))}</td>
              </tr>
            ))}
            <tr className="border-t border-zinc-300 font-semibold dark:border-zinc-700">
              <td className="py-1 pr-2">Effective cost</td>
              <td className="py-1 text-right tabular-nums">{inr(route.effectiveCost)}</td>
            </tr>
          </tbody>
        </table>
      </details>
    </article>
  );
}

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-zinc-100/80 px-2 py-2 dark:bg-zinc-800/60">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`tabular-nums ${strong ? 'text-lg font-semibold' : 'text-sm font-medium'}`}>{value}</div>
    </div>
  );
}
