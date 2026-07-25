import { SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, label, children, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-350 mb-1.5">
            {label}
          </label>
        )}
        <select
          className={cn(
            'flex h-11 w-full rounded-2xl border-0 bg-[#F6EFE9] text-[#3D2E24] font-semibold px-4 py-2 text-sm focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
            'shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] focus:shadow-[inset_5px_5px_10px_rgba(206,187,172,0.7),inset_-5px_-5px_10px_rgba(255,255,255,0.9),0_0_0_2px_rgba(249,115,22,0.4)]',
            error && 'shadow-[inset_4px_4px_8px_rgba(239,68,68,0.4)] text-[#EF4444]',
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="mt-1 text-xs text-rose-500 font-medium">{error}</p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';
export default Select;
