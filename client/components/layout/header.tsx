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
    <header className="h-20 bg-[#F6EFE9] px-8 flex items-center justify-between sticky top-0 z-30 shadow-[0_4px_12px_rgba(206,187,172,0.3)]">
      {/* Left side: Menu button & breadcrumbs */}
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden rounded-2xl p-2.5 bg-[#F6EFE9] text-[#7C6A5A] hover:text-[#EA580C] transition-all shadow-[-3px_-3px_6px_rgba(255,255,255,0.9),3px_3px_6px_rgba(206,187,172,0.6)]"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {/* Breadcrumb Navigation */}
        <nav className="hidden sm:flex items-center gap-2 text-[15px] font-bold select-none text-[#7C6A5A]">
          <Link href="/" className="text-[#8C7769] hover:text-[#EA580C] transition-colors">
            Mattwork
          </Link>
          {breadcrumbs.map((crumb) => (
            <div key={crumb.href} className="flex items-center gap-2">
              <span className="text-[#BCAEA2]">/</span>
              {crumb.isLast ? (
                <span className="text-[#3D2E24] font-extrabold capitalize truncate max-w-[120px] sm:max-w-none">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-[#8C7769] hover:text-[#EA580C] transition-colors capitalize"
                >
                  {crumb.label}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Right side: Notifications, theme toggle & user dropdown */}
      <div className="flex items-center gap-4">
        {/* Notification Icon Dropdown */}
        <NotificationDropdown />

        {/* Theme Toggle Pill Button */}
        <button
          onClick={toggleTheme}
          title="Toggle color mode"
          className="rounded-2xl p-2.5 bg-[#F6EFE9] text-[#7C6A5A] hover:text-[#EA580C] transition-all shadow-[-4px_-4px_8px_rgba(255,255,255,0.9),4px_4px_8px_rgba(206,187,172,0.6)] active:shadow-[inset_3px_3px_6px_rgba(206,187,172,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5 text-[#F97316]" />
          ) : (
            <Moon className="h-5 w-5 text-[#7C6A5A]" />
          )}
        </button>

        {/* User Account Menu */}
        <UserMenu />
      </div>
    </header>
  );
}
