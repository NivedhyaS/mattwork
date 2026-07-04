import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'danger';
}

export default function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        variant === 'default' && 'border-transparent bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900',
        variant === 'secondary' && 'border-transparent bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
        variant === 'outline' && 'text-slate-950 border-slate-300 dark:text-slate-50 dark:border-slate-700',
        variant === 'success' && 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-850',
        variant === 'warning' && 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-850',
        variant === 'danger' && 'border-transparent bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-850',
        className
      )}
      {...props}
    />
  );
}
