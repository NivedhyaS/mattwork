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
            'pointer-events-auto relative w-screen bg-white dark:bg-slate-950 shadow-2xl border-l border-slate-200 dark:border-slate-850 flex flex-col h-full transform transition-transform duration-300 ease-in-out translate-x-0',
            size === 'sm' && 'max-w-md',
            size === 'md' && 'max-w-lg',
            size === 'lg' && 'max-w-2xl',
            size === 'xl' && 'max-w-4xl',
            className
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-slate-900">
            <div>
              {title && <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">{title}</h3>}
              {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors focus:outline-none"
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
