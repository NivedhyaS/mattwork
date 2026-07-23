'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    console.log('[DashboardLayout] mounted');
    setIsMounted(true);
  }, []);

  useEffect(() => {
    console.log('[DashboardLayout] auth state checked:', { isMounted, isAuthenticated, role: user?.role, pathname });
    if (isMounted) {
      if (!isAuthenticated) {
        console.log('[DashboardLayout] Unauthenticated -> Redirecting to /login via window.location');
        window.location.href = '/login';
      } else if (pathname.startsWith('/admin') && user?.role !== 'ADMIN') {
        console.log('[DashboardLayout] Unauthorized role -> Redirecting');
        window.location.href = '/unauthorized';
      } else if (pathname.startsWith('/client') && user?.role !== 'CLIENT') {
        console.log('[DashboardLayout] Unauthorized role -> Redirecting');
        window.location.href = '/unauthorized';
      } else if (pathname.startsWith('/editor') && user?.role !== 'EDITOR') {
        console.log('[DashboardLayout] Unauthorized role -> Redirecting');
        window.location.href = '/unauthorized';
      }
    }
  }, [isMounted, isAuthenticated, user, router, pathname]);

  if (!isMounted || !isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-slate-900 dark:text-white" />
          <p className="text-sm font-semibold text-slate-500">Checking credentials...</p>
        </div>
      </div>
    );
  }

  // Double check route guards
  if (pathname.startsWith('/admin') && user?.role !== 'ADMIN') {
    return null;
  }
  if (pathname.startsWith('/client') && user?.role !== 'CLIENT') {
    return null;
  }
  if (pathname.startsWith('/editor') && user?.role !== 'EDITOR') {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Side Navigation */}
      <Sidebar />

      {/* Main Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
