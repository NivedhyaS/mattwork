'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export const PRIORITY_OPTIONS = [
  { value: 'HIGH', label: 'High Priority', icon: '🔴', colorClass: 'bg-slate-800 text-rose-400', activeClass: 'bg-rose-500/15 text-rose-300' },
  { value: 'MEDIUM', label: 'Medium Priority', icon: '🟡', colorClass: 'bg-slate-800 text-amber-400', activeClass: 'bg-amber-500/15 text-amber-300' },
  { value: 'LOW', label: 'Low Priority', icon: '🟢', colorClass: 'bg-slate-800 text-emerald-400', activeClass: 'bg-emerald-500/15 text-emerald-300' }
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
          flex items-center justify-between w-full p-2 h-11 rounded-xl text-left transition-all
          bg-slate-900/60 dark:bg-slate-900/40 border border-slate-700/60 hover:bg-slate-800/80
          focus:outline-none focus:ring-2 focus:ring-slate-500/50 shadow-sm
          ${(disabled || isLoading) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="h-7 w-7 rounded-full bg-slate-800/80 border border-slate-700/50 flex items-center justify-center shrink-0 shadow-inner">
            <span className="text-[12px]">{selected.icon}</span>
          </div>

          <div className="min-w-0 flex-1">
            {isLoading ? (
              <span className="text-slate-400 font-medium text-[14px]">Saving…</span>
            ) : (
              <span className="font-bold text-slate-100 truncate block text-[14px]">
                {selected.label}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 text-slate-400 ${open ? 'rotate-180 text-slate-300' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[200px] rounded-2xl border border-slate-700/80 dark:border-slate-800 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl shadow-2xl p-1.5 space-y-1">
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-[260px] overflow-y-auto space-y-0.5 custom-scrollbar"
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
                    flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all
                    ${isActive ? option.activeClass : 'hover:bg-slate-800/60 text-slate-200'}
                    ${isSelected && !isActive ? 'bg-slate-800/40 text-slate-100' : ''}
                  `}
                >
                  <div className="h-7 w-7 rounded-full bg-slate-800/80 border border-slate-700/50 flex items-center justify-center shrink-0 shadow-inner">
                    <span className="text-[12px]">{option.icon}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-[13.5px] truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                      {option.label}
                    </p>
                  </div>
                  
                  {isSelected && <Check className="h-4 w-4 text-slate-300 shrink-0 font-bold" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
