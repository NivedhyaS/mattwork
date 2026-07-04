'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function UnauthorizedPage() {
  const { logout } = useAuthStore();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="max-w-md w-full text-center space-y-6 bg-white dark:bg-slate-950 p-8 rounded-2xl border border-slate-200 dark:border-slate-850 shadow-lg">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/20 text-rose-500">
          <ShieldAlert className="h-10 w-10 animate-bounce" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight">Access Denied</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            You do not have administrative permissions to view this section of the platform.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={() => logout()}
            className="w-full inline-flex justify-center items-center px-4 py-2 text-sm font-semibold rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
          >
            Sign Out & Re-login
          </button>
        </div>
      </div>
    </div>
  );
}
