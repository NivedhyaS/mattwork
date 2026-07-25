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
  Settings2,
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
    { name: 'projects', href: '/admin/projects', icon: FolderKanban },
    { name: 'users', href: '/admin/users', icon: Users },
    { name: 'clients', href: '/admin/clients', icon: Briefcase },
    { name: 'editors', href: '/admin/editors', icon: UserCheck },
    { name: 'invoices', href: '/admin/invoices', icon: FileSpreadsheet },
    { name: 'payments', href: '/admin/payments', icon: CreditCard },
    { name: 'forms', href: '/admin/forms', icon: Settings2 },
  ];

  const editorLinks = [
    { name: 'dashboard', href: '/editor/dashboard', icon: LayoutDashboard },
    { name: 'projects', href: '/editor/projects', icon: FolderKanban },
    { name: 'invoices', href: '/editor/invoices', icon: FileSpreadsheet },
  ];

  const clientLinks = [
    { name: 'dashboard', href: '/client', icon: LayoutDashboard },
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
        'hidden md:flex flex-col bg-[#F6EFE9] text-[#3D2E24] transition-all duration-300 relative h-screen sticky top-0 border-r-0',
        'shadow-[4px_0_12px_rgba(206,187,172,0.4)]',
        isCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Brand logo & collapse */}
      <div className={cn(
        "flex h-20 items-center transition-all duration-300 relative",
        isCollapsed ? "justify-center px-4" : "justify-between px-6"
      )}>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="h-10 w-10 flex items-center justify-center rounded-full bg-[#F6EFE9] text-[#EA580C] font-extrabold flex-shrink-0 shadow-[inset_3px_3px_6px_rgba(206,187,172,0.65),inset_-3px_-3px_6px_rgba(255,255,255,0.9)]">
            mw
          </div>
          {!isCollapsed && (
            <span className="font-extrabold text-xl tracking-tight text-[#3D2E24] select-none">
              mattwork
            </span>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-7 h-7 w-7 rounded-full bg-[#F6EFE9] flex items-center justify-center text-[#7C6A5A] hover:text-[#EA580C] focus:outline-none cursor-pointer z-10 shadow-[-3px_-3px_6px_rgba(255,255,255,0.9),3px_3px_6px_rgba(206,187,172,0.6)]"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 space-y-2.5 px-4 py-6 overflow-y-auto">
        <div className={cn("text-[10px] font-extrabold tracking-wider text-[#8C7769] uppercase px-3 mb-3", isCollapsed && "sr-only")}>
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
                'flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[15px] font-bold transition-all group relative',
                isActive
                  ? 'bg-[#F6EFE9] text-[#EA580C] shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)]'
                  : 'text-[#7C6A5A] hover:text-[#3D2E24] hover:shadow-[-4px_-4px_8px_rgba(255,255,255,0.9),4px_4px_8px_rgba(206,187,172,0.5)]'
              )}
            >
              <Icon className={cn("h-5 w-5 flex-shrink-0 transition-colors", isActive ? "text-[#EA580C]" : "text-[#8C7769] group-hover:text-[#EA580C]")} />
              {!isCollapsed && <span className="capitalize">{link.name}</span>}
              {isCollapsed && (
                <div className="absolute left-full rounded-xl px-3 py-1.5 ml-4 bg-[#3D2E24] text-white text-[12px] font-bold invisible opacity-0 -translate-x-2 transition-all group-hover:visible group-hover:opacity-100 group-hover:translate-x-0 z-50 shadow-lg">
                  {link.name}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Profile & Logout */}
      <div className="p-4 flex flex-col gap-2">
        <button
          onClick={logout}
          className={cn(
            'flex w-full items-center gap-3 px-4 py-3 rounded-2xl text-[15px] font-bold text-[#EF4444] transition-all cursor-pointer bg-[#F6EFE9] shadow-[-4px_-4px_8px_rgba(255,255,255,0.9),4px_4px_8px_rgba(206,187,172,0.5)] hover:shadow-[inset_3px_3px_6px_rgba(206,187,172,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]',
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
