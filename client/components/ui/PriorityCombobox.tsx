'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export const PRIORITY_OPTIONS = [
  { value: 'HIGH', label: 'High Priority', icon: '🔴', triggerColor: 'text-[#DC2626]', activeClass: 'bg-[rgba(220,38,38,0.08)]', dotColor: 'bg-[#DC2626]' },
  { value: 'MEDIUM', label: 'Medium Priority', icon: '🟡', triggerColor: 'text-[#D97706]', activeClass: 'bg-[rgba(217,119,6,0.08)]', dotColor: 'bg-[#D97706]' },
  { value: 'LOW', label: 'Low Priority', icon: '🟢', triggerColor: 'text-[#16A34A]', activeClass: 'bg-[rgba(22,163,74,0.08)]', dotColor: 'bg-[#16A34A]' }
];

interface PriorityComboboxProps {
  value: string;
  onChange: (val: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function PriorityCombobox({
  value,
  onChange,
  isLoading = false,
  disabled = false,
  className = '',
}: PriorityComboboxProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = PRIORITY_OPTIONS.find((p) => p.value === value) ?? PRIORITY_OPTIONS[1];

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const total = PRIORITY_OPTIONS.length;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (i + 1) % total);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (i - 1 + total) % total);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (open && activeIndex >= 0) {
          onChange(PRIORITY_OPTIONS[activeIndex].value);
          setOpen(false);
        } else {
          setOpen(true);
        }
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    },
    [open, activeIndex, onChange]
  );

  const selectOption = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setOpen(!open)}
        onKeyDown={handleKeyDown}
        className={`
          flex items-center justify-between w-full px-4 py-2.5 h-11 rounded-2xl text-left transition-all
          bg-[#F6EFE9] border-0
          shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)]
          focus:outline-none
          ${(disabled || isLoading) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className={`h-3 w-3 rounded-full shrink-0 ${selected.dotColor}`} />

          <div className="min-w-0 flex-1">
            {isLoading ? (
              <span className="text-[#8C7769] font-medium text-[14px]">Saving…</span>
            ) : (
              <span className={`font-extrabold truncate block text-[14px] ${selected.triggerColor}`}>
                {selected.label}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 text-[#8C7769] ${open ? 'rotate-180 text-[#EA580C]' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute z-[60] mt-2 w-full min-w-[200px] rounded-2xl bg-[#F6EFE9] shadow-[-8px_-8px_16px_rgba(255,255,255,0.95),8px_8px_16px_rgba(201,180,163,0.75)] p-2 space-y-1">
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-[260px] overflow-y-auto space-y-0.5"
          >
            {PRIORITY_OPTIONS.map((option, idx) => {
              const isSelected = option.value === value;
              const isActive = activeIndex === idx;
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => selectOption(option.value)}
                  className={`
                    flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all
                    ${isActive ? option.activeClass : 'hover:bg-[rgba(234,88,12,0.06)]'}
                    ${isSelected && !isActive ? 'bg-[rgba(234,88,12,0.04)]' : ''}
                  `}
                >
                  <div className={`h-3 w-3 rounded-full shrink-0 ${option.dotColor}`} />

                  <div className="flex-1 min-w-0">
                    <p className={`font-extrabold text-[14px] truncate ${isSelected ? 'text-[#3D2E24]' : 'text-[#5C4A3E]'}`}>
                      {option.label}
                    </p>
                  </div>
                  
                  {isSelected && <Check className="h-4 w-4 text-[#EA580C] shrink-0" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
