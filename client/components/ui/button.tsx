import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center font-bold rounded-2xl transition-all focus:outline-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
          // Variants
          variant === 'primary' && 'bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white shadow-[-4px_-4px_10px_rgba(255,255,255,0.6),4px_4px_12px_rgba(234,88,12,0.5)] hover:shadow-[-6px_-6px_14px_rgba(255,255,255,0.7),6px_6px_16px_rgba(234,88,12,0.6)] active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)]',
          variant === 'secondary' && 'bg-[#D8CFC2] text-[#1F1610] shadow-[-4px_-4px_10px_rgba(255,255,255,0.75),4px_4px_10px_rgba(135,120,108,0.72)] hover:shadow-[-6px_-6px_12px_rgba(255,255,255,0.85),6px_6px_12px_rgba(125,110,98,0.8)] active:shadow-[inset_3px_3px_6px_rgba(135,120,108,0.7),inset_-3px_-3px_6px_rgba(255,255,255,0.72)]',
          variant === 'outline' && 'bg-[#D8CFC2] text-[#1F1610] border-0 shadow-[-4px_-4px_10px_rgba(255,255,255,0.75),4px_4px_10px_rgba(135,120,108,0.72)] hover:text-[#EA580C] hover:shadow-[-6px_-6px_12px_rgba(255,255,255,0.85),6px_6px_12px_rgba(125,110,98,0.8)] active:shadow-[inset_3px_3px_6px_rgba(135,120,108,0.7),inset_-3px_-3px_6px_rgba(255,255,255,0.72)]',
          variant === 'danger' && 'bg-[#EF4444] text-white shadow-[-4px_-4px_10px_rgba(255,255,255,0.6),4px_4px_12px_rgba(239,68,68,0.4)] hover:bg-[#DC2626]',
          variant === 'ghost' && 'bg-[#D8CFC2] text-[#4A3E34] hover:text-[#EA580C] hover:shadow-[-3px_-3px_6px_rgba(255,255,255,0.75),3px_3px_6px_rgba(135,120,108,0.65)]',
          variant === 'link' && 'bg-transparent text-[#EA580C] underline-offset-4 hover:underline focus:ring-0 active:scale-100',
          // Sizes
          size === 'sm' && 'h-9 px-3 text-xs',
          size === 'md' && 'h-10 px-4 py-2 text-sm',
          size === 'lg' && 'h-11 px-8 text-base',
          size === 'icon' && 'h-10 w-10',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
