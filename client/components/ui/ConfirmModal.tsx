'use client';

import { ReactNode } from 'react';
import Modal from './modal';
import Button from './button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmModalProps) {
  const isDanger = variant === 'danger';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="sm">
      <div className="p-6 bg-[#D8CFC2] space-y-5 text-center">
        {/* Warning Icon Badge */}
        <div className={`h-14 w-14 rounded-2xl mx-auto flex items-center justify-center bg-[#D8CFC2] ${
          isDanger
            ? 'shadow-[inset_3px_3px_6px_rgba(239,68,68,0.3),inset_-3px_-3px_6px_rgba(255,255,255,0.75)] text-[#DC2626]'
            : 'shadow-[inset_3px_3px_6px_rgba(234,88,12,0.3),inset_-3px_-3px_6px_rgba(255,255,255,0.75)] text-[#EA580C]'
        }`}>
          <AlertTriangle className="h-7 w-7" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-[20px] font-extrabold text-[#1F1610] tracking-tight">{title}</h3>
          <p className="text-[13.5px] font-semibold text-[#4A3E34] leading-relaxed max-w-xs mx-auto">
            {description}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-2xl bg-[#D8CFC2] text-[#1F1610] font-extrabold text-[14px] shadow-[-3px_-3px_6px_rgba(255,255,255,0.75),3px_3px_6px_rgba(135,120,108,0.7)] hover:shadow-[-4px_-4px_8px_rgba(255,255,255,0.85),4px_4px_8px_rgba(125,110,98,0.8)] transition-all cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`flex-1 py-3 px-4 rounded-2xl font-extrabold text-[14px] text-white transition-all cursor-pointer disabled:opacity-50 shadow-md ${
              isDanger
                ? 'bg-[#DC2626] hover:bg-[#B91C1C] shadow-[-2px_-2px_4px_rgba(255,255,255,0.7),2px_2px_6px_rgba(220,38,38,0.4)]'
                : 'bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] shadow-[-2px_-2px_4px_rgba(255,255,255,0.7),2px_2px_6px_rgba(234,88,12,0.4)]'
            }`}
          >
            {isLoading ? 'Processing…' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
