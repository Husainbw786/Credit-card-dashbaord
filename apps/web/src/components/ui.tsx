import type { ComponentProps, ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>{children}</div>;
}

export function H1({ children }: { children: ReactNode }) {
  return <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>;
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 mb-3 text-lg font-semibold">{children}</h2>;
}

export function Muted({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-sm text-zinc-500 dark:text-zinc-400 ${className}`}>{children}</p>;
}

const btnBase = 'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50';
const btnVariants = {
  primary: 'bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300',
  secondary: 'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
  danger: 'border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950',
  ghost: 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800',
};

export function Button({ variant = 'primary', className = '', ...props }: ComponentProps<'button'> & { variant?: keyof typeof btnVariants }) {
  return <button className={`${btnBase} ${btnVariants[variant]} ${className}`} {...props} />;
}

export const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return <input className={`${inputClass} ${className}`} {...props} />;
}

export function Select(props: ComponentProps<'select'>) {
  return <select className={inputClass} {...props} />;
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <label className={`block text-xs font-medium text-zinc-600 dark:text-zinc-400 ${className}`}>{children}</label>;
}

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1">{label}</Label>
      {children}
    </div>
  );
}

const badgeColors = {
  high: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  low: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
  info: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
};

export function Badge({ tone = 'info', children }: { tone?: keyof typeof badgeColors; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeColors[tone]}`}>{children}</span>;
}
