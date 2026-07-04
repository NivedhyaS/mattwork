'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { 
  Bell, 
  Search, 
  Loader2, 
  CheckCircle2,
  Trash2,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import Button from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';

const NOTIFICATION_TYPES: Record<string, { icon: React.ReactNode; color: string }> = {
  PROJECT_STATUS_CHANGED: { icon: <Bell className="h-4 w-4" />, color: 'bg-blue-50 text-blue-600' },
  INVOICE_PAID: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-emerald-50 text-emerald-600' },
  SYSTEM_ALERT: { icon: <Bell className="h-4 w-4" />, color: 'bg-rose-50 text-rose-600' },
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  const { isAuthenticated } = useAuthStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications?limit=100');
      return res.data;
    },
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 30_000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = (data?.data || []).filter((n: any) => 
    filter === 'ALL' ? true : !n.isRead
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[36px] font-bold tracking-tight text-slate-900 dark:text-white">
            Notifications
          </h1>
          <p className="text-[15px] text-slate-500 dark:text-slate-400 mt-1">
            System alerts and project updates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={filter === 'ALL' ? 'primary' : 'outline'} 
            size="sm" 
            onClick={() => setFilter('ALL')}
            className="cursor-pointer"
          >
            All
          </Button>
          <Button 
            variant={filter === 'UNREAD' ? 'primary' : 'outline'} 
            size="sm" 
            onClick={() => setFilter('UNREAD')}
            className="cursor-pointer"
          >
            Unread
          </Button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
              <p className="text-sm text-slate-500 font-medium">Loading notifications...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20 flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-rose-500" />
            </div>
            <div>
              <p className="font-bold text-[16px] text-rose-600 dark:text-rose-400">Failed to load notifications</p>
              <p className="text-[14px] text-slate-400 mt-1">
                {(error as any)?.response?.data?.message || (error as any)?.message || 'Could not reach the server.'}
              </p>
            </div>
            <button onClick={() => refetch()} className="flex items-center gap-2 text-[14px] font-semibold border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer">
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-24 flex flex-col items-center">
            <div className="h-16 w-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
              <Bell className="h-8 w-8 text-slate-300 dark:text-slate-700" />
            </div>
            <p className="font-bold text-slate-700 dark:text-slate-300">No notifications found</p>
            <p className="text-sm text-slate-400 mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-900">
            {notifications.map((notification: any) => {
              const typeConfig = NOTIFICATION_TYPES[notification.type] || { icon: <Bell className="h-4 w-4" />, color: 'bg-slate-100 text-slate-600' };
              
              return (
                <div 
                  key={notification.id} 
                  className={`p-5 flex items-start gap-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/30 ${!notification.isRead ? 'bg-indigo-50/30 dark:bg-indigo-950/10' : ''}`}
                >
                  <div className={`p-2 rounded-xl mt-1 shrink-0 ${typeConfig.color}`}>
                    {typeConfig.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className={`text-[15px] font-bold ${!notification.isRead ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                          {notification.title}
                        </h4>
                        <p className="text-[14px] text-slate-500 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-[13px] font-semibold text-slate-400">
                          {new Date(notification.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {!notification.isRead && (
                          <button 
                            onClick={() => markAsReadMutation.mutate(notification.id)}
                            disabled={markAsReadMutation.isPending}
                            className="text-[13px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
