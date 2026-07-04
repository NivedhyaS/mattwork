'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, MailOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@/lib/utils';

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notificationsData, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications');
      return res.data;
    },
  });

  // Fetch unread count
  const { data: unreadCountData } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: async () => {
      const res = await api.get('/notifications/unread-count');
      return res.data.data;
    },
    refetchInterval: 15000, // Poll count every 15s
  });

  const notifications = notificationsData?.data || [];
  const unreadCount = unreadCountData?.count || 0;

  // Mark single as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.post('/notifications/mark-all-read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });

  // Clear read notifications mutation
  const clearReadMutation = useMutation({
    mutationFn: async () => {
      await api.post('/notifications/clear-read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900 transition-colors cursor-pointer"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-950 animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-xl z-50 flex flex-col max-h-96">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-3">
            <h4 className="font-bold text-sm">Notifications</h4>
            <div className="flex gap-2">
              <button
                onClick={() => markAllReadMutation.mutate()}
                title="Mark all as read"
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => clearReadMutation.mutate()}
                title="Clear read"
                className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 py-3 select-none pr-1">
            {notifications.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                You are all caught up!
              </div>
            ) : (
              notifications.map((notif: any) => (
                <div
                  key={notif.id}
                  onClick={() => !notif.isRead && markReadMutation.mutate(notif.id)}
                  className={`flex flex-col gap-1 p-2 rounded-lg text-xs cursor-pointer border transition-all ${
                    notif.isRead
                      ? 'border-transparent text-slate-400 dark:text-slate-500'
                      : 'border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-900/80 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="truncate">{notif.title}</span>
                    {!notif.isRead && (
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <p className="leading-relaxed">{notif.message}</p>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 text-right mt-1">
                    {formatDate(notif.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
