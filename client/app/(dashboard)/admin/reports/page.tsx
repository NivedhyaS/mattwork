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
import { formatCurrency, formatEditorCurrency } from '@/lib/utils';

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
    <div className="space-y-8 bg-[#F6EFE9] text-[#3D2E24] p-1">
      {/* Page Header */}
      <div>
        <h1 className="text-[36px] font-extrabold tracking-tight text-[#3D2E24] leading-tight">
          Reports & Exports
        </h1>
        <p className="text-[16px] mt-1 text-[#7C6A5A]">
          Generate, preview, and download custom financial and performance reports.
        </p>
      </div>

      {/* ── Filters & Options ─────────────────────────────────────────────────── */}
      <div className="p-6 bg-[#F6EFE9] rounded-3xl shadow-[-8px_-8px_16px_rgba(255,255,255,0.9),8px_8px_16px_rgba(206,187,172,0.65)] space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Report Type */}
          <div>
            <label className="block text-[12px] font-extrabold text-[#8C7769] uppercase tracking-wider mb-1.5">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="w-full h-11 px-4 bg-[#F6EFE9] text-[#3D2E24] font-semibold border-0 rounded-2xl text-sm shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] cursor-pointer"
            >
              <option value="revenue">Revenue Report</option>
              <option value="editor-payments">Editor Payouts</option>
              <option value="client-utilization">Client Utilization</option>
              <option value="profit">Margin Analysis</option>
            </select>
          </div>

          {/* Target Month */}
          <div>
            <label className="block text-[12px] font-extrabold text-[#8C7769] uppercase tracking-wider mb-1.5">
              Target Month
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full h-11 px-4 bg-[#F6EFE9] text-[#3D2E24] font-semibold border-0 rounded-2xl text-sm shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)]"
            />
          </div>

          {/* Optional Client Filter */}
          {['revenue', 'client-utilization'].includes(reportType) && (
            <div>
              <label className="block text-[12px] font-extrabold text-[#8C7769] uppercase tracking-wider mb-1.5">
                Filter Client
              </label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full h-11 px-4 bg-[#F6EFE9] text-[#3D2E24] font-semibold border-0 rounded-2xl text-sm shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] cursor-pointer"
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
              <label className="block text-[12px] font-extrabold text-[#8C7769] uppercase tracking-wider mb-1.5">
                Filter Editor
              </label>
              <select
                value={selectedEditor}
                onChange={(e) => setSelectedEditor(e.target.value)}
                className="w-full h-11 px-4 bg-[#F6EFE9] text-[#3D2E24] font-semibold border-0 rounded-2xl text-sm shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] cursor-pointer"
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
      </div>

      {/* ── Report Preview / Content ─────────────────────────────────────────── */}
      <div className="p-6 bg-[#F6EFE9] rounded-3xl shadow-[-8px_-8px_16px_rgba(255,255,255,0.9),8px_8px_16px_rgba(206,187,172,0.65)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[rgba(206,187,172,0.3)]">
          <div>
            <h2 className="text-[20px] font-extrabold capitalize text-[#3D2E24]">
              {reportType.replace('-', ' ')} Report Preview
            </h2>
            <p className="text-sm text-[#7C6A5A] mt-1">
              Data view for the period of {selectedMonth}.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleExport('excel')}
              disabled={isExporting || isFetchingReport || !report}
              className="flex items-center gap-2 px-5 py-2.5 text-[14px] font-extrabold bg-[#F6EFE9] text-[#10B981] rounded-2xl shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(206,187,172,0.6)] hover:shadow-[-6px_-6px_12px_rgba(255,255,255,0.95),6px_6px_12px_rgba(201,180,163,0.7)] active:shadow-[inset_3px_3px_6px_rgba(206,187,172,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] transition-all disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet size={16} /> Export Excel
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={isExporting || isFetchingReport || !report}
              className="flex items-center gap-2 px-5 py-2.5 text-[14px] font-extrabold bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white rounded-2xl shadow-[-4px_-4px_10px_rgba(255,255,255,0.7),4px_4px_12px_rgba(234,88,12,0.4)] hover:shadow-[-6px_-6px_14px_rgba(255,255,255,0.8),6px_6px_16px_rgba(234,88,12,0.5)] transition-all disabled:opacity-50 cursor-pointer"
            >
              <FileText size={16} /> Export PDF
            </button>
          </div>
        </div>

        <div>
          {isFetchingReport ? (
            <div className="flex h-64 items-center justify-center text-[#7C6A5A] font-bold">
              Generating report preview...
            </div>
          ) : !report ? (
            <div className="flex h-64 items-center justify-center text-[#7C6A5A] font-bold">
              No report data found for this period.
            </div>
          ) : (
            <div>
              {/* Summary Statistics Card Grid */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
                {reportType === 'revenue' && (
                  <div className="p-6 bg-[#F6EFE9] rounded-3xl shadow-[-6px_-6px_12px_rgba(255,255,255,0.9),6px_6px_12px_rgba(206,187,172,0.6)] space-y-2">
                    <div className="text-[12px] font-extrabold text-[#8C7769] uppercase tracking-wider">Total Revenue</div>
                    <div className="text-[32px] font-extrabold text-[#EA580C]">
                      {formatCurrency(report.totalRevenue || 0)}
                    </div>
                  </div>
                )}

                {reportType === 'editor-payments' && (
                  <div className="p-6 bg-[#F6EFE9] rounded-3xl shadow-[-6px_-6px_12px_rgba(255,255,255,0.9),6px_6px_12px_rgba(206,187,172,0.6)] space-y-2">
                    <div className="text-[12px] font-extrabold text-[#8C7769] uppercase tracking-wider">Total Editor Payouts</div>
                    <div className="text-[32px] font-extrabold text-[#3D2E24]">
                      {formatEditorCurrency(report.totalPayout || 0)}
                    </div>
                  </div>
                )}

                {reportType === 'profit' && (
                  <>
                    <div className="p-6 bg-[#F6EFE9] rounded-3xl shadow-[-6px_-6px_12px_rgba(255,255,255,0.9),6px_6px_12px_rgba(206,187,172,0.6)] space-y-2">
                      <div className="text-[12px] font-extrabold text-[#8C7769] uppercase tracking-wider">Gross Billings</div>
                      <div className="text-[32px] font-extrabold text-[#3D2E24]">
                        {formatCurrency(report.marginReport?.revenue || 0)}
                      </div>
                    </div>
                    <div className="p-6 bg-[#F6EFE9] rounded-3xl shadow-[-6px_-6px_12px_rgba(255,255,255,0.9),6px_6px_12px_rgba(206,187,172,0.6)] space-y-2">
                      <div className="text-[12px] font-extrabold text-[#8C7769] uppercase tracking-wider">Total Editor Cost</div>
                      <div className="text-[32px] font-extrabold text-[#7C6A5A]">
                        {formatCurrency(report.marginReport?.editorCosts || 0)}
                      </div>
                    </div>
                    <div className="p-6 bg-[#F6EFE9] rounded-3xl shadow-[-6px_-6px_12px_rgba(255,255,255,0.9),6px_6px_12px_rgba(206,187,172,0.6)] space-y-2">
                      <div className="text-[12px] font-extrabold text-[#8C7769] uppercase tracking-wider">Net Margin</div>
                      <div className="text-[32px] font-extrabold text-[#10B981] flex items-baseline gap-3">
                        {formatCurrency(report.marginReport?.netMargin || 0)}
                        <span className="text-sm font-bold text-[#8C7769]">
                          {report.marginReport?.revenue > 0 ? ((report.marginReport.netMargin / report.marginReport.revenue) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Data Table Container */}
              <div className="overflow-x-auto rounded-3xl shadow-[inset_3px_3px_6px_rgba(206,187,172,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] p-2 bg-[#F6EFE9]">
                {reportType === 'revenue' && (
                  <table className="w-full text-left border-collapse text-[15px]">
                    <thead>
                      <tr className="border-b border-[rgba(206,187,172,0.3)] bg-[#F6EFE9]">
                        <th className="p-4 font-extrabold text-[#8C7769] uppercase tracking-wider">Client Name</th>
                        <th className="p-4 font-extrabold text-[#8C7769] uppercase tracking-wider">Company</th>
                        <th className="p-4 font-extrabold text-[#8C7769] uppercase tracking-wider text-center">Completed Videos</th>
                        <th className="p-4 font-extrabold text-[#8C7769] uppercase tracking-wider text-right">Revenue (USD)</th>
                        <th className="p-4 font-extrabold text-[#8C7769] uppercase tracking-wider text-right">Advance Received</th>
                        <th className="p-4 font-extrabold text-[#8C7769] uppercase tracking-wider text-right">Remaining Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(206,187,172,0.2)]">
                      {getFilteredRevenueData().map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[rgba(234,88,12,0.04)] transition-colors">
                          <td className="p-4 font-extrabold text-[#3D2E24]">{item.clientName}</td>
                          <td className="p-4 font-semibold text-[#7C6A5A]">{item.company || '—'}</td>
                          <td className="p-4 text-center font-extrabold text-[#3D2E24]">{item.completedVideos || 0}</td>
                          <td className="p-4 text-right font-extrabold text-[#EA580C]">{formatCurrency(item.totalRevenue)}</td>
                          <td className="p-4 text-right font-extrabold text-[#3D2E24]">{formatCurrency(item.advanceReceived || 0)}</td>
                          <td className={`p-4 text-right font-extrabold ${(item.remainingCredit || 0) <= 0 ? 'text-[#8C7769]' : 'text-[#10B981]'}`}>{formatCurrency(item.remainingCredit || 0)}</td>
                        </tr>
                      ))}
                      {getFilteredRevenueData().length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-[#7C6A5A] font-bold">No records found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {reportType === 'editor-payments' && (
                  <table className="w-full text-left border-collapse text-[15px]">
                    <thead>
                      <tr className="border-b border-[rgba(206,187,172,0.3)] bg-[#F6EFE9]">
                        <th className="p-4 font-extrabold text-[#8C7769] uppercase tracking-wider">Editor Name</th>
                        <th className="p-4 font-extrabold text-[#8C7769] uppercase tracking-wider text-center">Completed Projects</th>
                        <th className="p-4 font-extrabold text-[#8C7769] uppercase tracking-wider text-center">Pending Payments</th>
                        <th className="p-4 font-extrabold text-[#8C7769] uppercase tracking-wider text-right">Amount Payable (INR)</th>
                        <th className="p-4 font-extrabold text-[#8C7769] uppercase tracking-wider text-right">Total Payout (INR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(206,187,172,0.2)]">
                      {getFilteredEditorData().map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[rgba(234,88,12,0.04)] transition-colors">
                          <td className="p-4 font-extrabold text-[#3D2E24]">{item.editorName}</td>
                          <td className="p-4 text-center font-extrabold text-[#3D2E24]">{item.completedCount}</td>
                          <td className="p-4 text-center font-extrabold text-[#EA580C]">{item.pendingPayments || 0}</td>
                          <td className="p-4 text-right font-extrabold text-[#EA580C]">{formatEditorCurrency(item.amountPayable || 0)}</td>
                          <td className="p-4 text-right font-extrabold text-[#10B981]">{formatEditorCurrency(item.totalPayout)}</td>
                        </tr>
                      ))}
                      {getFilteredEditorData().length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-[#7C6A5A] font-bold">No records found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {reportType === 'client-utilization' && (
                  <table className="w-full text-left border-collapse text-[15px]">
                    <thead>
                      <tr className="border-b border-[rgba(206,187,172,0.3)] bg-[#F6EFE9]">
                        <th className="p-4 font-extrabold text-[#8C7769] uppercase tracking-wider">Client Name</th>
                        <th className="p-4 font-extrabold text-[#8C7769] uppercase tracking-wider">Company</th>
                        <th className="p-4 font-extrabold text-[#8C7769] uppercase tracking-wider text-center">Submitted</th>
                        <th className="p-4 font-extrabold text-[#8C7769] uppercase tracking-wider text-center">Completed</th>
                        <th className="p-4 font-extrabold text-[#8C7769] uppercase tracking-wider text-center">Avg Turnaround</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(206,187,172,0.2)]">
                      {getFilteredUtilizationData().map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[rgba(234,88,12,0.04)] transition-colors">
                          <td className="p-4 font-extrabold text-[#3D2E24]">{item.clientName}</td>
                          <td className="p-4 font-semibold text-[#7C6A5A]">{item.company || '—'}</td>
                          <td className="p-4 text-center font-extrabold text-[#3D2E24]">{item.projectsSubmitted}</td>
                          <td className="p-4 text-center font-extrabold text-[#10B981]">{item.projectsCompleted}</td>
                          <td className="p-4 text-center font-semibold text-[#7C6A5A]">
                            {item.avgTurnaroundDays !== null ? `${item.avgTurnaroundDays} days` : '—'}
                          </td>
                        </tr>
                      ))}
                      {getFilteredUtilizationData().length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-[#7C6A5A] font-bold">No records found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {reportType === 'profit' && (
                  <table className="w-full text-left border-collapse text-[15px]">
                    <thead>
                      <tr className="border-b border-[rgba(206,187,172,0.3)] bg-[#F6EFE9]">
                        <th className="p-4 font-extrabold text-[#8C7769] uppercase tracking-wider">Metric</th>
                        <th className="p-4 font-extrabold text-[#8C7769] uppercase tracking-wider text-right">Value (USD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(206,187,172,0.2)]">
                      <tr>
                        <td className="p-4 font-extrabold text-[#3D2E24]">Gross Revenue</td>
                        <td className="p-4 text-right font-extrabold text-[#3D2E24]">
                          {formatCurrency(report.marginReport?.revenue || 0)}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-4 font-extrabold text-[#3D2E24]">Total Editor Cost</td>
                        <td className="p-4 text-right font-extrabold text-[#7C6A5A]">
                          {formatCurrency(report.marginReport?.editorCosts || 0)}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-4 font-extrabold text-[#10B981]">Net Margin</td>
                        <td className="p-4 text-right font-extrabold text-[#10B981]">
                          {formatCurrency(report.marginReport?.netMargin || 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
