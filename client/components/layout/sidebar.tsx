'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Briefcase,
  UserCheck,
  FileSpreadsheet,
  CreditCard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { cn, checkActiveRoute } from '@/lib/utils';
import { useState } from 'react';

export default function Sidebar() {
  const pathname = usePathname();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const adminLinks = [
    { name: 'dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'financials', href: '/admin/financials', icon: CreditCard },
    { name: 'reports', href: '/admin/reports', icon: FileSpreadsheet },
    { name: 'board', href: '/admin/board', icon: TrendingUp },
    { name: 'projects', href: '/admin/projects', icon: FolderKanban },
    { name: 'users', href: '/admin/users', icon: Users },
    { name: 'clients', href: '/admin/clients', icon: Briefcase },
    { name: 'editors', href: '/admin/editors', icon: UserCheck },
    { name: 'invoices', href: '/admin/invoices', icon: FileSpreadsheet },
    { name: 'payments', href: '/admin/payments', icon: CreditCard },
  ];

  const editorLinks = [
    { name: 'dashboard', href: '/editor', icon: LayoutDashboard },
    { name: 'board', href: '/editor/board', icon: TrendingUp },
    { name: 'invoices', href: '/editor/invoices', icon: FileSpreadsheet },
  ];

  const clientLinks = [
    { name: 'dashboard', href: '/client', icon: LayoutDashboard },
    { name: 'board', href: '/client/board', icon: TrendingUp },
    { name: 'invoices', href: '/client/invoices', icon: FileSpreadsheet },
  ];

  const getLinks = () => {
    if (!user) return [];
    switch (user.role) {
      case 'ADMIN':
        return adminLinks;
      case 'EDITOR':
        return editorLinks;
      case 'CLIENT':
        return clientLinks;
      default:
        return [];
    }
  };

  const getRoleLabel = () => {
    if (!user) return '';
    switch (user.role) {
      case 'ADMIN':
        return 'platform admin';
      case 'EDITOR':
        return 'editor portal';
      case 'CLIENT':
        return 'client portal';
      default:
        return '';
    }
  };

  const links = getLinks();

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r border-border bg-card text-foreground transition-all duration-300 relative h-screen sticky top-0',
        isCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Brand logo & collapse */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-border">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium flex-shrink-0">
            mw
          </div>
          {!isCollapsed && (
            <span className="font-medium text-lg tracking-tight select-none">
              mattwork
            </span>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-5 h-6 w-6 rounded-full border border-border bg-card flex items-center justify-center text-slate-400 hover:text-slate-655 focus:outline-none cursor-pointer"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 space-y-1.5 px-4 py-6 overflow-y-auto">
        <div className={cn("text-[10px] font-medium tracking-wider text-slate-400 uppercase px-2 mb-2", isCollapsed && "sr-only")}>
          {getRoleLabel()}
        </div>
        {links.map((link) => {
          const isActive = checkActiveRoute(pathname, link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 px-3.5 py-3 rounded-lg text-[16px] transition-all group relative',
                isActive
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-medium'
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span>{link.name}</span>}
              {isCollapsed && (
                <div className="absolute left-full rounded-md px-2 py-1 ml-6 bg-slate-900 text-white text-[11px] invisible opacity-0 -translate-x-3 transition-all group-hover:visible group-hover:opacity-100 group-hover:translate-x-0 z-50">
                  {link.name}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Profile & Logout */}
      <div className="p-4 border-t border-border flex flex-col gap-2">
        {!isCollapsed && user && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-slate-50/50 dark:bg-slate-900/50">
            <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-semibold text-slate-800 dark:text-white flex-shrink-0">
              {user.name.charAt(0).toLowerCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate text-slate-800 dark:text-slate-200">
                {user.name}
              </p>
              <p className="text-[11px] truncate text-slate-400">
                {user.role.toLowerCase()}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className={cn(
            'flex w-full items-center gap-3 px-3.5 py-3 rounded-lg text-[16px] font-semibold text-status-red hover:bg-status-red/5 transition-all border border-transparent hover:border-status-red/10 cursor-pointer',
            isCollapsed && 'justify-center'
          )}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span>sign out</span>}
        </button>
      </div>
    </aside>
  );
}
