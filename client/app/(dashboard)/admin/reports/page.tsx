'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  Users,
  TrendingUp,
  Receipt,
  Hourglass,
  Layers,
  CircleCheck,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function ReportsPage() {
  const [reportType, setReportType] = useState<'revenue' | 'editor-payments' | 'client-utilization' | 'profit'>('revenue');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return new Date().toISOString().substring(0, 7); // Default to current month "YYYY-MM"
  });
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedEditor, setSelectedEditor] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: reportData, isFetching: isFetchingReport } = useQuery({
    queryKey: ['admin-report', reportType, selectedMonth],
    queryFn: async () => {
      const res = await api.get(`/reports/${reportType}`, {
        params: { month: selectedMonth },
      });
      return res.data;
    },
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const res = await api.get('/clients?limit=1000');
      return res.data;
    },
  });

  const { data: editorsData } = useQuery({
    queryKey: ['editors-list'],
    queryFn: async () => {
      const res = await api.get('/editors?limit=1000');
      return res.data;
    },
  });

  const clients = clientsData?.data || [];
  const editors = editorsData?.data || [];

  // ── Export Handler ────────────────────────────────────────────────────────
  const handleExport = async (format: 'excel' | 'pdf') => {
    setIsExporting(true);
    try {
      const res = await api.get(`/reports/${reportType}`, {
        params: {
          month: selectedMonth,
          format,
        },
        responseType: 'blob',
      });

      const contentType = format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const fileExtension = format === 'pdf' ? 'pdf' : 'xlsx';

      const blob = new Blob([res.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `${reportType}_report_${selectedMonth}.${fileExtension}`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export report:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const report = reportData?.data || null;

  // ── Client-side filtering of preview tables ──────────────────────────────
  const getFilteredRevenueData = () => {
    if (!report?.clientBreakdown) return [];
    return report.clientBreakdown.filter((item: any) => {
      if (selectedClient && item.clientId !== selectedClient) return false;
      return true;
    });
  };

  const getFilteredEditorData = () => {
    if (!report?.editorPayments) return [];
    return report.editorPayments.filter((item: any) => {
      if (selectedEditor && item.editorId !== selectedEditor) return false;
      return true;
    });
  };

  const getFilteredUtilizationData = () => {
    if (!report?.clientUtilization) return [];
    return report.clientUtilization.filter((item: any) => {
      if (selectedClient && item.clientId !== selectedClient) return false;
      return true;
    });
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-[36px] font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
          Reports & Exports
        </h1>
        <p className="text-[16px] mt-2 text-slate-500 dark:text-slate-450">
          Generate, preview, and download custom financial and performance reports.
        </p>
      </div>

      {/* ── Filters & Options ─────────────────────────────────────────────────── */}
      <Card className="shadow-none border border-slate-200 dark:border-slate-800 bg-card">
        <CardContent className="p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Report Type */}
            <div>
              <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Report Type
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as any)}
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[15px]"
              >
                <option value="revenue">Revenue Report</option>
                <option value="editor-payments">Editor Payouts</option>
                <option value="client-utilization">Client Utilization</option>
                <option value="profit">Profitability Analysis</option>
              </select>
            </div>

            {/* Target Month */}
            <div>
              <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Target Month
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[15px]"
              />
            </div>

            {/* Optional Client Filter */}
            {['revenue', 'client-utilization'].includes(reportType) && (
              <div>
                <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Filter Client
                </label>
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
            )}

            {/* Optional Editor Filter */}
            {reportType === 'editor-payments' && (
              <div>
                <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Filter Editor
                </label>
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
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Report Preview / Content ─────────────────────────────────────────── */}
      <Card className="shadow-none border border-slate-200 dark:border-slate-800 bg-card">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <CardTitle className="text-[18px] font-bold capitalize text-slate-900 dark:text-white">
              {reportType.replace('-', ' ')} Report Preview
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              Data view for the period of {selectedMonth}.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleExport('excel')}
              disabled={isExporting || isFetchingReport || !report}
              className="flex items-center gap-2 px-4 py-2 text-[15px] font-semibold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet size={16} /> Export Excel
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={isExporting || isFetchingReport || !report}
              className="flex items-center gap-2 px-4 py-2 text-[15px] font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              <FileText size={16} /> Export PDF
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isFetchingReport ? (
            <div className="flex h-64 items-center justify-center text-slate-400">
              Generating report preview...
            </div>
          ) : !report ? (
            <div className="flex h-64 items-center justify-center text-slate-400">
              No report data found for this period.
            </div>
          ) : (
            <div className="p-6">
              {/* Summary Statistics Card Grid */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
                {reportType === 'revenue' && (
                  <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
                    <div className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">Total Revenue</div>
                    <div className="text-[28px] font-extrabold text-emerald-500 mt-1">
                      {formatCurrency(report.totalRevenue || 0)}
                    </div>
                  </div>
                )}

                {reportType === 'editor-payments' && (
                  <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
                    <div className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">Total Editor Payouts</div>
                    <div className="text-[28px] font-extrabold text-slate-950 dark:text-white mt-1">
                      {formatCurrency(report.totalPayout || 0)}
                    </div>
                  </div>
                )}

                {reportType === 'profit' && (
                  <>
                    <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
                      <div className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">Gross Billings</div>
                      <div className="text-[28px] font-extrabold text-slate-950 dark:text-white mt-1">
                        {formatCurrency(report.profitReport?.revenue || 0)}
                      </div>
                    </div>
                    <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
                      <div className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">Total Editor Costs</div>
                      <div className="text-[28px] font-extrabold text-slate-500 mt-1">
                        {formatCurrency(report.profitReport?.editorCosts || 0)}
                      </div>
                    </div>
                    <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
                      <div className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">Net Profit</div>
                      <div className="text-[28px] font-extrabold text-emerald-500 mt-1">
                        {formatCurrency(report.profitReport?.profit || 0)}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                {reportType === 'revenue' && (
                  <table className="w-full text-left border-collapse text-[15px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                        <th className="p-4 font-bold text-slate-500 uppercase tracking-wider">Client Name</th>
                        <th className="p-4 font-bold text-slate-500 uppercase tracking-wider">Company</th>
                        <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-right">Revenue (INR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredRevenueData().map((item: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/50">
                          <td className="p-4 font-medium text-slate-900 dark:text-white">{item.clientName}</td>
                          <td className="p-4 text-slate-500">{item.company || '—'}</td>
                          <td className="p-4 text-right font-medium text-emerald-500">{formatCurrency(item.totalRevenue)}</td>
                        </tr>
                      ))}
                      {getFilteredRevenueData().length === 0 && (
                        <tr>
                          <td colSpan={3} className="p-8 text-center text-slate-400">No records found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {reportType === 'editor-payments' && (
                  <table className="w-full text-left border-collapse text-[15px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                        <th className="p-4 font-bold text-slate-500 uppercase tracking-wider">Editor Name</th>
                        <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-center">Completed Count</th>
                        <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-right">Avg Rate (INR)</th>
                        <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-right">Total Payout (INR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredEditorData().map((item: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/50">
                          <td className="p-4 font-medium text-slate-900 dark:text-white">{item.editorName}</td>
                          <td className="p-4 text-center font-semibold text-slate-600 dark:text-slate-400">{item.completedCount}</td>
                          <td className="p-4 text-right text-slate-500">{formatCurrency(item.averageRate || 0)}</td>
                          <td className="p-4 text-right font-medium text-emerald-500">{formatCurrency(item.totalPayout)}</td>
                        </tr>
                      ))}
                      {getFilteredEditorData().length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-400">No records found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {reportType === 'client-utilization' && (
                  <table className="w-full text-left border-collapse text-[15px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                        <th className="p-4 font-bold text-slate-500 uppercase tracking-wider">Client Name</th>
                        <th className="p-4 font-bold text-slate-500 uppercase tracking-wider">Company</th>
                        <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-center">Submitted</th>
                        <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-center">Completed</th>
                        <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-center">Avg Turnaround</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredUtilizationData().map((item: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/50">
                          <td className="p-4 font-medium text-slate-900 dark:text-white">{item.clientName}</td>
                          <td className="p-4 text-slate-500">{item.company || '—'}</td>
                          <td className="p-4 text-center font-semibold text-slate-650">{item.projectsSubmitted}</td>
                          <td className="p-4 text-center font-semibold text-emerald-500">{item.projectsCompleted}</td>
                          <td className="p-4 text-center text-slate-500">
                            {item.avgTurnaroundDays !== null ? `${item.avgTurnaroundDays} days` : '—'}
                          </td>
                        </tr>
                      ))}
                      {getFilteredUtilizationData().length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400">No records found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {reportType === 'profit' && (
                  <table className="w-full text-left border-collapse text-[15px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                        <th className="p-4 font-bold text-slate-500 uppercase tracking-wider">Metric</th>
                        <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-right">Value (INR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100 dark:border-slate-850">
                        <td className="p-4 font-medium text-slate-700 dark:text-slate-350">Gross Revenue</td>
                        <td className="p-4 text-right font-medium text-slate-900 dark:text-white">
                          {formatCurrency(report.profitReport?.revenue || 0)}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-850">
                        <td className="p-4 font-medium text-slate-700 dark:text-slate-350">Total Editor Costs</td>
                        <td className="p-4 text-right font-medium text-slate-900 dark:text-white">
                          {formatCurrency(report.profitReport?.editorCosts || 0)}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-850 bg-emerald-500/5">
                        <td className="p-4 font-bold text-emerald-600 dark:text-emerald-450">Net Profit</td>
                        <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-450">
                          {formatCurrency(report.profitReport?.profit || 0)}
                        </td>
                      </tr>
                      {report.profitReport?.profitChangeAbsolute !== null && (
                        <>
                          <tr className="border-b border-slate-100 dark:border-slate-850">
                            <td className="p-4 font-medium text-slate-700 dark:text-slate-350">Prior Month Profit</td>
                            <td className="p-4 text-right text-slate-500">
                              {formatCurrency(report.profitReport?.priorMonthProfit || 0)}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-100 dark:border-slate-850">
                            <td className="p-4 font-medium text-slate-700 dark:text-slate-350">Profit Change (Absolute)</td>
                            <td className={`p-4 text-right font-semibold ${
                              report.profitReport?.profitChangeAbsolute >= 0 ? 'text-emerald-500' : 'text-rose-500'
                            }`}>
                              {report.profitReport?.profitChangeAbsolute >= 0 ? '+' : ''}
                              {formatCurrency(report.profitReport?.profitChangeAbsolute || 0)}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-100 dark:border-slate-850">
                            <td className="p-4 font-medium text-slate-700 dark:text-slate-350">Profit Change (Percentage)</td>
                            <td className={`p-4 text-right font-semibold ${
                              report.profitReport?.profitChangePercentage >= 0 ? 'text-emerald-500' : 'text-rose-500'
                            }`}>
                              {report.profitReport?.profitChangePercentage >= 0 ? '+' : ''}
                              {report.profitReport?.profitChangePercentage || 0}%
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
