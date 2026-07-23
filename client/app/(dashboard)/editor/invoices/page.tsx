'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import {
  FileText,
  Download,
  Loader2,
  AlertCircle,
  Calendar,
  CheckCircle2,
  DollarSign,
  Eye,
  Mail,
  AlertTriangle,
  CreditCard,
  Building2,
  UserCheck,
  Percent,
  PlusCircle,
  Clock,
  History,
  Sparkles,
  X,
  Check,
  ShieldCheck,
  TrendingUp,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { formatEditorCurrency } from '@/lib/utils';
import Button from '@/components/ui/button';

interface Project {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  editorPrice?: number | string | null;
}

interface StatementHistoryItem {
  id: string;
  statementNo: string;
  period: string;
  dateCompiled: string;
  deliverablesCount: number;
  subtotal: number;
  netTotal: number;
  status: 'PAID' | 'PROCESSING' | 'PENDING';
  txnId?: string;
  payoutDate?: string;
}

export default function EditorInvoicesPage() {
  const [completedProjects, setCompletedProjects] = useState<Project[]>([]);
  const [allCompletedProjects, setAllCompletedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratePerVideo, setRatePerVideo] = useState(500);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Selection & Config state
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [editorName, setEditorName] = useState('Test Editor');
  const [paymentAccount, setPaymentAccount] = useState('UPI: editor@upi / HDFC 50100987654321');
  const [panNumber, setPanNumber] = useState('ABCDE1234F');
  const [currency, setCurrency] = useState('INR');
  const [bonusAmount, setBonusAmount] = useState<number | string>(0);
  const [tdsRate, setTdsRate] = useState<number>(0); // e.g. 0% or 10%

  // Modals & Tabs state
  const [activeTab, setActiveTab] = useState<'generator' | 'history'>('generator');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [disputeModalItem, setDisputeModalItem] = useState<Project | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeSuccessMsg, setDisputeSuccessMsg] = useState<string | null>(null);

  // Statement History Mock Data
  const [statementHistory, setStatementHistory] = useState<StatementHistoryItem[]>([
    {
      id: 'stmt-1',
      statementNo: 'EDR-8ZI4-0001',
      period: 'July 2026',
      dateCompiled: '23 Jul 2026',
      deliverablesCount: 3,
      subtotal: 1500,
      netTotal: 1500,
      status: 'PAID',
      txnId: 'TXN9845720193',
      payoutDate: '23 Jul 2026'
    },
    {
      id: 'stmt-2',
      statementNo: 'EDR-8ZI4-0002',
      period: 'June 2026',
      dateCompiled: '30 Jun 2026',
      deliverablesCount: 5,
      subtotal: 2500,
      netTotal: 2500,
      status: 'PAID',
      txnId: 'TXN8734190512',
      payoutDate: '01 Jul 2026'
    },
    {
      id: 'stmt-3',
      statementNo: 'EDR-8ZI4-0003',
      period: 'May 2026',
      dateCompiled: '31 May 2026',
      deliverablesCount: 4,
      subtotal: 2000,
      netTotal: 2000,
      status: 'PAID',
      txnId: 'TXN7612984301',
      payoutDate: '02 Jun 2026'
    }
  ]);

  // Last 6 months list
  const months = useMemo(() => {
    const list: string[] = [];
    const date = new Date();
    for (let i = 0; i < 6; i++) {
      const mStr = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      list.push(mStr);
      date.setMonth(date.getMonth() - 1);
    }
    return list;
  }, []);

  useEffect(() => {
    if (months.length > 0) {
      setSelectedMonth(months[0]);
    }

    Promise.all([
      api.get('/projects?limit=100'),
      api.get('/editors/me'),
    ])
      .then(([projectsRes, editorRes]) => {
        const data: Project[] = projectsRes.data.data;
        const uploaded = data.filter((p) => p.status === 'UPLOADED');
        setAllCompletedProjects(uploaded);
        setCompletedProjects(uploaded);
        setSelectedProjectIds(uploaded.map((p) => p.id));

        const profile = editorRes.data.data;
        if (profile?.user?.name) {
          setEditorName(profile.user.name);
        }
        if (profile?.hourlyRate) {
          setRatePerVideo(Number(profile.hourlyRate));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [months]);

  // Filter completed deliverables whenever target month changes
  useEffect(() => {
    if (!selectedMonth) return;
    const parts = selectedMonth.split(' ');
    if (parts.length === 2) {
      const monthName = parts[0];
      const year = parseInt(parts[1], 10);
      const filtered = allCompletedProjects.filter((p) => {
        const d = new Date(p.updatedAt);
        return (
          d.toLocaleString('default', { month: 'long' }) === monthName &&
          d.getFullYear() === year
        );
      });
      setCompletedProjects(filtered.length > 0 ? filtered : allCompletedProjects);
      setSelectedProjectIds((filtered.length > 0 ? filtered : allCompletedProjects).map((p) => p.id));
    }
  }, [selectedMonth, allCompletedProjects]);

  // Live Calculations
  const selectedProjects = useMemo(() => {
    return completedProjects.filter((p) => selectedProjectIds.includes(p.id));
  }, [completedProjects, selectedProjectIds]);

  const subtotal = useMemo(() => {
    return selectedProjects.reduce((sum, p) => {
      const r = p.editorPrice != null ? Number(p.editorPrice) : ratePerVideo;
      return sum + r;
    }, 0);
  }, [selectedProjects, ratePerVideo]);

  const numBonus = Number(bonusAmount || 0);
  const tdsDeduction = (subtotal * tdsRate) / 100;
  const netPayable = Math.max(0, subtotal + numBonus - tdsDeduction);

  const lifetimeTotal = useMemo(() => {
    return allCompletedProjects.reduce((sum, p) => {
      return sum + (p.editorPrice != null ? Number(p.editorPrice) : ratePerVideo);
    }, 0);
  }, [allCompletedProjects, ratePerVideo]);

  // Toggle Checkbox handlers
  const toggleSelectAll = () => {
    if (selectedProjectIds.length === completedProjects.length) {
      setSelectedProjectIds([]);
    } else {
      setSelectedProjectIds(completedProjects.map((p) => p.id));
    }
  };

  const toggleSelectProject = (id: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  // PDF Generator API call
  const generatePdfBlob = async (): Promise<Blob> => {
    const payload = {
      month: selectedMonth,
      projectIds: selectedProjectIds,
      editorName,
      paymentDetails: `${paymentAccount} | PAN: ${panNumber}`,
      bonusAmount: numBonus,
      tdsRate,
      currency
    };

    const response = await api.post('/invoices/editor/pdf', payload, {
      responseType: 'blob'
    });
    return new Blob([response.data], { type: 'application/pdf' });
  };

  const handleDownloadPdf = async () => {
    if (selectedProjectIds.length === 0) {
      alert('Please select at least one completed deliverable to compile a payout statement.');
      return;
    }
    setIsGenerating(true);
    try {
      const blob = await generatePdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `editor_payout_${selectedMonth.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download failed:', err);
      alert('Failed to generate payout PDF.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreviewPdf = async () => {
    if (selectedProjectIds.length === 0) {
      alert('Please select at least one completed deliverable to preview.');
      return;
    }
    setIsGenerating(true);
    try {
      const blob = await generatePdfBlob();
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
      setPreviewModalOpen(true);
    } catch (err) {
      console.error('Preview failed:', err);
      alert('Failed to render PDF preview.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeModalItem || !disputeReason.trim()) return;
    setDisputeSubmitting(true);
    try {
      await api.post('/invoices/editor/dispute', {
        projectId: disputeModalItem.id,
        reason: disputeReason
      });
      setDisputeSuccessMsg(`Dispute registered for "${disputeModalItem.title}". Ticket opened.`);
      setTimeout(() => {
        setDisputeModalItem(null);
        setDisputeReason('');
        setDisputeSuccessMsg(null);
      }, 3000);
    } catch (err) {
      console.error('Dispute failed:', err);
      alert('Failed to submit dispute ticket.');
    } finally {
      setDisputeSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* 1. Header Section & Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <FileText className="h-8 w-8 text-accent" />
            Editor Payout Statements
          </h1>
          <p className="text-[15px] text-slate-500 dark:text-slate-400 mt-1">
            Compile monthly earnings statements, customize payout accounts, and manage official PDF records.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('generator')}
            className={`flex items-center gap-2 px-4 py-2 text-[14px] font-bold rounded-lg transition-all ${
              activeTab === 'generator'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-4 w-4 text-accent" />
            Compile Statement
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 text-[14px] font-bold rounded-lg transition-all ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <History className="h-4 w-4 text-accent" />
            Statement History
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="flat-card bg-card p-5 border border-border space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">This Month's Earnings</span>
            <Calendar className="h-4 w-4 text-accent" />
          </div>
          <p className="text-[26px] font-extrabold text-slate-900 dark:text-white">
            {formatEditorCurrency(subtotal)}
          </p>
          <p className="text-[12px] text-slate-500">
            From {selectedProjects.length} selected deliverable(s) in {selectedMonth}
          </p>
        </div>

        <div className="flat-card bg-card p-5 border border-border space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">Lifetime Earnings</span>
            <TrendingUp className="h-4 w-4 text-status-green" />
          </div>
          <p className="text-[26px] font-extrabold text-slate-900 dark:text-white">
            {formatEditorCurrency(lifetimeTotal)}
          </p>
          <p className="text-[12px] text-slate-500">
            Across {allCompletedProjects.length} total completed video deliverables
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 flat-card bg-card border border-border">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      ) : activeTab === 'generator' ? (
        /* 3. Main Generator Two-Panel Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Compile Statement Config Card (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="flat-card bg-card p-6 border border-border space-y-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h3 className="font-extrabold text-[16px] text-slate-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-accent" />
                  Compile Statement
                </h3>
                <span className="text-[11px] font-bold text-accent bg-accent/10 px-2.5 py-1 rounded-full uppercase">
                  Live Sync
                </span>
              </div>

              {/* Target Month Selector */}
              <div className="space-y-2">
                <label className="text-[12px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">
                  Target Month / Period
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full text-[14px] font-semibold border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent focus:outline-none"
                >
                  {months.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Editor Details (Confirmable) */}
              <div className="space-y-4 pt-2 border-t border-border">
                <span className="text-[12px] text-slate-400 font-bold uppercase tracking-wider block">
                  Payee Information
                </span>

                <div className="space-y-1.5">
                  <label className="text-[12px] text-slate-500 font-medium">Billed To Name</label>
                  <input
                    type="text"
                    value={editorName}
                    onChange={(e) => setEditorName(e.target.value)}
                    className="w-full text-[13px] border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] text-slate-500 font-medium">UPI / Bank Account</label>
                  <input
                    type="text"
                    value={paymentAccount}
                    onChange={(e) => setPaymentAccount(e.target.value)}
                    className="w-full text-[13px] border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[12px] text-slate-500 font-medium">PAN / Tax ID</label>
                    <input
                      type="text"
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value)}
                      className="w-full text-[13px] border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] text-slate-500 font-medium">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full text-[13px] border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Live Calculation Ticker Box */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-border space-y-2">
                <div className="flex justify-between text-[13px] text-slate-500">
                  <span>Selected Items Subtotal:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatEditorCurrency(subtotal)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between items-center">
                  <span className="text-[14px] font-extrabold text-slate-900 dark:text-white">Net Payout:</span>
                  <span className="text-[20px] font-extrabold text-accent">{formatEditorCurrency(netPayable)}</span>
                </div>
              </div>

              {/* Action Buttons Stack */}
              <div className="space-y-2.5 pt-2">
                <Button
                  onClick={handleDownloadPdf}
                  disabled={isGenerating}
                  className="w-full flex items-center justify-center gap-2 bg-accent text-white font-bold py-3 cursor-pointer shadow-sm hover:opacity-90 transition-all"
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download Payout PDF
                </Button>

                <Button
                  onClick={handlePreviewPdf}
                  disabled={isGenerating}
                  variant="outline"
                  className="w-full flex items-center justify-center gap-1.5 font-bold text-[13px]"
                >
                  <Eye className="h-4 w-4" />
                  Preview Payout PDF
                </Button>
              </div>
            </div>
          </div>

          {/* Right Panel: Line Items Table (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flat-card bg-card p-6 border border-border space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <h3 className="font-extrabold text-[16px] text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-status-green" />
                    Completed Deliverables Line Items
                  </h3>
                  <p className="text-[13px] text-slate-500 mt-0.5">
                    Check or uncheck deliverables to include in this month's payout statement.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <label className="flex items-center gap-2 text-[13px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selectedProjectIds.length === completedProjects.length && completedProjects.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-accent focus:ring-accent h-4 w-4"
                    />
                    Select All ({completedProjects.length})
                  </label>
                </div>
              </div>

              {completedProjects.length === 0 ? (
                /* Empty State */
                <div className="text-center py-16 px-4 flat-card bg-slate-50/50 dark:bg-slate-900/20 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
                  <AlertCircle className="h-10 w-10 mx-auto mb-3 text-slate-400" />
                  <h4 className="font-bold text-[16px] text-slate-800 dark:text-slate-200">
                    No Completed Deliverables Found
                  </h4>
                  <p className="text-[14px] text-slate-500 max-w-md mx-auto mt-1">
                    There are no projects marked as completed ({'UPLOADED'}) for {selectedMonth}. Complete project tasks on your board to compile statements.
                  </p>
                </div>
              ) : (
                /* Line Items Table */
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-[12px] font-bold uppercase text-slate-400 tracking-wider">
                        <th className="py-3 px-3 w-10 text-center">Include</th>
                        <th className="py-3 px-3">Deliverable Name</th>
                        <th className="py-3 px-3 text-center">Completed Date</th>
                        <th className="py-3 px-3 text-right">Rate</th>
                        <th className="py-3 px-3 text-center">Qty</th>
                        <th className="py-3 px-3 text-right">Amount</th>
                        <th className="py-3 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-[14px]">
                      {completedProjects.map((proj) => {
                        const isChecked = selectedProjectIds.includes(proj.id);
                        const rateVal = proj.editorPrice != null ? Number(proj.editorPrice) : ratePerVideo;
                        return (
                          <tr
                            key={proj.id}
                            className={`transition-colors ${
                              isChecked
                                ? 'bg-slate-50/80 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                                : 'bg-slate-50/40 dark:bg-slate-950/40 opacity-60'
                            }`}
                          >
                            <td className="py-3.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectProject(proj.id)}
                                className="rounded border-slate-300 text-accent focus:ring-accent h-4 w-4 cursor-pointer"
                              />
                            </td>
                            <td className="py-3.5 px-3">
                              <p className="font-bold text-slate-900 dark:text-white line-clamp-1">
                                {proj.title}
                              </p>
                            </td>
                            <td className="py-3.5 px-3 text-center text-slate-500 font-medium whitespace-nowrap text-[13px]">
                              {new Date(proj.updatedAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </td>
                            <td className="py-3.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">
                              {formatEditorCurrency(rateVal)}
                            </td>
                            <td className="py-3.5 px-3 text-center font-bold text-slate-500">1</td>
                            <td className="py-3.5 px-3 text-right font-extrabold text-slate-900 dark:text-white">
                              {formatEditorCurrency(rateVal)}
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <button
                                onClick={() => setDisputeModalItem(proj)}
                                title="Raise a dispute / report issue for this deliverable"
                                className="inline-flex items-center gap-1 text-[12px] font-bold text-amber-600 dark:text-amber-400 hover:underline px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Dispute
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table Footer Totals Summary */}
              <div className="border-t border-border pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-xl">
                <div className="text-[13px] text-slate-500">
                  Showing <strong className="text-slate-800 dark:text-slate-200">{selectedProjects.length}</strong> of{' '}
                  <strong className="text-slate-800 dark:text-slate-200">{completedProjects.length}</strong> deliverables selected
                </div>

                <div className="flex items-center gap-6 text-right">
                  <div>
                    <span className="text-[12px] text-slate-400 block font-bold uppercase">Subtotal</span>
                    <span className="font-extrabold text-[16px] text-slate-900 dark:text-white">
                      {formatEditorCurrency(subtotal)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[12px] text-slate-400 block font-bold uppercase">Final Payout</span>
                    <span className="font-extrabold text-[20px] text-accent">
                      {formatEditorCurrency(netPayable)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 4. Statement History Tab */
        <div className="flat-card bg-card p-6 border border-border space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-extrabold text-[18px] text-slate-900 dark:text-white flex items-center gap-2">
                <History className="h-5 w-5 text-accent" />
                Compiled Statement History
              </h3>
              <p className="text-[13px] text-slate-500 mt-0.5">
                Review past monthly statements, payment statuses, and transaction details.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-[12px] font-bold uppercase text-slate-400 tracking-wider">
                  <th className="py-3 px-4">Statement No</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Date Compiled</th>
                  <th className="py-3 px-4 text-center">Deliverables</th>
                  <th className="py-3 px-4 text-right">Payout Total</th>
                  <th className="py-3 px-4 text-center">Payment Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-[14px]">
                {statementHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="py-4 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {item.statementNo}
                    </td>
                    <td className="py-4 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      {item.period}
                    </td>
                    <td className="py-4 px-4 text-slate-500 whitespace-nowrap text-[13px]">
                      {item.dateCompiled}
                    </td>
                    <td className="py-4 px-4 text-center font-bold text-slate-600 dark:text-slate-400">
                      {item.deliverablesCount} items
                    </td>
                    <td className="py-4 px-4 text-right font-extrabold text-slate-900 dark:text-white">
                      {formatEditorCurrency(item.netTotal)}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        {item.status === 'PAID' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck className="h-3.5 w-3.5" /> PAID
                          </span>
                        ) : item.status === 'PROCESSING' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            <Clock className="h-3.5 w-3.5" /> PROCESSING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <AlertCircle className="h-3.5 w-3.5" /> PENDING
                          </span>
                        )}
                        {item.txnId && (
                          <span className="text-[10px] font-mono text-slate-400">
                            Txn: {item.txnId}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Button
                        onClick={handleDownloadPdf}
                        variant="outline"
                        className="px-3 py-1.5 text-[12px] font-bold gap-1 inline-flex items-center"
                      >
                        <Download className="h-3.5 w-3.5" /> PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. PDF Preview Modal */}
      {previewModalOpen && previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="flat-card bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border bg-slate-50 dark:bg-slate-900">
              <h3 className="font-extrabold text-[16px] text-slate-900 dark:text-white flex items-center gap-2">
                <Eye className="h-5 w-5 text-accent" />
                Live PDF Payout Statement Preview
              </h3>
              <div className="flex items-center gap-2">
                <Button onClick={handleDownloadPdf} className="bg-accent text-white font-bold text-[13px] px-3 py-1.5">
                  <Download className="h-4 w-4 mr-1" /> Download
                </Button>
                <button
                  onClick={() => setPreviewModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-2 bg-slate-800 min-h-[500px]">
              <iframe
                src={previewPdfUrl}
                className="w-full h-full min-h-[500px] rounded-lg border-0"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. Raise Item Dispute Modal */}
      {disputeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="flat-card bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-extrabold text-[16px] text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Raise Deliverable Dispute
              </h3>
              <button
                onClick={() => setDisputeModalItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-1 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
              <p className="text-[12px] font-bold text-amber-700 dark:text-amber-300">Target Item:</p>
              <p className="text-[14px] font-extrabold text-slate-900 dark:text-white">
                {disputeModalItem.title}
              </p>
            </div>

            <form onSubmit={handleSubmitDispute} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Dispute Reason / Notes
                </label>
                <textarea
                  required
                  rows={4}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Describe rate discrepancy, missing revision pay, or issue..."
                  className="w-full text-[13px] border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {disputeSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[13px] font-bold text-emerald-600 dark:text-emerald-400">
                  {disputeSuccessMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDisputeModalItem(null)}
                  className="font-bold text-[13px]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={disputeSubmitting}
                  className="bg-amber-600 text-white font-bold text-[13px] hover:bg-amber-700"
                >
                  {disputeSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Dispute'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
