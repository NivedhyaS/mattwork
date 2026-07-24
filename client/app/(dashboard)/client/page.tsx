'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import ProjectBoard from '@/components/board/ProjectBoard';
import { 
  Video,
  Clock,
  CreditCard,
  Download, 
  ExternalLink, 
  FileText, 
  Image as ImageIcon, 
  Loader2,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Check
} from 'lucide-react';
import { cn, formatCurrency, formatClientCurrency } from '@/lib/utils';

interface Project {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
  driveFolder: string | null;
  formLink: string | null;
  files: { url: string; fileType: string; filename: string }[];
  projectNumber?: string;
  standardName?: string;
  standardSlug?: string;
  clientPrice?: number | string | null;
  budget?: number | string | null;
}

interface BalanceData {
  advancePaid: number;
  completedWorkValue: number;
  remainingCredit: number;
  equivalentRemainingVideos: number | null;
  averageNote?: string;
  completedProjects: { id: string; title: string; clientPrice: number; deliveredAt: string }[];
}

const customFormatDate = (dateString: string | Date | undefined | null): string => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

const getClientStatus = (status: string) => {
  const s = status.toUpperCase();
  if (['NEW_VIDEO', 'PENDING'].includes(s)) return 'submitted';
  if (['EDITING', 'REVISION_1', 'REVISION_2', 'REVISION_3', 'FINAL_DRAFT', 'IN_PROGRESS'].includes(s)) return 'in production';
  if (['EDITING_REVIEW', 'REVISION_1_REVIEW', 'REVISION_2_REVIEW', 'REVISION_3_REVIEW', 'REVIEW'].includes(s)) return 'in review';
  if (['UPLOADED', 'COMPLETED'].includes(s)) return 'delivered';
  return 'inactive';
};

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
  'in production': 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
  'in review': 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-700',
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700',
  inactive: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};

// ── Breakdown Modal ──────────────────────────────────────────────────────────

interface BreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  currency: string;
  balanceData: BalanceData | null;
  activeCard: 'money_used' | 'videos' | null;
}

