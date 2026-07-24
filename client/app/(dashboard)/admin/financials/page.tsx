'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Banknote,
  Receipt,
  TrendingUp,
  Hourglass,
  Layers,
  CircleCheck,
  Timer,
  Calendar,
  Filter,
  RefreshCw,
  Search,
} from 'lucide-react';
import { formatCurrency, formatEditorCurrency } from '@/lib/utils';
import { useExchangeRate, buildProfitDisplay, formatFetchedAgo } from '@/lib/exchangeRate';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
} from 'recharts';

const V = {
  accent: '#7c3aed', // violet — active pipeline only
  neutral: '#94a3b8', // slate-400 — informational / revenue
  green: '#10b981', // completed / profit
  amber: '#f59e0b', // pending
  red: '#ef4444', // urgent / overdue
  orange: '#f97316', // high priority
  gray: '#4b5563', // low priority
  muted: '#71717a', // labels / subtitles
};

export default function FinancialsDashboard() {
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
  // ── Filters ──────────────────────────────────────────────────────────────
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedEditor, setSelectedEditor] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [minVal, setMinVal] = useState('');
  const [maxVal, setMaxVal] = useState('');
  const [activeTab, setActiveTab] = useState<'company' | 'clients' | 'editors'>('company');

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: projectsData, refetch: refetchProjects } = useQuery({
    queryKey: ['projects-financials'],
    queryFn: async () => {
      const res = await api.get('/projects?limit=1000');
      return res.data;
    },
  });

  const { data: invoicesData, refetch: refetchInvoices } = useQuery({
    queryKey: ['invoices-financials'],
    queryFn: async () => {
      const res = await api.get('/invoices?limit=1000');
      return res.data;
    },
  });

  const { data: editorsData, refetch: refetchEditors } = useQuery({
    queryKey: ['editors-financials'],
    queryFn: async () => {
      const res = await api.get('/editors?limit=1000');
      return res.data;
    },
  });

  const { data: clientsData, refetch: refetchClients } = useQuery({
    queryKey: ['clients-financials'],
    queryFn: async () => {
      const res = await api.get('/clients?limit=1000');
      return res.data;
    },
  });

  const handleReset = () => {
    setSelectedClient('');
    setSelectedEditor('');
    setSelectedMonth('');
    setStartDate('');
    setEndDate('');
    setSelectedStatus('');
    setMinVal('');
    setMaxVal('');
  };

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
  const editors = editorsData?.data || [];
  const clients = clientsData?.data || [];

  // ── Filtered Datasets ───────────────────────────────────────────────────
  const filteredProjects = projects.filter((p: any) => {
    if (selectedClient && p.clientId !== selectedClient) return false;
    if (selectedEditor && p.editorId !== selectedEditor) return false;
    if (selectedStatus && p.status !== selectedStatus) return false;

    const pClientPrice = Number(p.clientPrice || 0);
    if (minVal && pClientPrice < Number(minVal)) return false;
    if (maxVal && pClientPrice > Number(maxVal)) return false;

    const projDate = new Date(p.createdAt);
    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      if (
        projDate.getFullYear() !== Number(year) ||
        projDate.getMonth() + 1 !== Number(month)
      ) {
        return false;
      }
    }

    if (startDate && new Date(startDate) > projDate) return false;
    if (endDate && new Date(endDate) < projDate) return false;

    return true;
  });

  const filteredInvoices = invoices.filter((inv: any) => {
    if (selectedClient && inv.clientId !== selectedClient) return false;
    
    // Find project info associated with invoice if any
    const associatedProj = projects.find((p: any) => p.id === inv.projectId);
    if (associatedProj) {
      if (selectedEditor && associatedProj.editorId !== selectedEditor) return false;
      if (selectedStatus && associatedProj.status !== selectedStatus) return false;
    } else {
      if (selectedEditor || selectedStatus) return false;
    }

    const invDate = new Date(inv.createdAt);
    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      if (
        invDate.getFullYear() !== Number(year) ||
        invDate.getMonth() + 1 !== Number(month)
      ) {
        return false;
      }
    }

    if (startDate && new Date(startDate) > invDate) return false;
    if (endDate && new Date(endDate) < invDate) return false;

    return true;
  });

  const rate = exchangeRate ? exchangeRate.usdToInr : 83.5;

  // ── Dynamic KPIs (PRD Definitions) ────────────────────────────────────────
  // Filter for approved/completed projects only
  const completedProjectsList = filteredProjects.filter((p: any) => p.status === 'UPLOADED');

  // Total Revenue: sum of Client Price for completed projects
  const totalRevenue = completedProjectsList.reduce((s: number, p: any) => s + Number(p.clientPrice || 0), 0);

  // Total Costs: sum of Editor Price for completed projects (stored in INR)
  const totalCosts = completedProjectsList.reduce((s: number, p: any) => s + Number(p.editorPrice || 0), 0);

  // Total Profit: Revenue - Costs (converted to base currency USD)
  const totalProfit = totalRevenue - (totalCosts / rate);

  // Outstanding Balance: sum of remaining client payments on active invoices
  const outstandingBalance = filteredInvoices
    .filter((inv: any) => !['PAID', 'CANCELLED'].includes(inv.status))
    .reduce((s: number, inv: any) => s + (Number(inv.total || 0) - Number(inv.amountPaid || 0)), 0);

  // Pending Editor Payments: editor price of completed projects where editor is assigned
  const pendingEditorPayments = filteredProjects
    .filter((p: any) => p.editorId && ['FINAL_DRAFT', 'UPLOADED', 'COMPLETED'].includes(p.status))
    .reduce((s: number, p: any) => s + Number(p.editorPrice || 0), 0);

  const completedProjectsCount = filteredProjects.filter((p: any) =>
    ['FINAL_DRAFT', 'UPLOADED', 'COMPLETED'].includes(p.status)
  ).length;

  const activeProjectsCount = filteredProjects.filter((p: any) =>
    ['NEW_VIDEO', 'EDITING', 'EDITING_REVIEW', 'REVISION_1', 'REVISION_1_REVIEW', 'REVISION_2', 'REVISION_2_REVIEW', 'REVISION_3', 'REVISION_3_REVIEW'].includes(p.status)
  ).length;

  // Revenue (native USD)
  const revenueFormatted = displayCurrency === 'USD'
    ? formatCurrency(totalRevenue)
    : `≈ ${formatEditorCurrency(totalRevenue * rate)}`;

  // Costs (native INR)
  const costsFormatted = displayCurrency === 'INR'
    ? formatEditorCurrency(totalCosts)
    : `≈ ${formatCurrency(totalCosts / rate)}`;

  // Outstanding Balance (native USD)
  const outstandingFormatted = displayCurrency === 'USD'
    ? formatCurrency(outstandingBalance)
    : `≈ ${formatEditorCurrency(outstandingBalance * rate)}`;

  // Pending Editor Payments (native INR)
  const pendingPaymentsFormatted = displayCurrency === 'INR'
    ? formatEditorCurrency(pendingEditorPayments)
    : `≈ ${formatCurrency(pendingEditorPayments / rate)}`;

  // Profit (cross-currency, always estimated with ≈)
  const profitInUsd = totalRevenue - (totalCosts / rate);
  const profitInInr = (totalRevenue * rate) - totalCosts;
  const profitFormatted = displayCurrency === 'USD'
    ? `≈ ${formatCurrency(profitInUsd)}`
    : `≈ ${formatEditorCurrency(profitInInr)}`;

  // Monthly Revenue: current month's revenue (uses today's month from completed projects)
  const currentMonthStr = new Date().toISOString().substring(0, 7); // "YYYY-MM"
  const monthlyRevenue = projects
    .filter((p: any) => p.status === 'UPLOADED')
    .filter((p: any) => {
      const pMonth = (p.completedAt || p.updatedAt).substring(0, 7);
      return pMonth === currentMonthStr;
    })
    .reduce((s: number, p: any) => s + Number(p.clientPrice || 0), 0);

  // ── Chart Data Generation ───────────────────────────────────────────────
  // Group by month
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();

  const monthlyChartData = months.map((monthName, index) => {
    const monthNum = index + 1;
    const monthProj = projects.filter((p: any) => p.status === 'UPLOADED');
    const monthProjMatch = monthProj.filter((p: any) => {
      const d = new Date(p.completedAt || p.updatedAt);
      return d.getFullYear() === currentYear && d.getMonth() + 1 === monthNum;
    });

    const rev = monthProjMatch
      .reduce((s: number, p: any) => s + Number(p.clientPrice || 0), 0);

    const cost = monthProjMatch
      .reduce((s: number, p: any) => s + Number(p.editorPrice || 0), 0);

    const convertedRev = displayCurrency === 'USD' ? rev : rev * rate;
    const convertedCost = displayCurrency === 'INR' ? cost : cost / rate;
    const convertedProfit = displayCurrency === 'USD'
      ? rev - (cost / rate)
      : (rev * rate) - cost;

    return {
      name: monthName,
      revenue: Math.round(convertedRev),
      costs: Math.round(convertedCost),
      profit: Math.round(convertedProfit),
    };
  }).filter((d) => d.revenue > 0 || d.costs > 0); // Only show months with data

  // Client Utilization Chart Data
  const clientChartData = clients.slice(0, 5).map((cl: any) => {
    const clientProj = projects.filter((p: any) => p.clientId === cl.id);
    const submitted = clientProj.length;
    const completed = clientProj.filter((p: any) => ['FINAL_DRAFT', 'UPLOADED', 'COMPLETED'].includes(p.status)).length;
    return {
      name: cl.user?.name || cl.company || 'Client',
      submitted,
      completed,
    };
  });

  // Editor Workload Chart Data
  const editorChartData = editors.slice(0, 5).map((ed: any) => {
    const active = projects.filter((p: any) => 
      p.editorId === ed.id &&
      ['NEW_VIDEO', 'EDITING', 'EDITING_REVIEW', 'REVISION_1', 'REVISION_1_REVIEW', 'REVISION_2', 'REVISION_2_REVIEW', 'REVISION_3', 'REVISION_3_REVIEW'].includes(p.status)
    ).length;
    return {
      name: ed.user?.name || 'Editor',
      active,
    };
  });

  const iconProps = { size: 18, strokeWidth: 1.5 };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[36px] font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
            Financial Analytics
          </h1>
          <p className="text-[16px] mt-2 text-slate-500 dark:text-slate-450">
            Real-time profit tracking, client balances, and editor payout performance.
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

          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 text-[15px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg transition-all cursor-pointer"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <Card className="shadow-none border border-slate-200 dark:border-slate-800 bg-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4 text-[15px] font-bold text-slate-800 dark:text-slate-200">
            <Filter size={18} /> Filters
          </div>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {/* Client Filter */}
            <div>
              <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Client</label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[15px]"
              >
                <option value="">All Clients</option>
                {clients.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.user?.name || c.company}
                  </option>
                ))}
              </select>
            </div>

            {/* Editor Filter */}
            <div>
              <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Editor</label>
              <select
                value={selectedEditor}
                onChange={(e) => setSelectedEditor(e.target.value)}
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[15px]"
              >
                <option value="">All Editors</option>
                {editors.map((e: any) => (
                  <option key={e.id} value={e.id}>
                    {e.user?.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Filter */}
            <div>
              <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Month</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[15px]"
              />
            </div>

            {/* Date Range Start */}
            <div>
              <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[15px]"
              />
            </div>

            {/* Date Range End */}
            <div>
              <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[15px]"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[15px]"
              >
                <option value="">All Statuses</option>
                <option value="NEW_VIDEO">New Video</option>
                <option value="EDITING">Editing</option>
                <option value="EDITING_REVIEW">Editing Review</option>
                <option value="FINAL_DRAFT">Final Draft</option>
                <option value="UPLOADED">Uploaded</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Min Value */}
            <div>
              <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Min Project Value</label>
              <input
                type="number"
                placeholder="Min $"
                value={minVal}
                onChange={(e) => setMinVal(e.target.value)}
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[15px]"
              />
            </div>

            {/* Max Value */}
            <div>
              <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Max Project Value</label>
              <input
                type="number"
                placeholder="Max $"
                value={maxVal}
                onChange={(e) => setMaxVal(e.target.value)}
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[15px]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-[15px] font-semibold text-slate-650 dark:text-slate-400 hover:text-slate-850"
            >
              Reset Filters
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <Card className="shadow-none border border-slate-200 dark:border-slate-850">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-500">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold text-slate-900 dark:text-white">
              {revenueFormatted}
            </div>
            <p className="text-[12px] mt-2 text-slate-500">Gross cleared client income</p>
          </CardContent>
        </Card>

        {/* Total Costs */}
        <Card className="shadow-none border border-slate-200 dark:border-slate-850">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-500">
              Total Costs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold text-slate-900 dark:text-white">
              {costsFormatted}
            </div>
            <p className="text-[12px] mt-2 text-slate-500">Editor service payouts</p>
          </CardContent>
        </Card>

        {/* Total Profit */}
        <Card className="shadow-none border border-slate-200 dark:border-slate-850">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-500">
              Total Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold text-slate-900 dark:text-white">
              {profitFormatted}
            </div>
            <p className="text-[12px] mt-2 text-slate-500">Net operating margin</p>
          </CardContent>
        </Card>

        {/* Outstanding Balance */}
        <Card className="shadow-none border border-slate-200 dark:border-slate-850">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-500">
              Client Balances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold text-slate-900 dark:text-white">
              {outstandingFormatted}
            </div>
            <p className="text-[12px] mt-2 text-slate-500">Unpaid invoice amounts</p>
          </CardContent>
        </Card>

        {/* Pending Editor Payments */}
        <Card className="shadow-none border border-slate-200 dark:border-slate-850">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-500">
              Pending Payouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold text-slate-900 dark:text-white">
              {pendingPaymentsFormatted}
            </div>
            <p className="text-[12px] mt-2 text-slate-500">Owed to editors for finished videos</p>
          </CardContent>
        </Card>

        {/* Completed Projects */}
        <Card className="shadow-none border border-slate-200 dark:border-slate-850">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-500">
              Completed Work
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold text-slate-900 dark:text-white">
              {completedProjectsCount}
            </div>
            <p className="text-[12px] mt-2 text-slate-500">Delivered video count</p>
          </CardContent>
        </Card>

        {/* Active Projects */}
        <Card className="shadow-none border border-slate-200 dark:border-slate-850">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-500">
              Active Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold text-slate-900 dark:text-white">
              {activeProjectsCount}
            </div>
            <p className="text-[12px] mt-2 text-slate-500">Videos in progress</p>
          </CardContent>
        </Card>

        {/* Monthly Revenue */}
        <Card className="shadow-none border border-slate-200 dark:border-slate-850">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] font-bold uppercase tracking-widest text-slate-500">
              Monthly Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold text-slate-900 dark:text-white">
              {formatCurrency(monthlyRevenue)}
            </div>
            <p className="text-[12px] mt-2 text-slate-500">Billed in the current calendar month</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs / Sections ─────────────────────────────────────────────────── */}
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('company')}
          className={`px-4 py-2 text-[15px] font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'company'
              ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Company Performance
        </button>
        <button
          onClick={() => setActiveTab('clients')}
          className={`px-4 py-2 text-[15px] font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'clients'
              ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Client Accounts
        </button>
        <button
          onClick={() => setActiveTab('editors')}
          className={`px-4 py-2 text-[15px] font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'editors'
              ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Editor Earnings
        </button>
      </div>

      {/* ── Content Sections ───────────────────────────────────────────────── */}
      {activeTab === 'company' && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Revenue & Profit Trends Chart */}
          <Card className="lg:col-span-2 shadow-none border border-slate-200 dark:border-slate-800 bg-card">
            <CardHeader>
              <CardTitle className="text-[18px] font-bold text-slate-900 dark:text-white">Revenue & Profit Trends</CardTitle>
              <CardDescription style={{ color: V.muted }}>
                Monthly overview of billing vs margin performance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                    <XAxis dataKey="name" fontSize={14} stroke={V.muted} tickLine={false} />
                    <YAxis fontSize={14} stroke={V.muted} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                      itemStyle={{ fontSize: 14 }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" stroke={V.neutral} fill={V.neutral} fillOpacity={0.08} name="Revenue" />
                    <Area type="monotone" dataKey="profit" stroke={V.green} fill={V.green} fillOpacity={0.08} name="Profit" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Editor Workloads Chart */}
          <Card className="shadow-none border border-slate-200 dark:border-slate-800 bg-card">
            <CardHeader>
              <CardTitle className="text-[18px] font-bold text-slate-900 dark:text-white">Editor Distribution</CardTitle>
              <CardDescription style={{ color: V.muted }}>Active project assignments workload.</CardDescription>
            </CardHeader>
            <CardContent>
              {editorChartData.length > 0 ? (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={editorChartData} layout="vertical" margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                      <XAxis type="number" fontSize={14} stroke={V.muted} tickLine={false} />
                      <YAxis dataKey="name" type="category" fontSize={14} stroke={V.muted} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                        itemStyle={{ fontSize: 14 }}
                      />
                      <Bar dataKey="active" fill={V.accent} name="Active Projects" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-slate-400">No active editor assignments found.</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'clients' && (
        <Card className="shadow-none border border-slate-200 dark:border-slate-800 bg-card">
          <CardHeader>
            <CardTitle className="text-[18px] font-bold text-slate-900 dark:text-white">Per Client Performance</CardTitle>
            <CardDescription style={{ color: V.muted }}>Revenue and balance breakdown for every client account.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[15px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider">Client Name</th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider">Company</th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-right">Total Revenue</th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-right">Advance Paid</th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-right">Remaining Balance</th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-center">Completed Videos</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((cl: any) => {
                    const clientProj = projects.filter((p: any) => p.clientId === cl.id);
                    const clientInv = invoices.filter((inv: any) => inv.clientId === cl.id);
                    
                    const clientRev = clientProj
                      .filter((p: any) => p.status === 'UPLOADED')
                      .reduce((s: number, p: any) => s + Number(p.clientPrice || 0), 0);
                    
                    const clientBalance = clientInv
                      .filter((inv: any) => !['PAID', 'CANCELLED'].includes(inv.status))
                      .reduce((s: number, inv: any) => s + (Number(inv.total || 0) - Number(inv.amountPaid || 0)), 0);

                    const completedCount = clientProj.filter((p: any) => p.status === 'UPLOADED').length;

                    return (
                      <tr key={cl.id} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                        <td className="p-4 font-medium text-slate-900 dark:text-white">{cl.user?.name || 'Unknown'}</td>
                        <td className="p-4 text-slate-500">{cl.company || '—'}</td>
                        <td className="p-4 text-right font-medium text-emerald-500">{formatCurrency(clientRev)}</td>
                        <td className="p-4 text-right text-slate-500">{formatCurrency(Number(cl.advancePaid || 0))}</td>
                        <td className="p-4 text-right font-medium text-amber-500">{formatCurrency(clientBalance)}</td>
                        <td className="p-4 text-center font-bold">{completedCount}</td>
                      </tr>
                    );
                  })}
                  {clients.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">No client accounts found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'editors' && (
        <Card className="shadow-none border border-slate-200 dark:border-slate-800 bg-card">
          <CardHeader>
            <CardTitle className="text-[18px] font-bold text-slate-900 dark:text-white">Per Editor Analytics</CardTitle>
            <CardDescription style={{ color: V.muted }}>Workload deliverables, payouts, and pending editor payouts.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[15px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider">Editor Name</th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-center">Completed Projects</th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-center">Active Workload</th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-right">Total Earnings</th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-right">Pending Payments</th>
                  </tr>
                </thead>
                <tbody>
                  {editors.map((ed: any) => {
                    const editorProj = projects.filter((p: any) => p.editorId === ed.id);
                    
                    const completedCount = editorProj.filter((p: any) => p.status === 'UPLOADED').length;

                    const activeCount = editorProj.filter((p: any) => 
                      ['NEW_VIDEO', 'EDITING', 'EDITING_REVIEW', 'REVISION_1', 'REVISION_1_REVIEW', 'REVISION_2', 'REVISION_2_REVIEW', 'REVISION_3', 'REVISION_3_REVIEW'].includes(p.status)
                    ).length;

                    const totalEarnings = editorProj
                      .filter((p: any) => p.status === 'UPLOADED')
                      .reduce((s: number, p: any) => s + Number(p.editorPrice || 0), 0);

                    const pendingPayments = editorProj
                      .filter((p: any) => p.status === 'UPLOADED')
                      .reduce((s: number, p: any) => s + Number(p.editorPrice || 0), 0); // Owed for finished videos

                    const totalEarningsFormatted = displayCurrency === 'INR'
                      ? formatEditorCurrency(totalEarnings)
                      : `≈ ${formatCurrency(totalEarnings / rate)}`;

                    const pendingPaymentsFormatted = displayCurrency === 'INR'
                      ? formatEditorCurrency(pendingPayments)
                      : `≈ ${formatCurrency(pendingPayments / rate)}`;

                    return (
                      <tr key={ed.id} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                        <td className="p-4 font-medium text-slate-900 dark:text-white">{ed.user?.name || 'Unknown'}</td>
                        <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">{completedCount}</td>
                        <td className="p-4 text-center font-bold text-violet-500">{activeCount}</td>
                        <td className="p-4 text-right font-medium text-slate-900 dark:text-white">{totalEarningsFormatted}</td>
                        <td className="p-4 text-right font-medium text-amber-500">{pendingPaymentsFormatted}</td>
                      </tr>
                    );
                  })}
                  {editors.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">No editors found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
