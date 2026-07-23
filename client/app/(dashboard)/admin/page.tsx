'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  // All Lucide, all outline, all strokeWidth={1.5}, all size={18}
  Layers,        // Total projects
  Timer,         // Active projects
  CircleCheck,   // Completed projects
  CalendarClock, // Upcoming deadlines
  Banknote,      // Revenue
  Receipt,       // Costs
  TrendingUp,    // Profit
  Hourglass,     // Pending payments
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import { useExchangeRate, formatFetchedAgo } from '@/lib/exchangeRate';
import { formatCurrency, formatEditorCurrency } from '@/lib/utils';
import {
  ResponsiveContainer,
  BarChart, Bar, Cell,
  XAxis, YAxis,
  Tooltip,
  AreaChart, Area,
  CartesianGrid,
} from 'recharts';

/*
  ╔══════════════════════════════════════════════════════╗
  ║  Mattwork — Admin Dashboard Design Token Reference  ║
  ║                                                      ║
  ║  Icon family : Lucide React (outline only)           ║
  ║  Icon spec   : size={18}, strokeWidth={1.5}          ║
  ║                                                      ║
  ║  Accent (violet #7c3aed)                             ║
  ║    └── ONE job: "active / in-pipeline" state only    ║
  ║    └── Active Projects KPI numeral                   ║
  ║    └── Active pipeline area series                   ║
  ║    └── Editor workload bars                          ║
  ║                                                      ║
  ║  Green  #10b981 → completed / profit / on-track      ║
  ║  Amber  #f59e0b → pending / needs attention          ║
  ║  Red    #ef4444 → overdue / urgent / blocked         ║
  ║  Orange #f97316 → high priority (donut only)         ║
  ║  Slate  #94a3b8 → neutral informational (revenue)    ║
  ║  Gray   #4b5563 → low priority (donut only)          ║
  ║  Muted  #71717a → subtitle text / card labels        ║
  ║                                                      ║
  ║  Brand signature                                     ║
  ║    .kpi-figure — tabular-nums + tight letter-spacing ║
  ║    Applied to every large metric numeral on all cards║
  ╚══════════════════════════════════════════════════════╝
*/

const V = {
  accent:  '#7c3aed', // violet — active pipeline only
  neutral: '#94a3b8', // slate-400 — informational / revenue
  green:   '#10b981', // completed / profit
  amber:   '#f59e0b', // pending
  red:     '#ef4444', // urgent / overdue
  orange:  '#f97316', // high priority
  gray:    '#4b5563', // low priority
  muted:   '#71717a', // labels / subtitles (NOT accent)
};

const EditorWorkloadTooltip = ({ active, payload, label, totalAssigned }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const fullName = data.fullName || data.name || label;
  const count = data.projects || 0;
  const pct = totalAssigned > 0 ? ((count / totalAssigned) * 100).toFixed(1) : '0';

  return (
    <div className="rounded-xl bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md p-3.5 border border-slate-700/70 shadow-2xl min-w-[180px] text-xs space-y-2">
      <div className="border-b border-slate-800 pb-1.5 flex items-center justify-between gap-3">
        <span className="font-bold text-slate-200 text-[13px] truncate max-w-[140px]">{fullName}</span>
        <span className="text-[11px] font-extrabold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20">
          {pct}%
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-400 font-semibold flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#8B5CF6] inline-block shadow-xs" />
          Active Projects
        </span>
        <span className="font-extrabold text-slate-100 text-[13px]">
          {count}
        </span>
      </div>
    </div>
  );
};