function BreakdownModal({ isOpen, onClose, title, currency, balanceData, activeCard }: BreakdownModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !balanceData) return null;

  const fmt = (n: number) => formatCurrency(n, currency);
  const { advancePaid, completedWorkValue, remainingCredit, equivalentRemainingVideos, averageNote, completedProjects } = balanceData;

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={ref}
        className="bg-white dark:bg-slate-950 border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-[18px] font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">How this number is calculated</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg transition-colors">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Money Used breakdown */}
        {activeCard === 'money_used' && (
          <>
            {/* Formula row */}
            <div className="space-y-2">
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Advance Paid</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">{fmt(advancePaid)}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Work Completed</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">− {fmt(completedWorkValue)}</span>
              </div>
              <div className="border-t border-border pt-2 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Minus className="h-4 w-4 text-indigo-400" />
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Remaining Credit</span>
                </div>
                <span className="font-black text-indigo-600 dark:text-indigo-400 text-[18px]">{fmt(remainingCredit)}</span>
              </div>
            </div>

            {/* Line-item list */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Delivered Projects</p>
              {completedProjects.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-4">
                  No delivered projects yet — amounts will appear here once a video reaches the final stage.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-900 rounded-lg border border-slate-100 dark:border-slate-900 overflow-hidden">
                  {completedProjects.map(p => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-950">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{p.title}</p>
                        <p className="text-xs text-slate-400">{fmtDate(p.deliveredAt)}</p>
                      </div>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{fmt(p.clientPrice)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Total Used</span>
                    <span className="font-black text-slate-900 dark:text-white">{fmt(completedWorkValue)}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Videos Remaining breakdown */}
        {activeCard === 'videos' && (
          <>
            <p className="text-sm text-slate-500 leading-relaxed">
              Estimated videos you can still commission with your remaining credit.
            </p>
            <div className="space-y-2">
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-slate-700 dark:text-slate-300">Remaining Credit</span>
                <span className="font-bold text-slate-900 dark:text-white">{fmt(remainingCredit)}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-slate-700 dark:text-slate-300">Avg price per video</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {equivalentRemainingVideos !== null && remainingCredit > 0 && equivalentRemainingVideos > 0
                    ? fmt(Math.round(remainingCredit / equivalentRemainingVideos))
                    : '—'}
                </span>
              </div>
              <div className="border-t border-border pt-2 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Estimated Remaining Videos</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400 text-[18px]">
                  {equivalentRemainingVideos !== null ? equivalentRemainingVideos : '—'}
                </span>
              </div>
            </div>
            {averageNote && (
              <p className="text-xs text-slate-400 italic">{averageNote}</p>
            )}
            {!averageNote && (
              <p className="text-xs text-slate-400">
                Based on the average price of your completed projects. Floored to the nearest whole video.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ClientDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [currency, setCurrency] = useState('USD');

  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [breakdownCard, setBreakdownCard] = useState<'money_used' | 'videos' | null>(null);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'BOARD'>('BOARD');

  const handleSelectProject = async (project: Project) => {
    setSelectedProject(project);
    try {
      const res = await api.get(`/projects/${project.id}`);
      setSelectedProject(res.data.data);
    } catch (err) {
      console.error('Failed to load project details:', err);
    }
  };

  useEffect(() => {
    Promise.all([
      api.get('/projects?limit=100'),
      api.get('/clients/me'),
    ])
      .then(async ([projectsRes, clientRes]) => {
        const projData = projectsRes.data.data;
        setProjects(projData);
        if (projData.length > 0) {
          handleSelectProject(projData[0]);
        }

        const clientProfile = clientRes.data.data;
        const clientCurrency = clientProfile?.currency || 'USD';
        setCurrency(clientCurrency);

        if (clientProfile?.id) {
          try {
            const balanceRes = await api.get(`/clients/${clientProfile.id}/balance`);
            const bal = balanceRes.data.data;
            setBalanceData({
              advancePaid: Number(bal.advancePaid),
              completedWorkValue: Number(bal.completedWorkValue),
              remainingCredit: Number(bal.remainingCredit),
              equivalentRemainingVideos: bal.equivalentRemainingVideos !== null ? Number(bal.equivalentRemainingVideos) : null,
              averageNote: bal.averageNote,
              completedProjects: Array.isArray(bal.completedProjects) ? bal.completedProjects : [],
            });
          } catch (balErr) {
            console.error('Failed to load dynamic client balance:', balErr);
            setBalanceData({
              advancePaid: 0,
              completedWorkValue: 0,
              remainingCredit: 0,
              equivalentRemainingVideos: 0,
              completedProjects: [],
            });
          }
        } else {
          setBalanceData({ advancePaid: 0, completedWorkValue: 0, remainingCredit: 0, equivalentRemainingVideos: 0, completedProjects: [] });
        }

        try {
          const res = await api.get('/invoices?limit=100');
          setInvoices(res.data?.data || []);
        } catch (invoiceErr) {
          console.error('Failed to fetch invoices:', invoiceErr);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n: number) => formatCurrency(n, currency);

  const finalFiles = selectedProject?.files?.filter(f => 
    f.fileType === 'VIDEO' || f.fileType === 'IMAGE'
  ) ?? [];

  // Derive client payment transaction history locally
  const paymentHistory = invoices
    .filter((inv) => inv.status === 'PAID' || Number(inv.amountPaid) > 0)
    .map((inv) => ({
      id: `PAY-${inv.id}`,
      invoiceNumber: inv.number,
      amount: Number(inv.amountPaid || 0),
      date: inv.paidAt || inv.updatedAt,
      method: 'Bank Transfer',
      status: 'Completed',
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Videos Completed: only terminal UPLOADED status per schema (= 'delivered' in getClientStatus)
  const completedVideosCount = projects.filter(
    (p) => getClientStatus(p.status) === 'delivered'
  ).length;

  // Active (non-terminal) projects: status is not terminal ('delivered') and not CANCELLED/ON_HOLD/inactive
  const activeProjects = projects.filter((p) => {
    const s = getClientStatus(p.status);
    return s !== 'delivered' && s !== 'inactive' && p.status !== 'CANCELLED' && p.status !== 'ON_HOLD';
  });

  const activeProjectsCount = activeProjects.length;

  const activeProjectsValue = activeProjects.reduce((sum, p) => {
    const price = typeof p.clientPrice === 'string' ? parseFloat(p.clientPrice) : p.clientPrice;
    return sum + (price || 0);
  }, 0);

  const remainingVideosCount = balanceData?.equivalentRemainingVideos !== null
    ? (balanceData?.equivalentRemainingVideos ?? 0)
    : 0;

  const stats = balanceData ? [
    {
      key: 'money_used' as const,
      label: 'Money Used',
      // PRD §7: completedWorkValue = sum of clientPrice for UPLOADED projects
      value: fmt(balanceData.completedWorkValue),
      description: 'Used',
      isClickable: true,
      secondary: `+ ${fmt(activeProjectsValue)} in progress (${activeProjectsCount} active project${activeProjectsCount === 1 ? '' : 's'})`,
    },
    {
      key: 'completed_videos' as const,
      label: 'Videos Completed',
      value: String(completedVideosCount),
      description: 'Videos',
      isClickable: false,
      secondary: `${activeProjectsCount} in progress`,
    },
    {
      key: 'videos' as const,
      label: 'Videos Remaining',
      value: balanceData.advancePaid > 0 ? String(remainingVideosCount) : '—',
      description: balanceData.advancePaid > 0 ? 'Videos' : 'Set budget to calculate',
      isClickable: balanceData.advancePaid > 0,
      secondary: balanceData.advancePaid > 0 ? `${activeProjectsCount} in production` : undefined,
    },
  ] : [];

  const tabToggle = (
    <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-850 shrink-0">
      <button
        onClick={() => setActiveTab('OVERVIEW')}
        className={`px-3.5 py-1.5 rounded-lg text-[13px] font-bold transition-all cursor-pointer ${
          activeTab === 'OVERVIEW'
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        Overview
      </button>
      <button
        onClick={() => setActiveTab('BOARD')}
        className={`px-3.5 py-1.5 rounded-lg text-[13px] font-bold transition-all cursor-pointer ${
          activeTab === 'BOARD'
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        Project Board
      </button>
    </div>
  );

  if (activeTab === 'BOARD') {
    return <ProjectBoard role="CLIENT" extraHeader={tabToggle} />;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-base">
      {/* Breakdown Modal */}
      <BreakdownModal
        isOpen={breakdownCard !== null}
        onClose={() => setBreakdownCard(null)}
        title={
          breakdownCard === 'money_used' ? 'Money Used Breakdown'
          : breakdownCard === 'videos' ? 'Videos Remaining Calculation'
          : 'Breakdown'
        }
        currency={currency}
        balanceData={balanceData}
        activeCard={breakdownCard}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[36px] font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
            Client dashboard
          </h1>
          <p className="text-[16px] text-slate-500 mt-2">
            Welcome back. Track your video production progress and credit balance.
          </p>
        </div>
        {tabToggle}
      </div>

      {/* Financial Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flat-card bg-card/40 p-6 border border-border animate-pulse">
              <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded mb-3" />
              <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))
        ) : stats.map((stat) => {
          const isClickable = stat.isClickable;
          const CardElement = isClickable ? 'button' : 'div';
          return (
            <CardElement
              key={stat.key}
              {...(isClickable && {
                onClick: () => setBreakdownCard(stat.key as any),
              })}
              className={cn(
                "flat-card bg-card/45 p-6 border border-border text-left w-full transition-all duration-200",
                isClickable
                  ? "hover:border-accent/40 hover:bg-accent/[0.02] cursor-pointer group"
                  : ""
              )}
            >
              <div>
                <p className="text-[12px] uppercase font-bold text-slate-450 tracking-wider">
                  {stat.label}
                </p>
                <h3 className="kpi-figure text-[40px] font-black mt-2 text-slate-900 dark:text-white leading-none">
                  {stat.value}
                  <span className="text-[18px] font-semibold text-slate-450 ml-1.5 font-normal normal-case">
                    {stat.description}
                  </span>
                </h3>
                {stat.secondary && (
                  <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                    {stat.secondary}
                  </p>
                )}
                {isClickable ? (
                  <p className="text-[10px] text-slate-400/50 mt-2.5 group-hover:text-slate-450 transition-colors">
                    Click to see breakdown →
                  </p>
                ) : (
                  <div className="h-[15px] mt-2.5" />
                )}
              </div>
            </CardElement>
          );
        })}
      </div>

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Projects Table & Invoices & Payments */}
        <div className="lg:col-span-2 space-y-8">
          {/* Projects */}
          <div className="space-y-4">
            <h2 className="text-[20px] font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <Video className="h-5 w-5 text-slate-450" />
              Submitted videos
            </h2>
            <div className="flat-card bg-card border border-border overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <Video className="h-10 w-10 mx-auto mb-3 text-slate-200" />
                  <p className="font-bold text-[15px]">No projects yet</p>
                  <p className="text-xs mt-1">Waiting on your first submission</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[15px]">
                    <thead>
                      <tr className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-border text-[12px] font-bold uppercase tracking-wider text-slate-450">
                        <th className="py-4 pl-6 pr-6">video title</th>
                        <th className="py-4 px-6">deadline</th>
                        <th className="py-4 px-6">status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {projects.map((project) => {
                        const status = getClientStatus(project.status);
                        const isSelected = selectedProject?.id === project.id;
                        return (
                          <tr 
                            key={project.id} 
                            className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors cursor-pointer ${
                              isSelected ? 'bg-indigo-500/5 dark:bg-indigo-500/10' : ''
                            }`}
                            onClick={() => handleSelectProject(project)}
                          >
                            <td className={`py-4 pr-6 font-semibold transition-all ${
                              isSelected 
                                ? 'text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-500 pl-5' 
                                : 'text-slate-800 dark:text-slate-200 border-l-4 border-transparent pl-6'
                            }`}>
                              {project.title}
                            </td>
                            <td className="py-4 px-6 text-slate-550">
                              {customFormatDate(project.dueDate)}
                            </td>
                            <td className="py-4 px-6">
                              <span className={`px-2.5 py-1 rounded border text-[11px] font-bold ${STATUS_COLORS[status] || STATUS_COLORS.inactive}`}>
                                {status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Invoice History */}
          <div className="space-y-4">
            <h2 className="text-[20px] font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <FileText className="h-5 w-5 text-slate-455" />
              Invoice history
            </h2>
            <div className="flat-card bg-card border border-border overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                </div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-16 px-4 bg-slate-900/10 dark:bg-slate-900/5">
                  <div className="mx-auto w-12 h-12 rounded-full border border-dashed border-border/80 flex items-center justify-center mb-4 text-slate-500">
                    <FileText className="h-6 w-6 stroke-[1.5]" />
                  </div>
                  <h3 className="font-bold text-[16px] text-slate-800 dark:text-slate-200">No invoices yet</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-[260px] mx-auto">
                    We'll post invoices here as soon as they're generated for your projects.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[15px]">
                    <thead>
                      <tr className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-border text-[12px] font-bold uppercase tracking-wider text-slate-450">
                        <th className="py-4 px-6">invoice #</th>
                        <th className="py-4 px-6">amount</th>
                        <th className="py-4 px-6">status</th>
                        <th className="py-4 px-6">date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {invoices.map((inv: any) => (
                        <tr
                          key={inv.id}
                          onClick={() => router.push(`/client/invoices?highlight=${inv.id}`)}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors cursor-pointer group"
                        >
                          <td className="py-4 px-6 font-semibold text-slate-800 dark:text-slate-200 group-hover:text-accent transition-colors">
                            {inv.number}
                          </td>
                          <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">{fmt(inv.total)}</td>
                          <td className="py-4 px-6">
                            <span className={`px-2.5 py-1 rounded border text-[11px] font-bold ${
                              inv.status === 'PAID' 
                                ? 'bg-status-green/10 text-status-green border-status-green/20' 
                                : 'bg-status-amber/10 text-status-amber border-status-amber/20'
                            }`}>
                              {inv.status.toLowerCase()}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-slate-550">
                            {customFormatDate(inv.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Payment History */}
          <div className="space-y-4">
            <h2 className="text-[20px] font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <CreditCard className="h-5 w-5 text-slate-450" />
              Payment history
            </h2>
            <div className="flat-card bg-card border border-border overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                </div>
              ) : paymentHistory.length === 0 ? (
                <div className="text-center py-16 px-4 bg-slate-900/10 dark:bg-slate-900/5">
                  <div className="mx-auto w-12 h-12 rounded-full border border-dashed border-border/80 flex items-center justify-center mb-4 text-slate-500">
                    <CreditCard className="h-6 w-6 stroke-[1.5]" />
                  </div>
                  <h3 className="font-bold text-[16px] text-slate-800 dark:text-slate-200">No transactions recorded</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-[280px] mx-auto">
                    Your processed bank transfers and payments will be listed here once complete.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[15px]">
                    <thead>
                      <tr className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-border text-[12px] font-bold uppercase tracking-wider text-slate-450">
                        <th className="py-4 px-6">transaction</th>
                        <th className="py-4 px-6">invoice #</th>
                        <th className="py-4 px-6">method</th>
                        <th className="py-4 px-6 text-right">amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paymentHistory.map((pay) => (
                        <tr key={pay.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                          <td className="py-4 px-6">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{pay.id}</p>
                            <span className="text-xs text-slate-400">{customFormatDate(pay.date)}</span>
                          </td>
                          <td className="py-4 px-6 text-slate-500 font-semibold">{pay.invoiceNumber}</td>
                          <td className="py-4 px-6 text-slate-500">{pay.method}</td>
                          <td className="py-4 px-6 font-bold text-slate-950 dark:text-white text-right">
                            {fmt(pay.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Project Detail Panel */}
        <div className="space-y-4">
          <h2 className="text-[20px] font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Clock className="h-5 w-5 text-slate-450" />
            Project details
          </h2>          {selectedProject ? (
            <div className="flat-card bg-card p-6 border border-border space-y-6 divide-y divide-border/50">
              {/* Section 1: Header */}
              <div className="pb-6">
                <span className={`px-2.5 py-1 rounded border text-[11px] font-bold ${STATUS_COLORS[getClientStatus(selectedProject.status)] || ''}`}>
                  {getClientStatus(selectedProject.status)}
                </span>
                <h3 className="text-[18px] font-bold text-slate-900 dark:text-white mt-4 leading-tight">
                  {selectedProject.standardName}
                </h3>
              </div>

              {/* Section 2: Progress Stepper */}
              <div className="py-6">
                <span className="text-[12px] font-bold text-slate-450 uppercase tracking-wider block mb-4">progress</span>
                <div className="flex justify-between items-center relative">
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 z-0" />
                  {['submitted', 'in production', 'in review', 'delivered'].map((step, index) => {
                    const currentStatus = getClientStatus(selectedProject.status);
                    const steps = ['submitted', 'in production', 'in review', 'delivered'];
                    const stepIndex = steps.indexOf(step);
                    const currentIndex = steps.indexOf(currentStatus);
                    
                    const isCompleted = stepIndex < currentIndex;
                    const isCurrent = stepIndex === currentIndex;

                    return (
                      <div key={step} className="flex flex-col items-center z-10 relative">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center border text-[11px] font-bold transition-all duration-300 ${
                          isCompleted
                            ? 'bg-status-green text-white border-status-green shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                            : isCurrent
                              ? 'bg-accent text-white border-accent ring-4 ring-indigo-500/20 shadow-[0_0_12px_rgba(79,70,229,0.4)]'
                              : 'bg-white dark:bg-slate-950 text-slate-400 border-border'
                        }`}>
                          {isCompleted ? (
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          ) : (
                            stepIndex + 1
                          )}
                        </div>
                        <span className={`text-[10px] mt-2 font-bold whitespace-nowrap uppercase tracking-wider ${
                          isCurrent
                            ? 'text-accent dark:text-indigo-400'
                            : isCompleted
                              ? 'text-slate-800 dark:text-slate-350'
                              : 'text-slate-400'
                        }`}>
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Google Drive Link */}
              {selectedProject.driveFolder && (
                <div className="py-6 space-y-3">
                  <span className="text-[12px] font-bold text-slate-450 uppercase tracking-wider block">Google Drive</span>
                  <a
                    href={selectedProject.driveFolder}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ExternalLink className="h-5 w-5 text-indigo-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold text-indigo-700 dark:text-indigo-300 truncate">Open Google Drive Folder</p>
                        <p className="text-xs text-indigo-400 font-normal">Your project workspace</p>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-indigo-400" />
                  </a>
                </div>
              )}

              {/* Section 4: Deliverables */}
              <div className="pt-6 space-y-3">
                <span className="text-[12px] font-bold text-slate-450 uppercase tracking-wider block">final deliverables</span>
                {getClientStatus(selectedProject.status) === 'delivered' && finalFiles.length > 0 ? (
                  <div className="space-y-2">
                    {finalFiles.map((file) => (
                      <a key={file.url} href={file.url} target="_blank" rel="noreferrer"
                        className="flex items-center justify-between p-3.5 rounded-lg bg-status-green/5 border border-status-green/10 hover:bg-status-green/10 transition-colors text-status-green font-bold">
                        <div className="flex items-center gap-3 min-w-0">
                          {file.fileType === 'VIDEO' ? <Video className="h-4.5 w-4.5" /> : <ImageIcon className="h-4.5 w-4.5" />}
                          <p className="text-[14px] truncate max-w-[140px]">{file.filename}</p>
                        </div>
                        <Download className="h-4.5 w-4.5" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 text-center text-sm text-slate-400">
                    {getClientStatus(selectedProject.status) === 'delivered'
                      ? 'no files uploaded yet.'
                      : 'deliverables will appear here once editing is complete.'}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flat-card bg-card p-10 border border-border text-center text-slate-400 flex flex-col items-center justify-center min-h-[220px]">
              <Video className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-bold">No project selected</p>
              <p className="text-xs text-slate-450 mt-1 max-w-[170px]">Click a video to view details and download files.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
