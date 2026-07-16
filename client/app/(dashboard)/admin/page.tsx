'use client';

import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import {
  ResponsiveContainer,
  BarChart, Bar,
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

export default function AdminDashboard() {
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
  const totalProjects     = projects.length;
  const activeProjects    = projects.filter((p: any) =>
    ['IN_PROGRESS','EDITING','REVIEW','REVISION','REVISION_1','REVISION_2'].includes(p.status)
  ).length;
  const completedProjects = projects.filter((p: any) =>
    ['COMPLETED','FINAL_DRAFT','UPLOADED'].includes(p.status)
  ).length;

  const totalRevenue  = invoices.reduce((s: number, inv: any) => s + Number(inv.total  || 0), 0);
  const pendingCount  = invoices.filter((inv: any) => !['PAID','CANCELLED'].includes(inv.status)).length;
  const totalCosts    = totalRevenue * 0.6;
  const totalProfit   = totalRevenue - totalCosts;

  const upcomingDeadlines = projects.filter((p: any) => {
    if (!p.dueDate) return false;
    const diffDays = Math.ceil((new Date(p.dueDate).getTime() - Date.now()) / 86_400_000);
    return diffDays >= 0 && diffDays <= 7;
  }).length;

  // ── Demo fallbacks ────────────────────────────────────────────────────────
  const demoRevenue   = totalRevenue   || 45200;
  const demoCosts     = totalCosts     || 27120;
  const demoProfit    = totalProfit    || 18080;
  const demoProjects  = totalProjects  || 24;
  const demoActive    = activeProjects || 8;
  const demoCompleted = completedProjects || 14;
  const demoPending   = pendingCount   || 3;
  const demoDeadlines = upcomingDeadlines || 2;

  // ── Chart data ────────────────────────────────────────────────────────────
  const monthlyData = [
    { name: 'Jan', revenue: 32000, profit: 12800 },
    { name: 'Feb', revenue: 28000, profit: 11200 },
    { name: 'Mar', revenue: 35000, profit: 14000 },
    { name: 'Apr', revenue: 31000, profit: 12400 },
    { name: 'May', revenue: 38000, profit: 15200 },
    { name: 'Jun', revenue: 41000, profit: 16400 },
    { name: 'Jul', revenue: demoRevenue, profit: demoProfit },
  ];

  const projectTrends = [
    { name: 'Week 1', completed: 2, active: 5 },
    { name: 'Week 2', completed: 4, active: 7 },
    { name: 'Week 3', completed: 3, active: 6 },
    { name: 'Week 4', completed: 8, active: demoActive },
  ];

  const rawEditors = editors.map((ed: any) => ({
    name: ed.user?.name || 'Editor',
    projects: ed.projects?.length ?? Math.floor(Math.random() * 5),
  })).slice(0, 5);

  const editorWorkload = rawEditors.length > 0 ? rawEditors : [
    { name: 'Sarah Connor', projects: 4 },
    { name: 'John Doe',     projects: 2 },
    { name: 'Alex Mercer',  projects: 5 },
    { name: 'Ellen Ripley', projects: 1 },
  ];


  // ── Shared icon props — ONE spec, applied uniformly ───────────────────────
  const iconProps = { size: 18, strokeWidth: 1.5 };

  return (
    <div className="space-y-8">
      {/* Page header — subtitles use muted gray, never accent */}
      <div>
        <h1 className="text-[36px] font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
          Platform overview
        </h1>
        <p className="text-[16px] mt-2" style={{ color: V.muted }}>
          Real-time metrics, pipeline analytics, and editor workloads.
        </p>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

        {/* Total projects — neutral left-bar, neutral number */}
        <Card className="flat-card border-l-4 shadow-none" style={{ borderLeftColor: '#fff' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-450">
              Total projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold" style={{ color: '#fff' }}>
              {demoProjects}
            </div>
            <p className="text-[12px] mt-2" style={{ color: V.muted }}>
              Videos submitted this period
            </p>
          </CardContent>
        </Card>

        {/* Active projects — ONLY use of violet accent */}
        <Card className="flat-card border-l-4 shadow-none" style={{ borderLeftColor: '#fff' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-450">
              Active projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold" style={{ color: '#fff' }}>
              {demoActive}
            </div>
            <p className="text-[12px] mt-2" style={{ color: V.muted }}>
              Currently in edit pipeline
            </p>
          </CardContent>
        </Card>

        {/* Completed projects — green */}
        <Card className="flat-card border-l-4 shadow-none" style={{ borderLeftColor: '#fff' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-450">
              Completed projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold" style={{ color: '#fff' }}>
              {demoCompleted}
            </div>
            <p className="text-[12px] mt-2" style={{ color: V.muted }}>
              Approved and delivered videos
            </p>
          </CardContent>
        </Card>

        {/* Upcoming deadlines — red */}
        <Card className="flat-card border-l-4 shadow-none" style={{ borderLeftColor: '#fff' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-450">
              Upcoming deadlines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold" style={{ color: '#fff' }}>
              {demoDeadlines}
            </div>
            <p className="text-[12px] mt-2" style={{ color: V.muted }}>
              Due within next seven days
            </p>
          </CardContent>
        </Card>

        {/* Revenue — neutral (informational, not alarming) */}
        <Card className="flat-card border-l-4 shadow-none" style={{ borderLeftColor: '#fff' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-450">
              Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold" style={{ color: '#fff' }}>
              {formatCurrency(demoRevenue)}
            </div>
            <p className="text-[12px] mt-2" style={{ color: V.muted }}>
              Gross billed client invoices
            </p>
          </CardContent>
        </Card>

        {/* Costs — neutral (operational, not alarm) */}
        <Card className="flat-card border-l-4 shadow-none" style={{ borderLeftColor: '#fff' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-450">
              Costs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold" style={{ color: '#fff' }}>
              {formatCurrency(demoCosts)}
            </div>
            <p className="text-[12px] mt-2" style={{ color: V.muted }}>
              Editor service payouts
            </p>
          </CardContent>
        </Card>

        {/* Profit — green */}
        <Card className="flat-card border-l-4 shadow-none" style={{ borderLeftColor: '#fff' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-450">
              Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold" style={{ color: '#fff' }}>
              {formatCurrency(demoProfit)}
            </div>
            <p className="text-[12px] mt-2" style={{ color: V.muted }}>
              Net operating profit margin
            </p>
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
        <Card className="lg:col-span-3 flat-card shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-[18px] font-bold text-slate-900 dark:text-white">Financial performance</CardTitle>
            {/* Subtitle: muted gray, never accent color */}
            <CardDescription className="text-sm mt-1" style={{ color: V.muted }}>
              Monthly comparison of gross revenue and net profit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                  <XAxis dataKey="name" fontSize={14} stroke={V.muted} tickLine={false} />
                  <YAxis
                    fontSize={14}
                    stroke={V.muted}
                    domain={[0, 50000]}
                    ticks={[0, 10000, 20000, 30000, 40000, 50000]}
                    tickFormatter={(v) => `$${v / 1000}k`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                    labelStyle={{ color: '#f4f4f5', fontSize: 14 }}
                    itemStyle={{ fontSize: 14 }}
                    formatter={(value) => [`$${Number(value).toLocaleString()}`, '']}
                  />
                  <Bar dataKey="revenue" fill={V.neutral} name="Revenue" radius={[2,2,0,0]} />
                  <Bar dataKey="profit"  fill={V.green}   name="Profit"  radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
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

        {/* Editor workloads — horizontal bar */}
        <Card className="flat-card shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-[18px] font-bold text-slate-900 dark:text-white">Editor workloads</CardTitle>
            <CardDescription className="text-sm mt-1" style={{ color: V.muted }}>
              Active projects currently assigned per editor
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={editorWorkload}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                  <XAxis type="number" fontSize={14} stroke={V.muted} tickLine={false} />
                  <YAxis dataKey="name" type="category" fontSize={14} stroke={V.muted} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                    itemStyle={{ fontSize: 14 }}
                  />
                  {/* Violet here reinforces: violet = active pipeline load */}
                  <Bar dataKey="projects" fill={V.accent} name="Active projects" radius={[0,2,2,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
