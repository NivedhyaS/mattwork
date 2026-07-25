'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Loader2 } from 'lucide-react';

function RootPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isAuthenticated && user) {
      if (user.role === 'ADMIN') router.replace('/admin');
      else if (user.role === 'EDITOR') router.replace('/editor');
      else if (user.role === 'CLIENT') router.replace('/client');
      else router.replace('/unauthorized');
    } else {
      const q = searchParams ? searchParams.toString() : '';
      router.replace(q ? `/login?${q}` : '/login');
    }
  }, [isAuthenticated, user, searchParams, router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
      <Loader2 className="h-8 w-8 animate-spin text-slate-900 dark:text-white" />
    </div>
  );
}

export default function RootPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
          <Loader2 className="h-8 w-8 animate-spin text-slate-900 dark:text-white" />
        </div>
      }
    >
      <RootPageContent />
    </Suspense>
  );
}
