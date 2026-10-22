export function inr(n: number): string {
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Math.round(n * 100) / 100);
}

export function pct(n: number): string {
  return `${Math.round(n * 100) / 100}%`;
}
