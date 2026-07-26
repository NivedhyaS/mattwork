'use client';

import { useState, useEffect } from 'react';
import Modal from './modal';
import { MessageSquare } from 'lucide-react';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title?: string;
  description?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  defaultValue?: string;
  isLoading?: boolean;
}

export default function PromptModal({
  isOpen,
  onClose,
  onSubmit,
  title = 'Enter Information',
  description = 'Please provide details below:',
  placeholder = 'Type here...',
  confirmText = 'Submit',
  cancelText = 'Cancel',
  defaultValue = '',
  isLoading = false,
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) setValue(defaultValue);
  }, [isOpen, defaultValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="md">
      <form onSubmit={handleSubmit} className="p-6 bg-[#F6EFE9] space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-[#F6EFE9] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] flex items-center justify-center shrink-0">
            <MessageSquare className="h-5 w-5 text-[#EA580C]" />
          </div>
          <div>
            <h3 className="text-[19px] font-extrabold text-[#3D2E24] tracking-tight">{title}</h3>
            {description && <p className="text-[13px] font-semibold text-[#8C7769]">{description}</p>}
          </div>
        </div>

        <div>
          <textarea
            required
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full text-[14px] p-3.5 rounded-2xl border-0 bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] focus:outline-none placeholder:text-[#8C7769] font-medium leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="py-2.5 px-5 rounded-2xl bg-[#F6EFE9] text-[#3D2E24] font-extrabold text-[13.5px] shadow-[-3px_-3px_6px_rgba(255,255,255,0.9),3px_3px_6px_rgba(206,187,172,0.6)] hover:shadow-[-4px_-4px_8px_rgba(255,255,255,0.95),4px_4px_8px_rgba(201,180,163,0.7)] transition-all cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="submit"
            disabled={isLoading || !value.trim()}
            className="py-2.5 px-6 rounded-2xl bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white font-extrabold text-[13.5px] shadow-[-3px_-3px_6px_rgba(255,255,255,0.7),3px_3px_8px_rgba(234,88,12,0.4)] hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Submitting…' : confirmText}
          </button>
        </div>
      </form>
    </Modal>
  );
}
