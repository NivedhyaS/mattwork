'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { LogOut, User as UserIcon, Settings, Lock } from 'lucide-react';
import Link from 'next/link';

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuthStore();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors focus:outline-none cursor-pointer"
      >
        <div className="h-8 w-8 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-bold text-sm shadow-sm">
          {user.name.charAt(0)}
        </div>
        <span className="hidden sm:inline text-[15px] font-semibold text-slate-700 dark:text-slate-200">
          {user.name}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-2 shadow-xl z-50">
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-900 mb-1.5">
            <p className="text-[15px] font-bold text-slate-800 dark:text-slate-100 truncate">{user.name}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{user.email}</p>
          </div>

          <div className="space-y-0.5">
            <button
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
