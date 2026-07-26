'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Check, ChevronDown, Loader2, User } from 'lucide-react';

export interface ClientOption {
  id: string;
  user: { id: string; name: string; email: string; avatar?: string | null };
  company?: string | null;
}

interface ClientComboboxProps {
  clients: ClientOption[];
  value: string;
  onChange: (clientId: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

function getInitial(name: string) {
  return name?.charAt(0)?.toUpperCase() || 'C';
}

export default function ClientCombobox({
  clients,
  value,
  onChange,
  isLoading = false,
  disabled = false,
  className = '',
}: ClientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = clients.find((c) => c.id === value) ?? null;

  // Filter options by query
  const filtered = query.trim()
    ? clients.filter((c) =>
        c.user.name.toLowerCase().includes(query.toLowerCase()) ||
        c.user.email.toLowerCase().includes(query.toLowerCase()) ||
        (c.company && c.company.toLowerCase().includes(query.toLowerCase()))
      )
    : clients;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setActiveIndex(-1);
    }
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const total = filtered.length;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % total);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + total) % total);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && filtered[activeIndex]) {
          onChange(filtered[activeIndex].id);
          setOpen(false);
          setQuery('');
        }
      } else if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    },
    [activeIndex, filtered, onChange]
  );

  function selectClient(clientId: string) {
    onChange(clientId);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setOpen((o) => !o)}
        className={`
          w-full h-11 flex items-center justify-between gap-3 px-4 py-2 rounded-2xl text-left text-[14px]
          transition-all duration-200 outline-none border-0 bg-[#F6EFE9] text-[#3D2E24]
          shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)]
          ${(disabled || isLoading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#EA580C] shrink-0" />
          ) : selected ? (
            <div className="h-7 w-7 rounded-full bg-[#F6EFE9] text-[#EA580C] font-extrabold flex items-center justify-center text-[11px] shrink-0 overflow-hidden shadow-[inset_2px_2px_4px_rgba(206,187,172,0.6),inset_-2px_-2px_4px_rgba(255,255,255,0.85)]">
              {selected.user.avatar ? (
                <img src={selected.user.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                getInitial(selected.user.name)
              )}
            </div>
          ) : (
            <div className="h-7 w-7 rounded-full bg-[#F6EFE9] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.6),inset_-2px_-2px_4px_rgba(255,255,255,0.85)] flex items-center justify-center shrink-0">
              <User className="h-3.5 w-3.5 text-[#EA580C]" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            {isLoading ? (
              <span className="text-[#8C7769] font-medium">Saving…</span>
            ) : selected ? (
              <span className="font-extrabold text-[#3D2E24] truncate block">
                {selected.user.name} {selected.company ? `(${selected.company})` : ''}
              </span>
            ) : (
              <span className="text-[#8C7769] font-semibold truncate block">Select client...</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 text-[#8C7769] ${open ? 'rotate-180 text-[#EA580C]' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute z-[60] mt-2 w-full min-w-[260px] rounded-3xl border-0 bg-[#F6EFE9] text-[#3D2E24] shadow-[-10px_-10px_20px_rgba(255,255,255,0.95),10px_10px_20px_rgba(201,180,163,0.75)] p-3 space-y-2">
          {/* Search input if multiple clients */}
          {clients.length > 4 && (
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C7769]" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search client by name or company..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
                onKeyDown={handleKeyDown}
                className="w-full pl-10 pr-3.5 py-2.5 text-[13px] bg-[#F6EFE9] text-[#3D2E24] rounded-2xl border-0 font-semibold shadow-[inset_3px_3px_6px_rgba(206,187,172,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] placeholder:text-[#8C7769] focus:outline-none"
              />
            </div>
          )}

          {/* Options list */}
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-[240px] overflow-y-auto space-y-1 custom-scrollbar"
          >
            {filtered.length === 0 ? (
              <li className="p-4 text-center text-[13px] text-[#8C7769] font-medium">
                No clients found
              </li>
            ) : (
              filtered.map((client, idx) => {
                const isSelected = client.id === value;
                const isActive = activeIndex === idx;
                return (
                  <li
                    key={client.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectClient(client.id)}
                    className={`
                      flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all
                      ${isActive ? 'bg-[rgba(234,88,12,0.08)]' : 'hover:bg-[rgba(234,88,12,0.05)]'}
                      ${isSelected && !isActive ? 'bg-[rgba(234,88,12,0.04)]' : ''}
                    `}
                  >
                    <div className="h-8 w-8 rounded-full bg-[#F6EFE9] text-[#EA580C] font-extrabold shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] flex items-center justify-center text-[12px] shrink-0 overflow-hidden">
                      {client.user.avatar ? (
                        <img src={client.user.avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        getInitial(client.user.name)
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-[13.5px] text-[#3D2E24] truncate">
                        {client.user.name}
                      </p>
                      {client.company && (
                        <p className="text-[11.5px] text-[#8C7769] font-semibold truncate">{client.company}</p>
                      )}
                    </div>

                    {isSelected && <Check className="h-4 w-4 text-[#EA580C] shrink-0 font-bold" />}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
