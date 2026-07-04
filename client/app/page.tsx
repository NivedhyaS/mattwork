'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'ADMIN') {
        router.replace('/admin');
      } else if (user.role === 'EDITOR') {
        router.replace('/editor');
      } else if (user.role === 'CLIENT') {
        router.replace('/client');
      } else {
        router.replace('/unauthorized');
      }
    } else {
      router.replace('/login');
    }
  }, [isAuthenticated, user, router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
      <Loader2 className="h-8 w-8 animate-spin text-slate-900 dark:text-white" />
    </div>
  );
}
