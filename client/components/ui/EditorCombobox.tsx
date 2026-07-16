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
          // Unassign
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

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setOpen((o) => !o)}
        className={`
          w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-[13px]
          transition-all duration-150
          ${open
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-900'
            : selected
              ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 text-slate-800 dark:text-slate-200'
              : 'border-indigo-500/30 bg-indigo-500/5 dark:bg-indigo-500/10 hover:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500 flex-shrink-0" />
        ) : selected ? (
          <div
            className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-bold shrink-0 text-indigo-700 dark:text-indigo-300 overflow-hidden"
          >
            {selected.user.avatar ? (
              <img src={selected.user.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              getInitial(selected.user.name)
            )}
          </div>
        ) : (
          <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
            <UserX className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {isLoading ? (
            <span className="text-indigo-600 dark:text-indigo-400 font-medium">Assigning…</span>
          ) : selected ? (
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
              {selected.user.name}
            </span>
          ) : (
            <span className="text-indigo-600 dark:text-indigo-400 font-bold truncate block">Unassigned (click to assign)</span>
          )}
        </div>

        {!isLoading && selected && (
          <span className={`
            text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0
            ${selected.activeProjects > 0
              ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
            }
          `}>
            {selected.activeProjects} active
          </span>
        )}

        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${selected ? 'text-slate-400' : 'text-indigo-500 dark:text-indigo-400'} ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[260px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search editors…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
                onKeyDown={handleKeyDown}
                className="w-full pl-8 pr-3 py-1.5 text-[13px] bg-slate-50 dark:bg-slate-800 rounded-lg border-0 outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/30 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Options list */}
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-[260px] overflow-y-auto py-1 overscroll-contain"
          >
            {/* Unassign option */}
            <li
              role="option"
              aria-selected={value === null}
              onClick={() => selectEditor(null)}
              className={`
                flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors text-[13px]
                ${activeIndex === 0 ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}
              `}
            >
              <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <UserX className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <span className="flex-1 text-slate-500 italic">Unassigned</span>
              {value === null && <Check className="h-3.5 w-3.5 text-indigo-500 shrink-0" />}
            </li>

            {/* Editor options */}
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-[13px] text-slate-400 italic">
                No editors found
              </li>
            ) : (
              filtered.map((editor, idx) => (
                <li
                  key={editor.id}
                  role="option"
                  aria-selected={editor.id === value}
                  onClick={() => selectEditor(editor.id)}
                  className={`
                    flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors
                    ${activeIndex === idx + 1 ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}
                  `}
                >
                  {/* Avatar */}
                  <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[11px] font-bold shrink-0 text-indigo-700 dark:text-indigo-300 overflow-hidden">
                    {editor.user.avatar ? (
                      <img src={editor.user.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      getInitial(editor.user.name)
                    )}
                  </div>

                  {/* Name + workload */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[13px] text-slate-800 dark:text-slate-200 truncate">
                      {editor.user.name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{editor.user.email}</p>
                  </div>

                  {/* Active project count */}
                  <span className={`
                    text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0
                    ${editor.activeProjects > 5
                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'
                      : editor.activeProjects > 0
                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                    }
                  `}>
                    {editor.activeProjects} active
                  </span>

                  {editor.id === value && <Check className="h-3.5 w-3.5 text-indigo-500 shrink-0" />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
