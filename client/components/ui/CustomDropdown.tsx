'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface CustomDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  icon?: ReactNode;
  align?: 'left' | 'right';
  disabled?: boolean;
}

export default function CustomDropdown({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  className = '',
  triggerClassName = '',
  icon,
  align = 'left',
  disabled = false,
}: CustomDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`
          flex items-center justify-between gap-2.5 px-4 py-2.5 h-11 rounded-2xl text-[13.5px] font-extrabold text-[#3D2E24]
          bg-[#F2ECE6] border-0 outline-none transition-all duration-200 cursor-pointer
          shadow-[-3px_-3px_6px_rgba(255,255,255,0.95),3px_3px_6px_rgba(182,168,156,0.65)]
          hover:shadow-[-4px_-4px_8px_rgba(255,255,255,0.98),4px_4px_8px_rgba(175,160,148,0.75)]
          active:shadow-[inset_2px_2px_4px_rgba(182,168,156,0.62)]
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${triggerClassName}
        `}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
          {icon && <span className="text-[#EA580C] shrink-0">{icon}</span>}
          {selected?.icon && <span className="shrink-0">{selected.icon}</span>}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#8C7769] transition-transform duration-200 ${open ? 'rotate-180 text-[#EA580C]' : ''}`} />
      </button>

      {/* Floating Neumorphic Popover Menu */}
      {open && (
        <div
          className={`
            absolute z-[80] mt-2 min-w-[210px] w-full max-h-[280px] overflow-y-auto custom-scrollbar
            rounded-3xl bg-[#F2ECE6] text-[#3D2E24] border-0 p-2 space-y-1
            shadow-[-10px_-10px_20px_rgba(255,255,255,0.95),10px_10px_20px_rgba(201,180,163,0.75)]
            ${align === 'right' ? 'right-0' : 'left-0'}
          `}
        >
          <ul role="listbox" className="space-y-0.5">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`
                    flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-extrabold cursor-pointer transition-all
                    ${isSelected
                      ? 'bg-[rgba(234,88,12,0.09)] text-[#EA580C]'
                      : 'hover:bg-[rgba(234,88,12,0.06)] hover:text-[#EA580C] text-[#3D2E24]'
                    }
                  `}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <span className="truncate">{opt.label}</span>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-[#EA580C] shrink-0 font-bold" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
