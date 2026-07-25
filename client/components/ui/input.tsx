import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          type={type}
          className={cn(
            'flex h-11 w-full rounded-2xl border-0 bg-[#F6EFE9] text-[#3D2E24] font-semibold px-4 py-2 text-sm placeholder:text-[#8C7769] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            'shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] focus:shadow-[inset_5px_5px_10px_rgba(206,187,172,0.7),inset_-5px_-5px_10px_rgba(255,255,255,0.9),0_0_0_2px_rgba(249,115,22,0.4)]',
            error && 'shadow-[inset_4px_4px_8px_rgba(239,68,68,0.4)] text-[#EF4444]',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-rose-500 font-medium">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
