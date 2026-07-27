'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Filter,
  RefreshCw,
} from 'lucide-react';
import { formatCurrency, formatEditorCurrency } from '@/lib/utils';
import { useExchangeRate, formatFetchedAgo } from '@/lib/exchangeRate';
import { calculateFinancialMetrics } from '@/lib/projectMetrics';

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

    const pClientPrice = Number(p.budget || p.clientPrice || 0);
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

  const metrics = calculateFinancialMetrics(filteredProjects, filteredInvoices, clients, editors, rate);

  // Revenue (native USD)
  const revenueFormatted = displayCurrency === 'USD'
    ? formatCurrency(metrics.totalRevenueUsd)
    : formatEditorCurrency(metrics.totalRevenueUsd * rate);

  // Costs (native INR)
  const costsFormatted = displayCurrency === 'INR'
    ? formatEditorCurrency(metrics.totalCostsInr)
    : formatCurrency(metrics.totalCostsUsd);

  // Net Margin
  const profitFormatted = displayCurrency === 'USD'
    ? formatCurrency(metrics.totalNetMarginUsd)
    : formatEditorCurrency(metrics.totalNetMarginInr);

  // Outstanding Balance
  const outstandingFormatted = displayCurrency === 'USD'
    ? formatCurrency(metrics.clientBalances)
    : formatEditorCurrency(metrics.clientBalances * rate);

  // Pending Editor Payments
  const pendingPaymentsFormatted = displayCurrency === 'INR'
    ? formatEditorCurrency(metrics.pendingEditorPayouts)
    : formatCurrency(metrics.pendingEditorPayouts / rate);

  return (
    <div className="space-y-8 bg-[#D8CFC2] text-[#1F1610] p-1">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[36px] font-extrabold tracking-tight text-[#1F1610] leading-tight">
            Financial Analytics
          </h1>
          <p className="text-[16px] mt-1 text-[#4A3E34]">
            Real-time profit tracking, client balances, and editor payout performance.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {exchangeRate && (
            <div className="text-[12px] text-[#4A3E34] font-bold px-3 py-2 rounded-xl shadow-[inset_2px_2px_5px_rgba(135,120,108,0.6),inset_-2px_-2px_5px_rgba(255,255,255,0.72)]">
              1 USD = ₹{exchangeRate.usdToInr.toFixed(2)} · {formatFetchedAgo(exchangeRate.fetchedAt)}
            </div>
          )}

          {/* Currency Toggle */}
          <div className="flex items-center bg-[#D8CFC2] p-1.5 rounded-2xl shadow-[inset_3px_3px_6px_rgba(135,120,108,0.7),inset_-3px_-3px_6px_rgba(255,255,255,0.72)]">
            <button
              onClick={() => handleCurrencyChange('USD')}
              className={`px-4 py-2 rounded-xl text-[13px] font-extrabold transition-all cursor-pointer ${
                displayCurrency === 'USD'
                  ? 'bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white shadow-[-3px_-3px_6px_rgba(255,255,255,0.6),3px_3px_8px_rgba(234,88,12,0.45)]'
                  : 'text-[#4A3E34] hover:text-[#1F1610]'
              }`}
            >
              USD ($)
            </button>
            <button
              onClick={() => handleCurrencyChange('INR')}
              className={`px-4 py-2 rounded-xl text-[13px] font-extrabold transition-all cursor-pointer ${
                displayCurrency === 'INR'
                  ? 'bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white shadow-[-3px_-3px_6px_rgba(255,255,255,0.6),3px_3px_8px_rgba(234,88,12,0.45)]'
                  : 'text-[#4A3E34] hover:text-[#1F1610]'
              }`}
            >
              INR (₹)
            </button>
          </div>

          <button
            onClick={handleRefresh}
            className="h-10 px-4 font-bold text-[14px] text-[#1F1610] bg-[#E2DACC] rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-[-4px_-4px_8px_rgba(255,255,255,0.85),4px_4px_8px_rgba(125,110,98,0.72)] hover:shadow-[-6px_-6px_12px_rgba(255,255,255,0.9),6px_6px_12px_rgba(115,100,88,0.8)] active:shadow-[inset_3px_3px_6px_rgba(135,120,108,0.7),inset_-3px_-3px_6px_rgba(255,255,255,0.72)]"
          >
            <div className="h-6 w-6 rounded-lg bg-[#D8CFC2] flex items-center justify-center mr-2 shadow-[inset_1.5px_1.5px_3px_rgba(135,120,108,0.6),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.72)] text-[#EA580C]">
              <RefreshCw size={13} />
            </div>
            Refresh
          </button>
        </div>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <div className="p-6 bg-[#D8CFC2] rounded-3xl shadow-[inset_4px_4px_10px_rgba(135,120,108,0.55),inset_-4px_-4px_10px_rgba(255,255,255,0.7)] border border-[rgba(135,120,108,0.35)] space-y-4">
        <div className="flex items-center gap-3 text-[16px] font-extrabold text-[#1F1610]">
          <div className="h-8 w-8 rounded-xl bg-[#D8CFC2] flex items-center justify-center shadow-[inset_2px_2px_4px_rgba(135,120,108,0.65),inset_-2px_-2px_4px_rgba(255,255,255,0.72)] text-[#EA580C]">
            <Filter size={16} />
          </div>
          <span>Filters</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {/* Client Filter */}
          <div>
            <label className="block text-[12px] font-extrabold text-[#4A3E34] uppercase tracking-wider mb-1.5">Client</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full h-11 px-4 bg-[#D8CFC2] text-[#1F1610] font-semibold border-0 rounded-2xl text-sm shadow-[inset_4px_4px_8px_rgba(135,120,108,0.7),inset_-4px_-4px_8px_rgba(255,255,255,0.72)] cursor-pointer"
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
            <label className="block text-[12px] font-extrabold text-[#4A3E34] uppercase tracking-wider mb-1.5">Editor</label>
            <select
              value={selectedEditor}
              onChange={(e) => setSelectedEditor(e.target.value)}
              className="w-full h-11 px-4 bg-[#D8CFC2] text-[#1F1610] font-semibold border-0 rounded-2xl text-sm shadow-[inset_4px_4px_8px_rgba(135,120,108,0.7),inset_-4px_-4px_8px_rgba(255,255,255,0.72)] cursor-pointer"
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
            <label className="block text-[12px] font-extrabold text-[#4A3E34] uppercase tracking-wider mb-1.5">Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full h-11 px-4 bg-[#D8CFC2] text-[#1F1610] font-semibold border-0 rounded-2xl text-sm shadow-[inset_4px_4px_8px_rgba(135,120,108,0.7),inset_-4px_-4px_8px_rgba(255,255,255,0.72)]"
            />
          </div>

          {/* Date Range Start */}
          <div>
            <label className="block text-[12px] font-extrabold text-[#4A3E34] uppercase tracking-wider mb-1.5">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-11 px-4 bg-[#D8CFC2] text-[#1F1610] font-semibold border-0 rounded-2xl text-sm shadow-[inset_4px_4px_8px_rgba(135,120,108,0.7),inset_-4px_-4px_8px_rgba(255,255,255,0.72)]"
            />
          </div>

          {/* Date Range End */}
          <div>
            <label className="block text-[12px] font-extrabold text-[#4A3E34] uppercase tracking-wider mb-1.5">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-11 px-4 bg-[#D8CFC2] text-[#1F1610] font-semibold border-0 rounded-2xl text-sm shadow-[inset_4px_4px_8px_rgba(135,120,108,0.7),inset_-4px_-4px_8px_rgba(255,255,255,0.72)]"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[12px] font-extrabold text-[#4A3E34] uppercase tracking-wider mb-1.5">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-11 px-4 bg-[#D8CFC2] text-[#1F1610] font-semibold border-0 rounded-2xl text-sm shadow-[inset_4px_4px_8px_rgba(135,120,108,0.7),inset_-4px_-4px_8px_rgba(255,255,255,0.72)] cursor-pointer"
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
            <label className="block text-[12px] font-extrabold text-[#4A3E34] uppercase tracking-wider mb-1.5">Min Project Value</label>
            <input
              type="number"
              placeholder="Min $"
              value={minVal}
              onChange={(e) => setMinVal(e.target.value)}
              className="w-full h-11 px-4 bg-[#D8CFC2] text-[#1F1610] font-semibold border-0 rounded-2xl text-sm shadow-[inset_4px_4px_8px_rgba(135,120,108,0.7),inset_-4px_-4px_8px_rgba(255,255,255,0.72)]"
            />
          </div>

          {/* Max Value */}
          <div>
            <label className="block text-[12px] font-extrabold text-[#4A3E34] uppercase tracking-wider mb-1.5">Max Project Value</label>
            <input
              type="number"
              placeholder="Max $"
              value={maxVal}
              onChange={(e) => setMaxVal(e.target.value)}
              className="w-full h-11 px-4 bg-[#D8CFC2] text-[#1F1610] font-semibold border-0 rounded-2xl text-sm shadow-[inset_4px_4px_8px_rgba(135,120,108,0.7),inset_-4px_-4px_8px_rgba(255,255,255,0.72)]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={handleReset}
            className="px-5 py-2.5 text-[14px] font-bold text-[#4A3E34] hover:text-[#EA580C] transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Row 1: Total Revenue, Total Editor Cost, Total Net Margin, Margin % */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <Card className="neu-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-[12px] font-extrabold uppercase tracking-widest text-[#4A3E34]">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold text-[#1F1610]">
              {revenueFormatted}
            </div>
            <p className="text-[12px] mt-2 text-[#4A3E34]">Gross billed revenue (approved projects)</p>
          </CardContent>
        </Card>

        {/* Total Costs */}
        <Card className="neu-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-[12px] font-extrabold uppercase tracking-widest text-[#4A3E34]">
              Total Editor Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold text-[#1F1610]">
              {costsFormatted}
            </div>
            <p className="text-[12px] mt-2 text-[#4A3E34]">Editor service payouts</p>
          </CardContent>
        </Card>

        {/* Total Profit */}
        <Card className="neu-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-[12px] font-extrabold uppercase tracking-widest text-[#4A3E34]">
              Total Net Margin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold text-[#10B981]">
              {profitFormatted}
            </div>
            <p className="text-[12px] mt-2 text-[#4A3E34]">Net operating margin</p>
          </CardContent>
        </Card>

        {/* Margin % */}
        <Card className="neu-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-[12px] font-extrabold uppercase tracking-widest text-[#4A3E34]">
              Margin %
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold text-[#EA580C]">
              {metrics.marginPct}{metrics.marginPct !== 'N/A' ? '%' : ''}
            </div>
            <p className="text-[12px] mt-2 text-[#4A3E34]">Profit relative to revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Client Balances, Pending Payouts */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Outstanding Balance */}
        <Card className="neu-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-[12px] font-extrabold uppercase tracking-widest text-[#4A3E34]">
              Client Balances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold text-[#1F1610]">
              {outstandingFormatted}
            </div>
            <p className="text-[12px] mt-2 text-[#4A3E34]">Unpaid invoice amounts</p>
          </CardContent>
        </Card>

        {/* Pending Editor Payments */}
        <Card className="neu-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-[12px] font-extrabold uppercase tracking-widest text-[#4A3E34]">
              Pending Payouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-figure text-[38px] font-extrabold text-[#EA580C]">
              {pendingPaymentsFormatted}
            </div>
            <p className="text-[12px] mt-2 text-[#4A3E34]">Owed to editors for finished videos</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Per-Client breakdown table */}
      <Card className="neu-card">
        <CardHeader>
          <CardTitle className="text-[20px] font-extrabold text-[#1F1610]">Per-Client Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#CBBFA8]">
                <th className="py-3 px-4 font-bold text-[#4A3E34]">Client Name</th>
                <th className="py-3 px-4 font-bold text-[#4A3E34]">Total Revenue</th>
                <th className="py-3 px-4 font-bold text-[#4A3E34]">Advance Received</th>
                <th className="py-3 px-4 font-bold text-[#4A3E34]">Remaining Credit</th>
                <th className="py-3 px-4 font-bold text-[#4A3E34]">Completed Videos</th>
              </tr>
            </thead>
            <tbody>
              {metrics.clientBreakdowns.filter(b => b.completedVideos > 0 || b.advanceReceived > 0).map(client => (
                <tr key={client.clientId} className="border-b border-[rgba(135,120,108,0.25)] hover:bg-[rgba(255,255,255,0.2)]">
                  <td className="py-3 px-4 font-extrabold text-[#1F1610]">{client.clientName}</td>
                  <td className="py-3 px-4 font-bold">{displayCurrency === 'USD' ? formatCurrency(client.totalRevenue) : formatEditorCurrency(client.totalRevenue * rate)}</td>
                  <td className="py-3 px-4 font-bold">{displayCurrency === 'USD' ? formatCurrency(client.advanceReceived) : formatEditorCurrency(client.advanceReceived * rate)}</td>
                  <td className="py-3 px-4 text-[#10B981] font-extrabold">
                    {displayCurrency === 'USD' ? formatCurrency(client.remainingCredit) : formatEditorCurrency(client.remainingCredit * rate)}
                  </td>
                  <td className="py-3 px-4 font-bold">{client.completedVideos}</td>
                </tr>
              ))}
              {metrics.clientBreakdowns.filter(b => b.completedVideos > 0 || b.advanceReceived > 0).length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#4A3E34] font-semibold">No client data matches the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Row 4: Per-Editor breakdown table */}
      <Card className="neu-card">
        <CardHeader>
          <CardTitle className="text-[20px] font-extrabold text-[#1F1610]">Per-Editor Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#CBBFA8]">
                <th className="py-3 px-4 font-bold text-[#4A3E34]">Editor Name</th>
                <th className="py-3 px-4 font-bold text-[#4A3E34]">Amount Payable</th>
                <th className="py-3 px-4 font-bold text-[#4A3E34]">Completed Projects</th>
                <th className="py-3 px-4 font-bold text-[#4A3E34]">Pending Payments</th>
              </tr>
            </thead>
            <tbody>
              {metrics.editorBreakdowns.filter(b => b.completedProjectsCount > 0).map(editor => (
                <tr key={editor.editorId} className="border-b border-[rgba(135,120,108,0.25)] hover:bg-[rgba(255,255,255,0.2)]">
                  <td className="py-3 px-4 font-extrabold text-[#1F1610]">{editor.editorName}</td>
                  <td className="py-3 px-4 font-bold">{displayCurrency === 'INR' ? formatEditorCurrency(editor.amountPayable) : formatCurrency(editor.amountPayable / rate)}</td>
                  <td className="py-3 px-4 font-bold">{editor.completedProjectsCount}</td>
                  <td className="py-3 px-4 text-[#EF4444] font-extrabold">
                    {displayCurrency === 'INR' ? formatEditorCurrency(editor.pendingPaymentsAmount) : formatCurrency(editor.pendingPaymentsAmount / rate)}
                  </td>
                </tr>
              ))}
              {metrics.editorBreakdowns.filter(b => b.completedProjectsCount > 0).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[#4A3E34] font-semibold">No editor data matches the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
