'use client';

import { useThemeStore } from '@/store/themeStore';
import { Sun, Moon, Menu } from 'lucide-react';
import NotificationDropdown from './notification-dropdown';
import UserMenu from './user-menu';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useThemeStore();

  // Generate simple breadcrumbs from route pathname
  const pathSegments = pathname.split('/').filter(Boolean);
  const breadcrumbs = pathSegments.map((segment, index) => {
    const href = '/' + pathSegments.slice(0, index + 1).join('/');
    const label = segment.toLowerCase();
    const isLast = index === pathSegments.length - 1;

    return { href, label, isLast };
  });

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left side: Menu button & breadcrumbs */}
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900 transition-colors focus:outline-none"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {/* Breadcrumb Navigation */}
        <nav className="hidden sm:flex items-center gap-1.5 text-[15px] font-semibold select-none">
          <Link href="/" className="text-slate-500 hover:text-slate-950 dark:hover:text-white transition-colors">
            Mattwork
          </Link>
          {breadcrumbs.map((crumb, idx) => (
            <div key={crumb.href} className="flex items-center gap-1.5">
              <span className="text-slate-350 dark:text-slate-600">/</span>
              {crumb.isLast ? (
                <span className="text-slate-950 dark:text-white truncate max-w-[120px] sm:max-w-none">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-slate-500 hover:text-slate-950 dark:hover:text-white transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-3">
        {/* Light/Dark Mode Switcher */}
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900 transition-colors cursor-pointer"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} mode`}
        >
          {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </button>

        {/* Notification dropdown */}
        <NotificationDropdown />

        <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800" />

        {/* Profile User Menu */}
        <UserMenu />
      </div>
    </header>
  );
}
