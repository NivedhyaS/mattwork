'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Layers,
  Timer,
  CircleCheck,
  CalendarClock,
  TrendingUp,
  Hourglass,
  RefreshCw,
  FileEdit,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useExchangeRate, formatFetchedAgo } from '@/lib/exchangeRate';
import { formatCurrency, formatEditorCurrency } from '@/lib/utils';
import { calculateFinancialMetrics } from '@/lib/projectMetrics';
import Link from 'next/link';
import Button from '@/components/ui/button';

const V = {
  accent:  '#7c3aed',
  neutral: '#94a3b8',
  green:   '#10b981',
  amber:   '#f59e0b',
  red:     '#ef4444',
  muted:   '#71717a',
};

export default function AdminDashboard() {
  const { rate: exchangeRate } = useExchangeRate(true);
  const queryClient = useQueryClient();

  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'INR'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin_display_currency');
      if (saved === 'USD' || saved === 'INR') {
        return saved;
      }
    }
    return 'USD';
  });

  const handleCurrencyChange = (curr: 'USD' | 'INR') => {
    setDisplayCurrency(curr);
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_display_currency', curr);
    }
  };

  const { data: projectsData, refetch: refetchProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects?limit=1000');
      return res.data;
    },
  });

  const { data: invoicesData, refetch: refetchInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await api.get('/invoices?limit=1000');
      return res.data;
    },
  });

  const { data: editorsData, refetch: refetchEditors } = useQuery({
    queryKey: ['editors'],
    queryFn: async () => {
      const res = await api.get('/editors?limit=1000');
      return res.data;
    },
  });

  const { data: clientsData, refetch: refetchClients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await api.get('/clients?limit=1000');
      return res.data;
    },
  });

  const handleRefresh = async () => {
    await Promise.all([
      refetchProjects(),
      refetchInvoices(),
      refetchEditors(),
      refetchClients(),
    ]);
  };

  const projects = projectsData?.data || [];
  const invoices = invoicesData?.data || [];
  const editors  = editorsData?.data  || [];
  const clients  = clientsData?.data  || [];

  const rate = exchangeRate ? exchangeRate.usdToInr : 83.5;

  const metrics = calculateFinancialMetrics(projects, invoices, clients, editors, rate);

  // Formatted string representations
  const profitFormatted = displayCurrency === 'USD'
    ? formatCurrency(metrics.totalNetMarginUsd)
    : formatEditorCurrency(metrics.totalNetMarginInr);

  const handleReviewRevision = async (projectId: string, reqId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await api.patch(`/projects/${projectId}/revision-request/review`, { status, reqId });
      refetchProjects();
    } catch (error) {
      console.error('Failed to review revision:', error);
      alert('Failed to process review.');
    }
  };

  return (
    <div className="space-y-8 bg-[#F6EFE9] text-[#3D2E24] p-1">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[36px] font-extrabold tracking-tight text-[#3D2E24] leading-tight">
            Platform Overview
          </h1>
          <p className="text-[16px] mt-1 text-[#7C6A5A]">
            Real-time metrics, pipeline analytics, and editor workloads.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <button
            onClick={handleRefresh}
            className="h-10 px-4 font-bold text-[14px] text-[#3D2E24] bg-[#F6EFE9] rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-[-4px_-4px_8px_rgba(255,255,255,0.9),4px_4px_8px_rgba(206,187,172,0.6)] hover:shadow-[-6px_-6px_12px_rgba(255,255,255,0.95),6px_6px_12px_rgba(201,180,163,0.7)] active:shadow-[inset_3px_3px_6px_rgba(206,187,172,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]"
          >
            <RefreshCw className="mr-2 h-4 w-4 text-[#EA580C]" />
            Refresh
          </button>

          {exchangeRate && (
            <div className="text-[12px] text-[#8C7769] font-bold px-3 py-2 rounded-xl shadow-[inset_2px_2px_5px_rgba(206,187,172,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.8)]">
              1 USD = ₹{exchangeRate.usdToInr.toFixed(2)} · {formatFetchedAgo(exchangeRate.fetchedAt)}
            </div>
          )}

          {/* Currency Toggle */}
          <div className="flex items-center bg-[#F6EFE9] p-1.5 rounded-2xl shadow-[inset_3px_3px_6px_rgba(206,187,172,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]">
            <button
              onClick={() => handleCurrencyChange('USD')}
              className={`px-4 py-2 rounded-xl text-[13px] font-extrabold transition-all cursor-pointer ${
                displayCurrency === 'USD'
                  ? 'bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white shadow-[-3px_-3px_6px_rgba(255,255,255,0.7),3px_3px_8px_rgba(234,88,12,0.4)]'
                  : 'text-[#7C6A5A] hover:text-[#3D2E24]'
              }`}
            >
              USD ($)
            </button>
            <button
              onClick={() => handleCurrencyChange('INR')}
              className={`px-4 py-2 rounded-xl text-[13px] font-extrabold transition-all cursor-pointer ${
                displayCurrency === 'INR'
                  ? 'bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white shadow-[-3px_-3px_6px_rgba(255,255,255,0.7),3px_3px_8px_rgba(234,88,12,0.4)]'
                  : 'text-[#7C6A5A] hover:text-[#3D2E24]'
              }`}
            >
              INR (₹)
            </button>
          </div>
        </div>
      </div>

      {/* Row 1: Total, Active, Completed, Deadlines */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total projects */}
        <div className="p-6 bg-[#F6EFE9] rounded-3xl shadow-[-8px_-8px_16px_rgba(255,255,255,0.9),8px_8px_16px_rgba(206,187,172,0.65)] hover:shadow-[-10px_-10px_20px_rgba(255,255,255,0.95),10px_10px_20px_rgba(201,180,163,0.75)] transition-all space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-extrabold uppercase tracking-wider text-[#8C7769]">Total Projects</span>
            <div className="h-10 w-10 rounded-full flex items-center justify-center bg-[#F6EFE9] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]">
              <Layers className="h-5 w-5 text-[#8C7769]" />
            </div>
          </div>
          <div>
            <div className="kpi-figure text-[38px] font-extrabold text-[#3D2E24]">{metrics.totalProjects}</div>
            <p className="text-[12px] text-[#7C6A5A] mt-1">All videos in system</p>
          </div>
        </div>

        {/* Active projects */}
        <div className="p-6 bg-[#F6EFE9] rounded-3xl shadow-[-8px_-8px_16px_rgba(255,255,255,0.9),8px_8px_16px_rgba(206,187,172,0.65)] hover:shadow-[-10px_-10px_20px_rgba(255,255,255,0.95),10px_10px_20px_rgba(201,180,163,0.75)] transition-all space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-extrabold uppercase tracking-wider text-[#8C7769]">Active Projects</span>
            <div className="h-10 w-10 rounded-full flex items-center justify-center bg-[#F6EFE9] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]">
              <Timer className="h-5 w-5 text-[#EA580C]" />
            </div>
          </div>
          <div>
            <div className="kpi-figure text-[38px] font-extrabold text-[#EA580C]">{metrics.activeProjects}</div>
            <p className="text-[12px] text-[#7C6A5A] mt-1">Currently in edit pipeline</p>
          </div>
        </div>

        {/* Completed projects */}
        <div className="p-6 bg-[#F6EFE9] rounded-3xl shadow-[-8px_-8px_16px_rgba(255,255,255,0.9),8px_8px_16px_rgba(206,187,172,0.65)] hover:shadow-[-10px_-10px_20px_rgba(255,255,255,0.95),10px_10px_20px_rgba(201,180,163,0.75)] transition-all space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-extrabold uppercase tracking-wider text-[#8C7769]">Completed</span>
            <div className="h-10 w-10 rounded-full flex items-center justify-center bg-[#F6EFE9] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]">
              <CircleCheck className="h-5 w-5 text-[#10B981]" />
            </div>
          </div>
          <div>
            <div className="kpi-figure text-[38px] font-extrabold text-[#10B981]">{metrics.completedProjects}</div>
            <p className="text-[12px] text-[#7C6A5A] mt-1">Approved and delivered videos</p>
          </div>
        </div>

        {/* Upcoming deadlines */}
        <div className="p-6 bg-[#F6EFE9] rounded-3xl shadow-[-8px_-8px_16px_rgba(255,255,255,0.9),8px_8px_16px_rgba(206,187,172,0.65)] hover:shadow-[-10px_-10px_20px_rgba(255,255,255,0.95),10px_10px_20px_rgba(201,180,163,0.75)] transition-all space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-extrabold uppercase tracking-wider text-[#8C7769]">Deadlines</span>
            <div className="h-10 w-10 rounded-full flex items-center justify-center bg-[#F6EFE9] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]">
              <CalendarClock className="h-5 w-5 text-[#EF4444]" />
            </div>
          </div>
          <div>
            <div className="kpi-figure text-[38px] font-extrabold text-[#EF4444]">{metrics.upcomingDeadlines}</div>
            <p className="text-[12px] text-[#7C6A5A] mt-1">Due within next 7 days</p>
          </div>
        </div>
      </div>

      {/* Row 2: Net Profit, Pending Payments */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Net Margin */}
        <Link href="/admin/financials" className="block transition-transform hover:-translate-y-1">
          <div className="p-6 bg-[#F6EFE9] rounded-3xl shadow-[-8px_-8px_16px_rgba(255,255,255,0.9),8px_8px_16px_rgba(206,187,172,0.65)] hover:shadow-[-10px_-10px_20px_rgba(255,255,255,0.95),10px_10px_20px_rgba(201,180,163,0.75)] transition-all space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-extrabold uppercase tracking-wider text-[#8C7769]">Net Profit</span>
              <div className="h-10 w-10 rounded-full flex items-center justify-center bg-[#F6EFE9] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]">
                <TrendingUp className="h-5 w-5 text-[#10B981]" />
              </div>
            </div>
            <div>
              <div className="kpi-figure text-[38px] font-extrabold text-[#10B981]">{profitFormatted}</div>
              <p className="text-[12px] text-[#7C6A5A] mt-1">Net operating margin (Click for Financials)</p>
            </div>
          </div>
        </Link>

        {/* Pending payments */}
        <div className="p-6 bg-[#F6EFE9] rounded-3xl shadow-[-8px_-8px_16px_rgba(255,255,255,0.9),8px_8px_16px_rgba(206,187,172,0.65)] hover:shadow-[-10px_-10px_20px_rgba(255,255,255,0.95),10px_10px_20px_rgba(201,180,163,0.75)] transition-all space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-extrabold uppercase tracking-wider text-[#8C7769]">Pending Payments</span>
            <div className="h-10 w-10 rounded-full flex items-center justify-center bg-[#F6EFE9] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]">
              <Hourglass className="h-5 w-5 text-[#F59E0B]" />
            </div>
          </div>
          <div>
            <div className="kpi-figure text-[38px] font-extrabold text-[#F59E0B]">
              {invoices.filter((inv: any) => !['PAID','CANCELLED'].includes(inv.status)).length}
            </div>
            <p className="text-[12px] text-[#7C6A5A] mt-1">Invoices awaiting clearance</p>
          </div>
        </div>
      </div>

      {/* Row 3: Pending Revision Approvals & Other/Unassigned */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pending Revision Approvals List */}
        <div className="lg:col-span-2 p-6 bg-[#F6EFE9] rounded-3xl shadow-[-8px_-8px_16px_rgba(255,255,255,0.9),8px_8px_16px_rgba(206,187,172,0.65)] flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-transparent pb-3">
            <div>
              <h3 className="text-[18px] font-extrabold text-[#3D2E24] tracking-tight flex items-center gap-2">
                <FileEdit className="h-5 w-5 text-[#EF4444]" />
                Pending Revision Approvals
              </h3>
              <p className="text-[13px] text-[#7C6A5A] mt-1">
                Client requested revisions waiting for your approval to be sent to editors.
              </p>
            </div>
            <div className="bg-[#F6EFE9] text-[#EF4444] px-4 py-1.5 rounded-2xl font-extrabold text-xs shadow-[inset_2px_2px_5px_rgba(206,187,172,0.6),inset_-2px_-2px_5px_rgba(255,255,255,0.85)]">
              {metrics.pendingRevisionsCount} Pending
            </div>
          </div>

          <div className="flex-1">
            {metrics.pendingRevisionsCount === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-8 bg-[#F6EFE9] rounded-2xl shadow-[inset_3px_3px_6px_rgba(206,187,172,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]">
                <div className="h-10 w-10 rounded-full bg-[#F6EFE9] flex items-center justify-center mb-2 text-[#10B981] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <p className="text-[15px] font-extrabold text-[#3D2E24]">All caught up!</p>
                <p className="text-[13px] text-[#7C6A5A] max-w-sm mt-1">
                  There are no pending revision requests requiring your approval.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.pendingRevisions.map((project: any) => {
                  const pendingReq = project.revisionRequests?.find((r: any) => r.status === 'PENDING_ADMIN');
                  if (!pendingReq) return null;
                  return (
                    <div key={pendingReq.id} className="p-4 bg-[#F6EFE9] rounded-2xl shadow-[inset_3px_3px_6px_rgba(206,187,172,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-extrabold text-[#3D2E24]">{project.title}</span>
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-xl bg-[#F6EFE9] text-[#EF4444] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
                            {project.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-[#7C6A5A]">
                          Client: <span className="font-bold text-[#3D2E24]">{project.client?.company || project.client?.user?.name || 'Unknown'}</span>
                          <span className="mx-2">•</span>
                          Submitted: {formatFetchedAgo(pendingReq.createdAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleReviewRevision(project.id, pendingReq.id, 'APPROVED')}
                          className="px-4 py-2 bg-gradient-to-br from-[#10B981] to-[#059669] text-white font-bold text-xs rounded-xl shadow-[-3px_-3px_6px_rgba(255,255,255,0.7),3px_3px_8px_rgba(16,185,129,0.4)] hover:shadow-[-4px_-4px_8px_rgba(255,255,255,0.8),4px_4px_10px_rgba(16,185,129,0.5)] transition-all cursor-pointer flex items-center"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Approve
                        </button>
                        <button 
                          onClick={() => handleReviewRevision(project.id, pendingReq.id, 'REJECTED')}
                          className="px-4 py-2 bg-[#F6EFE9] text-[#EF4444] font-bold text-xs rounded-xl shadow-[-3px_-3px_6px_rgba(255,255,255,0.9),3px_3px_6px_rgba(206,187,172,0.6)] active:shadow-[inset_2px_2px_4px_rgba(206,187,172,0.6),inset_-2px_-2px_4px_rgba(255,255,255,0.85)] transition-all cursor-pointer flex items-center"
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Other / Unassigned projects */}
        <div className="p-6 bg-[#F6EFE9] rounded-3xl shadow-[-8px_-8px_16px_rgba(255,255,255,0.9),8px_8px_16px_rgba(206,187,172,0.65)] hover:shadow-[-10px_-10px_20px_rgba(255,255,255,0.95),10px_10px_20px_rgba(201,180,163,0.75)] transition-all space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-extrabold uppercase tracking-wider text-[#8C7769]">Other / Unassigned</span>
            <div className="h-10 w-10 rounded-full flex items-center justify-center bg-[#F6EFE9] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]">
              <AlertCircle className="h-5 w-5 text-[#8C7769]" />
            </div>
          </div>
          <div>
            <div className="kpi-figure text-[38px] font-extrabold text-[#3D2E24]">{metrics.otherProjects}</div>
            <p className="text-[12px] text-[#7C6A5A] mt-1">Cancelled or unassigned projects</p>
          </div>
        </div>
      </div>
    </div>
  );
}
