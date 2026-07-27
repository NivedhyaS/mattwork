import { useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export default function Drawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  className,
}: DrawerProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10 pointer-events-none">
        <div
          className={cn(
            'pointer-events-auto relative w-screen bg-[#D8CFC2] text-[#1F1610] shadow-[-12px_0_24px_rgba(135,120,108,0.7)] border-0 flex flex-col h-full transform transition-transform duration-300 ease-in-out translate-x-0',
            size === 'sm' && 'max-w-md',
            size === 'md' && 'max-w-lg',
            size === 'lg' && 'max-w-2xl',
            size === 'xl' && 'max-w-4xl',
            className
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-[#CBBFA8]">
            <div>
              {title && <h3 className="text-lg font-bold text-[#1F1610]">{title}</h3>}
              {description && <p className="text-sm text-[#4A3E34] mt-1">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-[#4A3E34] bg-[#D8CFC2] shadow-[-3px_-3px_6px_rgba(255,255,255,0.75),3px_3px_6px_rgba(135,120,108,0.72)] hover:shadow-[-4px_-4px_8px_rgba(255,255,255,0.85),4px_4px_8px_rgba(125,110,98,0.8)] hover:text-[#1F1610] transition-all focus:outline-none"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
