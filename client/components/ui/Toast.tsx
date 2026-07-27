'use client';

import { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, X, Info } from 'lucide-react';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onDismiss: () => void;
  duration?: number;
}

export default function Toast({
  message,
  type = 'success',
  onDismiss,
  duration = 4000,
}: ToastProps) {
  useEffect(() => {
    if (!duration) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  const isError = type === 'error';
  const isSuccess = type === 'success';

  return (
    <div className="fixed bottom-6 right-6 z-[120] flex items-center gap-3 px-5 py-3.5 bg-[#D8CFC2] text-[#1F1610] text-[13.5px] font-extrabold rounded-2xl shadow-[-6px_-6px_14px_rgba(255,255,255,0.75),6px_6px_14px_rgba(135,120,108,0.75)] border border-[rgba(135,120,108,0.4)] animate-in slide-in-from-bottom-4">
      {isSuccess && <CheckCircle2 className="h-5 w-5 text-[#10B981] shrink-0" />}
      {isError && <AlertTriangle className="h-5 w-5 text-[#EF4444] shrink-0" />}
      {!isSuccess && !isError && <Info className="h-5 w-5 text-[#EA580C] shrink-0" />}

      <span className="leading-snug">{message}</span>

      <button
        type="button"
        onClick={onDismiss}
        className="ml-2 text-[#4A3E34] hover:text-[#1F1610] transition-colors p-1 rounded-lg cursor-pointer"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