const FinancialTooltip = ({ active, payload, label, displayCurrency }: any) => {
  if (!active || !payload || !payload.length) return null;

  const revPayload = payload.find((p: any) => p.dataKey === 'revenue');
  const profPayload = payload.find((p: any) => p.dataKey === 'profit');

  const rev = revPayload ? Number(revPayload.value) : 0;
  const profit = profPayload ? Number(profPayload.value) : 0;
  const margin = rev > 0 ? ((profit / rev) * 100).toFixed(1) : null;
  const sym = displayCurrency === 'USD' ? '$' : '₹';

  return (
    <div className="rounded-xl bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md p-3.5 border border-slate-700/70 shadow-2xl min-w-[190px] text-xs space-y-2.5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="font-bold text-slate-200 text-[13px]">{label}</span>
        {margin !== null && (
          <span className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded ${Number(margin) >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            {Number(margin) >= 0 ? `+${margin}%` : `${margin}%`} margin
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#10B981] inline-block shadow-xs" />
            <span className="text-slate-400 font-semibold">Revenue</span>
          </div>
          <span className="font-extrabold text-slate-100 text-[13px]">
            {sym}{rev.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full inline-block shadow-xs ${profit < 0 ? 'bg-[#EF4444]' : 'bg-[#3B82F6]'}`} />
            <span className="text-slate-400 font-semibold">Net Profit</span>
          </div>
          <span className={`font-extrabold text-[13px] ${profit < 0 ? 'text-red-400' : 'text-slate-100'}`}>
            {profit < 0 ? `-${sym}${Math.abs(profit).toLocaleString()}` : `${sym}${profit.toLocaleString()}`}
          </span>
        </div>
      </div>
    </div>
  );
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
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects?limit=100');
      return res.data;
    },
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await api.get('/invoices?limit=100');
      return res.data;
    },
  });

  const { data: editorsData } = useQuery({
    queryKey: ['editors'],
    queryFn: async () => {
      const res = await api.get('/editors?limit=100');
      return res.data;
    },
  });

  const projects = projectsData?.data || [];
  const invoices = invoicesData?.data || [];
  const editors  = editorsData?.data  || [];

  // ── Metrics ──────────────────────────────────────────────────────────────
  const rate = exchangeRate ? exchangeRate.usdToInr : 83.5;

  const totalProjects     = projects.length;
  const activeProjects    = projects.filter((p: any) =>
    ['IN_PROGRESS','EDITING','REVIEW','REVISION','REVISION_1','REVISION_2'].includes(p.status)
  ).length;
  const completedProjects = projects.filter((p: any) =>
    ['COMPLETED','FINAL_DRAFT','UPLOADED'].includes(p.status)
  ).length;

  const totalRevenue  = invoices.reduce((s: number, inv: any) => s + Number(inv.total  || 0), 0);
  const pendingCount  = invoices.filter((inv: any) => !['PAID','CANCELLED'].includes(inv.status)).length;
  
  // Real Cost: sum of completed project editor price payouts (INR)
  const totalCosts = projects
    .filter((p: any) => ['FINAL_DRAFT', 'UPLOADED', 'COMPLETED'].includes(p.status))
    .reduce((s: number, p: any) => s + Number(p.editorPrice || 0), 0);

  const totalProfit   = totalRevenue - (totalCosts / rate);

  const upcomingDeadlines = projects.filter((p: any) => {
    if (!p.dueDate) return false;
    const diffDays = Math.ceil((new Date(p.dueDate).getTime() - Date.now()) / 86_400_000);
    return diffDays >= 0 && diffDays <= 7;
  }).length;

  // ── Demo fallbacks ────────────────────────────────────────────────────────
  const demoRevenue   = totalRevenue;
  const demoCosts     = totalCosts;
  const demoProfit    = totalProfit;
  const demoProjects  = totalProjects;
  const demoActive    = activeProjects;
  const demoCompleted = completedProjects;
  const demoPending   = pendingCount;
  const demoDeadlines = upcomingDeadlines;

  // Formatted string representations
  const revenueFormatted = displayCurrency === 'USD'
    ? formatCurrency(demoRevenue)
    : `≈ ${formatEditorCurrency(demoRevenue * rate)}`;

  const costsFormatted = displayCurrency === 'INR'
    ? formatEditorCurrency(demoCosts)
    : `≈ ${formatCurrency(demoCosts / rate)}`;

  const profitFormatted = displayCurrency === 'USD'
    ? `≈ ${formatCurrency(demoProfit)}`
    : `≈ ${formatEditorCurrency(demoProfit * rate)}`;

  // ── Real Dynamic Chart Data (Calculated strictly from database) ─────────────
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();

  const monthlyData = monthNames.map((mName, idx) => {
    const monthNum = idx + 1;
    const mInvoices = invoices.filter((inv: any) => {
      const d = new Date(inv.createdAt);
      return d.getFullYear() === currentYear && d.getMonth() + 1 === monthNum;
    });

    const mRev = mInvoices
      .filter((inv: any) => ['PAID', 'PARTIAL'].includes(inv.status))
      .reduce((s: number, inv: any) => s + Number(inv.amountPaid || inv.total || 0), 0);

    const mProjects = projects.filter((p: any) => {
      const d = new Date(p.createdAt || p.updatedAt);
      return d.getFullYear() === currentYear && d.getMonth() + 1 === monthNum;
    });

    const mCosts = mProjects
      .filter((p: any) => ['FINAL_DRAFT', 'UPLOADED', 'COMPLETED'].includes(p.status))
      .reduce((s: number, p: any) => s + Number(p.editorPrice || 0), 0);

    const mProfInUsd = mRev - (mCosts / rate);

    return {
      name: mName,
      revenue: Math.round(displayCurrency === 'USD' ? mRev : mRev * rate),
      profit: Math.round(displayCurrency === 'USD' ? mProfInUsd : mProfInUsd * rate)
    };
  }).filter((d) => d.revenue > 0 || d.profit !== 0);

  // 4-Week rolling trends from actual historical project creation dates
  const nowMs = Date.now();
  const weekMs = 7 * 86400000;
  const projectTrends = [3, 2, 1, 0].map((wIndex) => {
    const wStart = nowMs - (wIndex + 1) * weekMs;
    const wEnd = nowMs - wIndex * weekMs;
    const weekProjects = projects.filter((p: any) => {
      const t = new Date(p.createdAt).getTime();
      return t >= wStart && t < wEnd;
    });

    const completed = weekProjects.filter((p: any) =>
      ['FINAL_DRAFT', 'UPLOADED', 'COMPLETED'].includes(p.status)
    ).length;

    const active = weekProjects.filter((p: any) =>
      ['IN_PROGRESS', 'EDITING', 'REVIEW', 'REVISION', 'REVISION_1', 'REVISION_2'].includes(p.status)
    ).length;

    return {
      name: `Week ${4 - wIndex}`,
      completed,
      active
    };
  });

  // Editor workloads calculated directly from database assignments
  const editorWorkload = editors.map((ed: any) => {
    const assignedCount = projects.filter((p: any) =>
      p.editorId === ed.id &&
      ['NEW_VIDEO', 'EDITING', 'EDITING_REVIEW', 'REVISION_1', 'REVISION_1_REVIEW', 'REVISION_2', 'REVISION_2_REVIEW'].includes(p.status)
    ).length;
    const fullName = ed.user?.name || 'Editor';
    const truncatedName = fullName.length > 13 ? `${fullName.slice(0, 12)}…` : fullName;
    return {
      fullName,
      name: truncatedName,
      projects: assignedCount
    };
  });

  const totalEditors = editors.length;
  const totalAssignedProjects = editorWorkload.reduce((sum: number, e: any) => sum + e.projects, 0);
  const activeEditors = editorWorkload.filter((e: any) => e.projects > 0).length;
  const avgProjectsPerEditor = totalEditors > 0 ? (totalAssignedProjects / totalEditors).toFixed(1) : '0';


  // ── Shared icon props — ONE spec, applied uniformly ───────────────────────
  const iconProps = { size: 18, strokeWidth: 1.5 };

  return (
    <div className="space-y-8">
      {/* Page header — subtitles use muted gray, never accent */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[36px] font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
            Platform overview
          </h1>
          <p className="text-[16px] mt-2" style={{ color: V.muted }}>
            Real-time metrics, pipeline analytics, and editor workloads.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {exchangeRate && (
            <div className="text-[12px] text-slate-450 dark:text-slate-500 font-medium">
              1 USD = ₹{exchangeRate.usdToInr.toFixed(2)} · {formatFetchedAgo(exchangeRate.fetchedAt)}
            </div>
          )}

          {/* Currency Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => handleCurrencyChange('USD')}
              className={`px-3 py-1.5 rounded-md text-[13px] font-extrabold transition-all cursor-pointer ${
                displayCurrency === 'USD'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-450 hover:text-slate-750 dark:text-slate-450 dark:hover:text-slate-250'
              }`}
            >
              USD ($)
            </button>
            <button
              onClick={() => handleCurrencyChange('INR')}
              className={`px-3 py-1.5 rounded-md text-[13px] font-extrabold transition-all cursor-pointer ${
                displayCurrency === 'INR'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-450 hover:text-slate-750 dark:text-slate-450 dark:hover:text-slate-250'
              }`}
            >
              INR (₹)
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total projects — neutral */}
        <Card className="flat-card border-l-4 shadow-none" style={{ borderLeftColor: V.neutral }}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-450">Total projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold text-slate-900 dark:text-white">{demoProjects}</div>
            <p className="text-[12px] mt-2" style={{ color: V.muted }}>Videos submitted this period</p>
          </CardContent>
        </Card>
        {/* Active projects — accent violet */}
        <Card className="flat-card border-l-4 shadow-none" style={{ borderLeftColor: V.accent }}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-450">Active projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold" style={{ color: V.accent }}>{demoActive}</div>
            <p className="text-[12px] mt-2" style={{ color: V.muted }}>Currently in edit pipeline</p>
          </CardContent>
        </Card>
        {/* Completed projects — green */}
        <Card className="flat-card border-l-4 shadow-none" style={{ borderLeftColor: V.green }}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-450">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold" style={{ color: V.green }}>{demoCompleted}</div>
            <p className="text-[12px] mt-2" style={{ color: V.muted }}>Approved and delivered videos</p>
          </CardContent>
        </Card>
        {/* Upcoming deadlines — red */}
        <Card className="flat-card border-l-4 shadow-none" style={{ borderLeftColor: V.red }}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-450">Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold" style={{ color: V.red }}>{demoDeadlines}</div>
            <p className="text-[12px] mt-2" style={{ color: V.muted }}>Due within next seven days</p>
          </CardContent>
        </Card>
        {/* Revenue — neutral */}
        <Card className="flat-card border-l-4 shadow-none" style={{ borderLeftColor: V.neutral }}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-450">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold text-slate-900 dark:text-white">{revenueFormatted}</div>
            <p className="text-[12px] mt-2" style={{ color: V.muted }}>Gross billed client invoices</p>
          </CardContent>
        </Card>
        {/* Costs — neutral */}
        <Card className="flat-card border-l-4 shadow-none" style={{ borderLeftColor: V.neutral }}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-450">Costs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold text-slate-900 dark:text-white">{costsFormatted}</div>
            <p className="text-[12px] mt-2" style={{ color: V.muted }}>~Est. editor service payouts</p>
          </CardContent>
        </Card>
        {/* Profit — green */}
        <Card className="flat-card border-l-4 shadow-none" style={{ borderLeftColor: V.green }}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-450">Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold" style={{ color: V.green }}>{profitFormatted}</div>
            <p className="text-[12px] mt-2" style={{ color: V.muted }}>Net operating profit margin</p>
          </CardContent>
        </Card>
        {/* Pending payments — amber */}
        <Card className="flat-card border-l-4 shadow-none" style={{ borderLeftColor: '#fff' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-450">
              Pending payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold" style={{ color: '#fff' }}>
              {demoPending}
            </div>
            <p className="text-[12px] mt-2" style={{ color: V.muted }}>
              Invoices awaiting clearance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

        {/* Financial performance — bar chart */}
        <Card className="lg:col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div>
              <CardTitle className="text-[18px] font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <Banknote className="h-5 w-5 text-emerald-500" />
                Financial performance
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Monthly breakdown of gross revenue vs. net profit
              </CardDescription>
            </div>

            {/* Header Legend */}
            {monthlyData.length > 0 && (
              <div className="flex items-center gap-5 text-xs font-bold text-slate-600 dark:text-slate-400 self-start sm:self-auto bg-slate-50 dark:bg-slate-900/60 px-3.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
                  <span>Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />
                  <span>Net Profit</span>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="pt-4">
            {monthlyData.length === 0 ? (
              /* No Data Empty State */
              <div className="flex h-[260px] flex-col items-center justify-center text-center p-6 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800/80">
                <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3 text-slate-400">
                  <Banknote className="h-5 w-5" />
                </div>
                <p className="text-[15px] font-bold text-slate-800 dark:text-slate-200">No financial data available</p>
                <p className="text-[13px] text-slate-500 max-w-sm mt-1">
                  Financial transactions and profit metrics will populate automatically as client invoices and project payouts are logged.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {monthlyData.length === 1 && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100/60 dark:bg-slate-900/40 px-3 py-2 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    <span>More financial data will appear as projects are completed.</span>
                  </div>
                )}

                <div className="h-[270px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={monthlyData}
                      margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                      barGap={6}
                      barSize={monthlyData.length === 1 ? 40 : 28}
                      barCategoryGap={monthlyData.length === 1 ? "40%" : "20%"}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.25} />
                      <XAxis
                        dataKey="name"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        stroke="#94a3b8"
                        dy={6}
                      />
                      <YAxis
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        stroke="#94a3b8"
                        tickFormatter={(v) => {
                          const sym = displayCurrency === 'USD' ? '$' : '₹';
                          if (Math.abs(v) >= 1000) return `${sym}${(v / 1000).toFixed(0)}k`;
                          return `${sym}${v}`;
                        }}
                      />
                      <Tooltip
                        content={<FinancialTooltip displayCurrency={displayCurrency} />}
                        cursor={{ fill: 'rgba(255, 255, 255, 0.04)', radius: 8 }}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="#10B981"
                        name="Revenue"
                        radius={[8, 8, 0, 0]}
                        animationDuration={1000}
                        animationEasing="ease-out"
                      />
                      <Bar
                        dataKey="profit"
                        name="Net Profit"
                        radius={[8, 8, 0, 0]}
                        animationDuration={1000}
                        animationEasing="ease-out"
                      >
                        {monthlyData.map((entry, index) => (
                          <Cell
                            key={`profit-cell-${index}`}
                            fill={entry.profit < 0 ? '#EF4444' : '#3B82F6'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Project pipeline trend — area chart */}
        <Card className="lg:col-span-2 flat-card shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-[18px] font-bold text-slate-900 dark:text-white">Project pipeline trends</CardTitle>
            <CardDescription className="text-sm mt-1" style={{ color: V.muted }}>
              Weekly comparison: active (violet) vs. completed (green)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectTrends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                  <XAxis dataKey="name" fontSize={14} stroke={V.muted} tickLine={false} />
                  <YAxis fontSize={14} stroke={V.muted} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                    itemStyle={{ fontSize: 14 }}
                  />
                  {/* Completed = green; Active = accent violet (the one job of violet) */}
                  <Area type="monotone" dataKey="completed" stroke={V.green}  fill={V.green}  fillOpacity={0.08} name="Completed" />
                  <Area type="monotone" dataKey="active"    stroke={V.accent} fill={V.accent} fillOpacity={0.08} name="Active"    />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Editor workloads / distribution */}
        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3">
              <CardTitle className="text-[18px] font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-violet-500" />
                Editor Distribution
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Active project workloads across video editing team
              </CardDescription>

              {/* Dashboard Summary Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
                <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Editors</span>
                  <span className="text-[16px] font-extrabold text-slate-900 dark:text-white">{totalEditors}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Editors</span>
                  <span className="text-[16px] font-extrabold text-violet-500">{activeEditors}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Assigned</span>
                  <span className="text-[16px] font-extrabold text-slate-900 dark:text-white">{totalAssignedProjects}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg / Editor</span>
                  <span className="text-[16px] font-extrabold text-slate-900 dark:text-white">{avgProjectsPerEditor}</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-2 pb-6">
              {totalAssignedProjects === 0 || editors.length === 0 ? (
                /* Empty State */
                <div className="flex h-[230px] flex-col items-center justify-center text-center p-6 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800/80">
                  <div className="h-10 w-10 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center mb-3 border border-violet-500/20">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <p className="text-[15px] font-bold text-slate-800 dark:text-slate-200">No editor assignments yet</p>
                  <p className="text-[13px] text-slate-500 max-w-xs mt-1">
                    Projects assigned to editors will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="h-[230px] w-full">
                  {editors.length <= 5 ? (
                    /* Horizontal Bar Chart (5 or fewer editors) */
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={editorWorkload}
                        layout="vertical"
                        margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                        barSize={editors.length === 1 ? 32 : 22}
                        barCategoryGap={editors.length === 1 ? "40%" : "20%"}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.25} />
                        <XAxis type="number" fontSize={11} stroke="#94a3b8" tickLine={false} axisLine={false} allowDecimals={false} />
                        <YAxis dataKey="name" type="category" fontSize={12} stroke="#94a3b8" tickLine={false} axisLine={false} width={90} />
                        <Tooltip content={<EditorWorkloadTooltip totalAssigned={totalAssignedProjects} />} cursor={{ fill: 'rgba(139, 92, 246, 0.06)', radius: 6 }} />
                        <Bar dataKey="projects" fill="#8B5CF6" name="Active Projects" radius={[0, 8, 8, 0]} animationDuration={1000} animationEasing="ease-out" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    /* Vertical Bar Chart (More than 5 editors) */
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={editorWorkload}
                        margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                        barSize={24}
                        barCategoryGap="20%"
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.25} />
                        <XAxis dataKey="name" fontSize={11} stroke="#94a3b8" tickLine={false} axisLine={false} dy={6} />
                        <YAxis fontSize={11} stroke="#94a3b8" tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip content={<EditorWorkloadTooltip totalAssigned={totalAssignedProjects} />} cursor={{ fill: 'rgba(139, 92, 246, 0.06)', radius: 6 }} />
                        <Bar dataKey="projects" fill="#8B5CF6" name="Active Projects" radius={[8, 8, 0, 0]} animationDuration={1000} animationEasing="ease-out" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}
            </CardContent>
          </div>
        </Card>
      </div>
    </div>
  );
}
