'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Check, ChevronDown, Loader2, UserX } from 'lucide-react';

export interface EditorOption {
  id: string;
  user: { id: string; name: string; email: string; avatar?: string | null };
  activeProjects: number;
  availability: boolean;
}

interface EditorComboboxProps {
  editors: EditorOption[];
  value: string | null;       // current editorId
  onChange: (editorId: string | null) => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

function getInitial(name: string) {
  return name?.charAt(0)?.toUpperCase() || 'E';
}

export default function EditorCombobox({
  editors,
  value,
  onChange,
  isLoading = false,
  disabled = false,
  className = '',
}: EditorComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = editors.find((e) => e.id === value) ?? null;

  // Filter options by query
  const filtered = query.trim()
    ? editors.filter((e) =>
        e.user.name.toLowerCase().includes(query.toLowerCase()) ||
        e.user.email.toLowerCase().includes(query.toLowerCase())
      )
    : editors;

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
      const total = filtered.length + 1; // +1 for "Unassign"
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % total);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + total) % total);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex === 0) {
          onChange(null);
          setOpen(false);
          setQuery('');
        } else if (activeIndex > 0 && filtered[activeIndex - 1]) {
          onChange(filtered[activeIndex - 1].id);
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

  function selectEditor(editorId: string | null) {
    onChange(editorId);
    setOpen(false);
    setQuery('');
  }

  const getBadgeStyle = (count: number) => {
    if (count > 5) return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
    if (count > 0) return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
    return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setOpen((o) => !o)}
        className={`
          w-full min-h-[44px] flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl text-left text-[14px]
          transition-all duration-200 outline-none border-0 bg-[#F6EFE9] text-[#3D2E24]
          shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)]
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
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
              <UserX className="h-3.5 w-3.5 text-[#EA580C]" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            {isLoading ? (
              <span className="text-[#EA580C] font-medium">Assigning…</span>
            ) : selected ? (
              <span className="font-extrabold text-[#3D2E24] truncate block">
                {selected.user.name}
              </span>
            ) : (
              <span className="text-[#EA580C] font-extrabold truncate block">Unassigned (click to assign)</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isLoading && selected && (
            <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0 bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
              {selected.activeProjects} active
            </span>
          )}
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 text-[#EA580C] ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-2 w-full min-w-[280px] sm:min-w-[320px] rounded-3xl border-0 bg-[#F6EFE9] text-[#3D2E24] shadow-[-10px_-10px_20px_rgba(255,255,255,0.95),10px_10px_20px_rgba(201,180,163,0.75)] p-3 space-y-2">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C7769]" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search editor by name or email..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
              onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-3.5 py-2.5 text-[13px] bg-[#F6EFE9] text-[#3D2E24] rounded-2xl border-0 font-semibold shadow-[inset_3px_3px_6px_rgba(206,187,172,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] placeholder:text-[#8C7769] focus:outline-none"
            />
          </div>

          {/* Options list */}
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-[260px] overflow-y-auto space-y-1 pr-0.5 custom-scrollbar"
          >
            {/* Unassign option */}
            <li
              role="option"
              aria-selected={value === null}
              onClick={() => selectEditor(null)}
              className={`
                flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all text-[13px]
                ${activeIndex === 0 ? 'bg-indigo-500/15 text-slate-100' : 'hover:bg-slate-800/60 text-slate-300'}
              `}
            >
              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center shrink-0">
                <UserX className="h-4 w-4 text-slate-400" />
              </div>
              <span className="flex-1 font-semibold text-slate-300">Unassigned</span>
              {value === null && <Check className="h-4 w-4 text-indigo-400 shrink-0 font-bold" />}
            </li>

            {/* Editor options */}
            {filtered.length === 0 ? (
              <li className="p-4 text-center text-[13px] text-slate-500 font-medium">
                No editors found matching "{query}"
              </li>
            ) : (
              filtered.map((editor, idx) => (
                <li
                  key={editor.id}
                  role="option"
                  aria-selected={editor.id === value}
                  onClick={() => selectEditor(editor.id)}
                  className={`
                    flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all
                    ${activeIndex === idx + 1 ? 'bg-indigo-500/15 text-slate-100' : 'hover:bg-slate-800/60 text-slate-200'}
                  `}
                >
                  {/* Avatar */}
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 text-indigo-300 font-extrabold border border-indigo-500/30 flex items-center justify-center text-[12px] shrink-0 shadow-xs overflow-hidden">
                    {editor.user.avatar ? (
                      <img src={editor.user.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      getInitial(editor.user.name)
                    )}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[13.5px] text-slate-100 truncate">
                      {editor.user.name}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium truncate">{editor.user.email}</p>
                  </div>

                  {/* Active project count */}
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${getBadgeStyle(editor.activeProjects)}`}>
                    {editor.activeProjects} active
                  </span>

                  {editor.id === value && <Check className="h-4 w-4 text-indigo-400 shrink-0 font-bold" />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
