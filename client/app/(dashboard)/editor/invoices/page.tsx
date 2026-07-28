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
import Toast from '@/components/ui/Toast';

interface Project {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  editorPrice?: number | string | null;
}

interface EligibleClient {
  id: string;
  name: string;
  company?: string;
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
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [ratePerVideo, setRatePerVideo] = useState(500);
  const [eligibleClients, setEligibleClients] = useState<EligibleClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Selection & Config state
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [editorName, setEditorName] = useState('Test Editor');
  const [accountName, setAccountName] = useState('Test Editor');
  const [accountNumber, setAccountNumber] = useState('50100987654321');
  const [ifscCode, setIfscCode] = useState('HDFC0001234');
  const [bankName, setBankName] = useState('HDFC Bank');
  const [panNumber, setPanNumber] = useState('ABCDE1234F');
  const [currency, setCurrency] = useState('INR');
  const [bonusAmount, setBonusAmount] = useState<number | string>(0);
  const [tdsRate, setTdsRate] = useState<number>(0);

  // Modals & Tabs state
  const [activeTab, setActiveTab] = useState<'generator' | 'history'>('generator');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [disputeModalItem, setDisputeModalItem] = useState<Project | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeSuccessMsg, setDisputeSuccessMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

  // Statement History
  const [statementHistory] = useState<StatementHistoryItem[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/invoices/editor/eligible-clients'),
      api.get('/editors/me'),
      api.get('/projects?limit=100')
    ])
      .then(([clientsRes, editorRes, projectsRes]) => {
        const clientsList: EligibleClient[] = clientsRes.data.data || [];
        setEligibleClients(clientsList);

        const data: Project[] = projectsRes.data.data || [];
        const uploaded = data.filter((p) => p.status === 'UPLOADED' && !(p as any).editorInvoiced);
        setAllCompletedProjects(uploaded);

        const profile = editorRes.data.data;
        if (profile?.user?.name) {
          setEditorName(profile.user.name);
          setAccountName(profile.user.name);
        }
        if (profile?.hourlyRate) {
          setRatePerVideo(Number(profile.hourlyRate));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Live Sync: Filter completed deliverables whenever selected client changes
  useEffect(() => {
    if (!selectedClientId) {
      setCompletedProjects([]);
      setSelectedProjectIds([]);
      return;
    }
    setLoadingProjects(true);
    api.get('/projects?limit=100')
      .then((res) => {
        const data: Project[] = res.data.data || [];
        const filtered = data.filter(
          (p: any) => p.status === 'UPLOADED' && p.clientId === selectedClientId && !p.editorInvoiced
        );
        setCompletedProjects(filtered);
        setSelectedProjectIds(filtered.map((p) => p.id));
      })
      .catch(console.error)
      .finally(() => setLoadingProjects(false));
  }, [selectedClientId]);

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

  const selectedClient = eligibleClients.find((c) => c.id === selectedClientId);

  // PDF Generator API call
  const generatePdfBlob = async (): Promise<Blob> => {
    const payload = {
      clientId: selectedClientId,
      projectIds: selectedProjectIds,
      editorName,
      paymentDetails: `Bank: ${bankName} | A/C Name: ${accountName} | A/C No: ${accountNumber} | IFSC: ${ifscCode} | PAN: ${panNumber}`,
      bonusAmount: numBonus,
      tdsRate,
      currency
    };

    const response = await api.post('/invoices/editor/pdf', payload, {
      responseType: 'blob'
    });
    return new Blob([response.data], { type: 'application/pdf' });
  };

  const selectedClientName = eligibleClients.find(c => c.id === selectedClientId)?.name || 'Client';

  const handleDownloadPdf = async () => {
    if (!selectedClientId) {
      setToast({ message: 'Please select an assigned client first.', type: 'error' });
      return;
    }
    if (selectedProjectIds.length === 0) {
      setToast({ message: 'Please select at least one completed deliverable to compile a payout statement.', type: 'error' });
      return;
    }
    setIsGenerating(true);
    try {
      const blob = await generatePdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `editor_payout_${selectedClientName.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      const res = await api.get('/invoices/editor/eligible-clients');
      setEligibleClients(res.data.data || []);
      setSelectedClientId('');
      setToast({ message: 'Payout PDF compiled and downloaded successfully!', type: 'success' });
    } catch (err) {
      console.error('PDF download failed:', err);
      setToast({ message: 'Failed to generate payout PDF.', type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreviewPdf = async () => {
    if (!selectedClientId) {
      setToast({ message: 'Please select an assigned client first.', type: 'error' });
      return;
    }
    if (selectedProjectIds.length === 0) {
      setToast({ message: 'Please select at least one completed deliverable to preview.', type: 'error' });
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
      setToast({ message: 'Failed to render PDF preview.', type: 'error' });
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
      setToast({ message: 'Dispute ticket submitted to Admin.', type: 'success' });
      setTimeout(() => {
        setDisputeModalItem(null);
        setDisputeReason('');
        setDisputeSuccessMsg(null);
      }, 2500);
    } catch (err) {
      console.error('Dispute failed:', err);
      setToast({ message: 'Failed to submit dispute ticket.', type: 'error' });
    } finally {
      setDisputeSubmitting(false);
    }
  };

  const filteredClients = eligibleClients.filter(c =>
    !clientSearch ||
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(clientSearch.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* 1. Header Section & Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[36px] font-extrabold text-[#1F1610] tracking-tight flex items-center gap-3">
            <FileText className="h-8 w-8 text-[#EA580C]" />
            Editor Payout Statements
          </h1>
          <p className="text-[15px] text-[#4A3E34] mt-1 font-extrabold">
            Compile client payout statements, customize payout accounts, and manage official PDF records.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-[#D8CFC2] p-1.5 rounded-2xl shadow-[inset_3px_3px_6px_rgba(135,120,108,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] shrink-0">
          <button
            onClick={() => setActiveTab('generator')}
            className={`flex items-center gap-2 px-4 py-2 text-[13px] font-extrabold rounded-xl transition-all cursor-pointer ${
              activeTab === 'generator'
                ? 'bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),2px_2px_6px_rgba(234,88,12,0.3)]'
                : 'text-[#4A3E34] hover:text-[#1F1610]'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Compile Statement
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 text-[13px] font-extrabold rounded-xl transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),2px_2px_6px_rgba(234,88,12,0.3)]'
                : 'text-[#4A3E34] hover:text-[#1F1610]'
            }`}
          >
            <History className="h-4 w-4" />
            Statement History
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#E2DACC] p-6 rounded-3xl border-0 shadow-[-8px_-8px_18px_rgba(255,255,255,0.85),8px_8px_18px_rgba(125,110,98,0.75)] space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-extrabold text-[#4A3E34] uppercase tracking-wider">
              {selectedClientId ? `Earnings for ${selectedClientName}` : 'Selected Client Earnings'}
            </span>
            <DollarSign className="h-5 w-5 text-[#EA580C]" />
          </div>
          <p className="text-[32px] font-black text-[#1F1610]">
            {formatEditorCurrency(subtotal)}
          </p>
          <p className="text-[13px] font-extrabold text-[#4A3E34]">
            From {selectedProjects.length} selected deliverable(s) {selectedClientId ? `for ${selectedClientName}` : ''}
          </p>
        </div>

        <div className="bg-[#E2DACC] p-6 rounded-3xl border-0 shadow-[-8px_-8px_18px_rgba(255,255,255,0.85),8px_8px_18px_rgba(125,110,98,0.75)] space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-extrabold text-[#4A3E34] uppercase tracking-wider">Lifetime Earnings</span>
            <TrendingUp className="h-5 w-5 text-[#10B981]" />
          </div>
          <p className="text-[32px] font-black text-[#1F1610]">
            {formatEditorCurrency(lifetimeTotal)}
          </p>
          <p className="text-[13px] font-extrabold text-[#4A3E34]">
            Across {allCompletedProjects.length} total completed video deliverables
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 bg-[#D8CFC2] rounded-3xl shadow-[inset_3px_3px_6px_rgba(135,120,108,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]">
          <Loader2 className="h-8 w-8 animate-spin text-[#EA580C]" />
        </div>
      ) : activeTab === 'generator' ? (
        /* 3. Main Generator Two-Panel Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Compile Statement Config Card (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-[#E2DACC] p-6 rounded-3xl border-0 shadow-[-8px_-8px_18px_rgba(255,255,255,0.85),8px_8px_18px_rgba(125,110,98,0.75)] space-y-5">
              <div className="flex items-center justify-between border-b border-[rgba(135,120,108,0.3)] pb-4">
                <h3 className="font-extrabold text-[17px] text-[#1F1610] flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-[#EA580C]" />
                  Compile Statement
                </h3>
                <span className="text-[11px] font-extrabold text-[#EA580C] bg-[rgba(234,88,12,0.12)] border border-[rgba(234,88,12,0.3)] px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Live Sync
                </span>
              </div>

              {/* Searchable Client Selector */}
              <div className="space-y-2">
                <label className="text-[12px] text-[#4A3E34] font-extrabold uppercase tracking-wider block">
                  Select Assigned Client
                </label>
                
                {eligibleClients.length === 0 ? (
                  <div className="p-3.5 text-[13px] text-[#4A3E34] bg-[#D8CFC2] rounded-2xl shadow-[inset_3px_3px_6px_rgba(135,120,108,0.4),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] text-center font-extrabold">
                    No eligible uninvoiced clients found.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      placeholder="Search client by name..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="w-full text-[13px] border-0 rounded-2xl p-3 bg-[#D8CFC2] text-[#1F1610] font-extrabold shadow-[inset_3px_3px_6px_rgba(135,120,108,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] focus:outline-none placeholder-[#4A3E34]"
                    />
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="w-full text-[14px] font-extrabold border-0 rounded-2xl p-3 bg-[#D8CFC2] text-[#1F1610] shadow-[inset_3px_3px_6px_rgba(135,120,108,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Choose a Client --</option>
                      {filteredClients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.company ? `(${c.company})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Editor Details (Confirmable) */}
              <div className="space-y-4 pt-3 border-t border-[rgba(135,120,108,0.3)]">
                <span className="text-[12px] text-[#4A3E34] font-extrabold uppercase tracking-wider block">
                  Payee Information
                </span>

                <div className="space-y-1.5">
                  <label className="text-[12px] text-[#4A3E34] font-extrabold">From (Editor Name)</label>
                  <input
                    type="text"
                    value={editorName}
                    onChange={(e) => setEditorName(e.target.value)}
                    className="w-full text-[13px] border-0 rounded-xl p-2.5 bg-[#D8CFC2] text-[#1F1610] font-extrabold shadow-[inset_2px_2px_4px_rgba(135,120,108,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] focus:outline-none"
                  />
                </div>

                {/* Bank Account Payment Details */}
                <div className="space-y-3 pt-3 border-t border-[rgba(135,120,108,0.3)]">
                  <span className="text-[12px] text-[#4A3E34] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-[#EA580C]" />
                    Bank Account Details
                  </span>

                  <div className="p-3.5 rounded-2xl bg-[#D8CFC2] shadow-[inset_3px_3px_6px_rgba(135,120,108,0.4),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] space-y-3">
                    {/* Account Name */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#4A3E34] font-extrabold uppercase tracking-wide">
                        Account Name
                      </label>
                      <input
                        type="text"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        className="w-full text-[13px] border-0 rounded-xl p-2.5 bg-[#E2DACC] text-[#1F1610] font-extrabold shadow-[inset_2px_2px_4px_rgba(135,120,108,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] focus:outline-none"
                        placeholder="e.g. Test Editor"
                      />
                    </div>

                    {/* Account Number */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#4A3E34] font-extrabold uppercase tracking-wide">
                        Account Number
                      </label>
                      <input
                        type="text"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="w-full text-[13px] border-0 rounded-xl p-2.5 bg-[#E2DACC] text-[#1F1610] font-mono font-extrabold shadow-[inset_2px_2px_4px_rgba(135,120,108,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] focus:outline-none"
                        placeholder="e.g. 50100987654321"
                      />
                    </div>

                    {/* 2-column: IFSC Code & Bank Name */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[11px] text-[#4A3E34] font-extrabold uppercase tracking-wide">
                          IFSC Code
                        </label>
                        <input
                          type="text"
                          value={ifscCode}
                          onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                          className="w-full text-[13px] border-0 rounded-xl p-2.5 bg-[#E2DACC] text-[#1F1610] font-mono uppercase font-extrabold shadow-[inset_2px_2px_4px_rgba(135,120,108,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] focus:outline-none"
                          placeholder="e.g. HDFC0001234"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-[#4A3E34] font-extrabold uppercase tracking-wide">
                          Bank Name
                        </label>
                        <input
                          type="text"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="w-full text-[13px] border-0 rounded-xl p-2.5 bg-[#E2DACC] text-[#1F1610] font-extrabold shadow-[inset_2px_2px_4px_rgba(135,120,108,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] focus:outline-none"
                          placeholder="e.g. HDFC Bank"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[12px] text-[#4A3E34] font-extrabold">PAN / Tax ID</label>
                    <input
                      type="text"
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value)}
                      className="w-full text-[13px] border-0 rounded-xl p-2.5 bg-[#D8CFC2] text-[#1F1610] font-mono uppercase font-extrabold shadow-[inset_2px_2px_4px_rgba(135,120,108,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] text-[#4A3E34] font-extrabold">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full text-[13px] border-0 rounded-xl p-2.5 bg-[#D8CFC2] text-[#1F1610] font-extrabold shadow-[inset_2px_2px_4px_rgba(135,120,108,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] focus:outline-none cursor-pointer"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Live Calculation Ticker Box */}
              <div className="bg-[#D8CFC2] p-4 rounded-2xl shadow-[inset_3px_3px_6px_rgba(135,120,108,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] space-y-2">
                <div className="flex justify-between text-[13px] text-[#4A3E34] font-extrabold">
                  <span>Selected Items Subtotal:</span>
                  <span className="font-black text-[#1F1610]">{formatEditorCurrency(subtotal)}</span>
                </div>
                <div className="border-t border-[rgba(135,120,108,0.3)] pt-2 flex justify-between items-center">
                  <span className="text-[14px] font-extrabold text-[#1F1610]">Net Payout:</span>
                  <span className="text-[22px] font-black text-[#EA580C]">{formatEditorCurrency(netPayable)}</span>
                </div>
              </div>

              {/* Action Buttons Stack */}
              <div className="space-y-3 pt-2">
                <Button
                  onClick={handleDownloadPdf}
                  disabled={isGenerating}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white font-extrabold py-3.5 rounded-2xl shadow-[-3px_-3px_8px_rgba(255,255,255,0.7),3px_3px_10px_rgba(234,88,12,0.35)] hover:shadow-[-5px_-5px_12px_rgba(255,255,255,0.8),5px_5px_14px_rgba(234,88,12,0.45)] transition-all cursor-pointer border-none text-[14px]"
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download Payout PDF
                </Button>

                <Button
                  onClick={handlePreviewPdf}
                  disabled={isGenerating}
                  className="w-full flex items-center justify-center gap-2 bg-[#D8CFC2] text-[#1F1610] hover:text-[#EA580C] font-extrabold text-[13px] py-3 rounded-2xl shadow-[-3px_-3px_6px_rgba(255,255,255,0.8),3px_3px_6px_rgba(135,120,108,0.5)] transition-all cursor-pointer border-0"
                >
                  <Eye className="h-4 w-4" />
                  Preview Payout PDF
                </Button>
              </div>
            </div>
          </div>

          {/* Right Panel: Line Items Table (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-[#E2DACC] p-6 rounded-3xl border-0 shadow-[-8px_-8px_18px_rgba(255,255,255,0.85),8px_8px_18px_rgba(125,110,98,0.75)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[rgba(135,120,108,0.3)] pb-4">
                <div>
                  <h3 className="font-extrabold text-[17px] text-[#1F1610] flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
                    Completed Deliverables Line Items
                  </h3>
                  <p className="text-[13px] text-[#4A3E34] mt-0.5 font-extrabold">
                    {selectedClientId
                      ? `Uninvoiced completed deliverables for ${selectedClientName}. Check or uncheck to include.`
                      : 'Select an assigned client on the left to view eligible deliverables.'}
                  </p>
                </div>

                {completedProjects.length > 0 && (
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="flex items-center gap-2 text-[13px] font-extrabold text-[#1F1610] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.length === completedProjects.length && completedProjects.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded-lg text-[#EA580C] focus:ring-[#EA580C] h-4 w-4 cursor-pointer"
                      />
                      Select All ({completedProjects.length})
                    </label>
                  </div>
                )}
              </div>

              {!selectedClientId ? (
                <div className="text-center py-16 px-6 bg-[#D8CFC2] rounded-3xl shadow-[inset_3px_3px_6px_rgba(135,120,108,0.4),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] max-w-xl mx-auto my-6 flex flex-col items-center">
                  <div className="h-16 w-16 rounded-full bg-[#D8CFC2] shadow-[inset_3px_3px_6px_rgba(135,120,108,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] flex items-center justify-center mb-4">
                    <AlertCircle className="h-8 w-8 text-[#EA580C]" />
                  </div>
                  <h4 className="font-extrabold text-[18px] text-[#1F1610] mb-1">No Client Selected</h4>
                  <p className="text-[14px] text-[#4A3E34] max-w-md mx-auto font-extrabold">
                    Please select a client from the dropdown on the left to compile a payout statement for their completed deliverables.
                  </p>
                </div>
              ) : loadingProjects ? (
                <div className="flex items-center justify-center py-16 text-[#4A3E34] font-extrabold">
                  <Loader2 className="h-6 w-6 animate-spin text-[#EA580C] mr-2" /> Loading deliverables...
                </div>
              ) : completedProjects.length === 0 ? (
                /* Empty State */
                <div className="text-center py-16 px-6 bg-[#D8CFC2] rounded-3xl shadow-[inset_3px_3px_6px_rgba(135,120,108,0.4),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] max-w-xl mx-auto my-6 flex flex-col items-center">
                  <div className="h-16 w-16 rounded-full bg-[#D8CFC2] shadow-[inset_3px_3px_6px_rgba(135,120,108,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] flex items-center justify-center mb-4">
                    <AlertCircle className="h-8 w-8 text-[#EA580C]" />
                  </div>
                  <h4 className="font-extrabold text-[18px] text-[#1F1610] mb-1">No Completed Deliverables Found</h4>
                  <p className="text-[14px] text-[#4A3E34] max-w-md mx-auto font-extrabold">
                    There are no uninvoiced completed projects (UPLOADED) for {selectedClientName}.
                  </p>
                </div>
              ) : (
                /* Line Items Table */
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#E2DACC] border-b border-[rgba(135,120,108,0.3)] text-xs font-extrabold uppercase tracking-wider text-[#4A3E34]">
                        <th className="py-3.5 px-3 w-10 text-center">Include</th>
                        <th className="py-3.5 px-3">Deliverable Name</th>
                        <th className="py-3.5 px-3 text-center">Completed Date</th>
                        <th className="py-3.5 px-3 text-right">Rate</th>
                        <th className="py-3.5 px-3 text-center">Qty</th>
                        <th className="py-3.5 px-3 text-right">Amount</th>
                        <th className="py-3.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(135,120,108,0.25)] text-[14px]">
                      {completedProjects.map((proj) => {
                        const isChecked = selectedProjectIds.includes(proj.id);
                        const rateVal = proj.editorPrice != null ? Number(proj.editorPrice) : ratePerVideo;
                        return (
                          <tr
                            key={proj.id}
                            className={`hover:bg-[rgba(255,255,255,0.35)] transition-all duration-150 group ${
                              isChecked ? '' : 'opacity-50'
                            }`}
                          >
                            <td className="py-3.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectProject(proj.id)}
                                className="rounded-lg text-[#EA580C] focus:ring-[#EA580C] h-4 w-4 cursor-pointer"
                              />
                            </td>
                            <td className="py-3.5 px-3">
                              <p className="font-extrabold text-[#1F1610] line-clamp-1 text-[14px]">
                                {proj.title}
                              </p>
                            </td>
                            <td className="py-3.5 px-3 text-center text-[#4A3E34] font-extrabold whitespace-nowrap text-[13px]">
                              {new Date(proj.updatedAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </td>
                            <td className="py-3.5 px-3 text-right font-extrabold text-[#1F1610]">
                              {formatEditorCurrency(rateVal)}
                            </td>
                            <td className="py-3.5 px-3 text-center font-extrabold text-[#4A3E34]">1</td>
                            <td className="py-3.5 px-3 text-right font-black text-[#1F1610]">
                              {formatEditorCurrency(rateVal)}
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <button
                                onClick={() => setDisputeModalItem(proj)}
                                title="Raise a dispute / report issue for this deliverable"
                                className="px-3 py-1 rounded-xl bg-[rgba(245,158,11,0.14)] text-[#F59E0B] border border-[rgba(245,158,11,0.4)] shadow-[inset_1.5px_1.5px_3px_rgba(245,158,11,0.25)] font-extrabold text-[11.5px] cursor-pointer inline-flex items-center gap-1.5 hover:bg-[rgba(245,158,11,0.25)] transition-all"
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
              <div className="border-t border-[rgba(135,120,108,0.3)] pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#D8CFC2] p-4 rounded-2xl shadow-[inset_3px_3px_6px_rgba(135,120,108,0.4),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]">
                <div className="text-[13px] text-[#4A3E34] font-extrabold">
                  Showing <strong className="text-[#1F1610] font-black">{selectedProjects.length}</strong> of{' '}
                  <strong className="text-[#1F1610] font-black">{completedProjects.length}</strong> deliverables selected
                </div>

                <div className="flex items-center gap-6 text-right">
                  <div>
                    <span className="text-[12px] text-[#4A3E34] block font-extrabold uppercase">Subtotal</span>
                    <span className="font-black text-[16px] text-[#1F1610]">
                      {formatEditorCurrency(subtotal)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[12px] text-[#4A3E34] block font-extrabold uppercase">Final Payout</span>
                    <span className="font-black text-[22px] text-[#EA580C]">
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
        <div className="bg-[#E2DACC] p-6 rounded-3xl border-0 shadow-[-8px_-8px_18px_rgba(255,255,255,0.85),8px_8px_18px_rgba(125,110,98,0.75)] space-y-6">
          <div className="flex items-center justify-between border-b border-[rgba(135,120,108,0.3)] pb-4">
            <div>
              <h3 className="font-extrabold text-[18px] text-[#1F1610] flex items-center gap-2">
                <History className="h-5 w-5 text-[#EA580C]" />
                Compiled Statement History
              </h3>
              <p className="text-[13px] text-[#4A3E34] mt-0.5 font-extrabold">
                Review past monthly statements, payment statuses, and transaction details.
              </p>
            </div>
          </div>

          {statementHistory.length === 0 ? (
            <div className="text-center py-16 px-6 bg-[#D8CFC2] rounded-3xl shadow-[inset_3px_3px_6px_rgba(135,120,108,0.4),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] max-w-xl mx-auto my-6 flex flex-col items-center">
              <div className="h-16 w-16 rounded-full bg-[#D8CFC2] shadow-[inset_3px_3px_6px_rgba(135,120,108,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] flex items-center justify-center mb-4">
                <History className="h-8 w-8 text-[#EA580C]" />
              </div>
              <h4 className="font-extrabold text-[18px] text-[#1F1610] mb-1">No Past Statements Found</h4>
              <p className="text-[14px] text-[#4A3E34] font-extrabold">Compiled payout statements will be logged here automatically.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#E2DACC] border-b border-[rgba(135,120,108,0.3)] text-xs font-extrabold uppercase tracking-wider text-[#4A3E34]">
                    <th className="py-3.5 px-4">Statement No</th>
                    <th className="py-3.5 px-4">Period</th>
                    <th className="py-3.5 px-4">Date Compiled</th>
                    <th className="py-3.5 px-4 text-center">Deliverables</th>
                    <th className="py-3.5 px-4 text-right">Payout Total</th>
                    <th className="py-3.5 px-4 text-center">Payment Status</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(135,120,108,0.25)] text-[14px]">
                  {statementHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-[rgba(255,255,255,0.35)] transition-all">
                      <td className="py-4 px-4 font-mono font-extrabold text-[#1F1610]">
                        {item.statementNo}
                      </td>
                      <td className="py-4 px-4 font-bold text-[#1F1610]">
                        {item.period}
                      </td>
                      <td className="py-4 px-4 text-[#4A3E34] whitespace-nowrap text-[13px] font-bold">
                        {item.dateCompiled}
                      </td>
                      <td className="py-4 px-4 text-center font-extrabold text-[#4A3E34]">
                        {item.deliverablesCount} items
                      </td>
                      <td className="py-4 px-4 text-right font-black text-[#1F1610]">
                        {formatEditorCurrency(item.netTotal)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          {item.status === 'PAID' ? (
                            <span className="px-3 py-1 rounded-xl text-[11px] font-extrabold uppercase bg-[rgba(16,185,129,0.14)] text-[#10B981] border border-[rgba(16,185,129,0.4)] shadow-[inset_1.5px_1.5px_3px_rgba(16,185,129,0.25)]">
                              <ShieldCheck className="h-3.5 w-3.5 mr-1 inline" /> PAID
                            </span>
                          ) : item.status === 'PROCESSING' ? (
                            <span className="px-3 py-1 rounded-xl text-[11px] font-extrabold uppercase bg-[rgba(99,102,241,0.14)] text-[#6366F1] border border-[rgba(99,102,241,0.4)] shadow-[inset_1.5px_1.5px_3px_rgba(99,102,241,0.25)]">
                              <Clock className="h-3.5 w-3.5 mr-1 inline" /> PROCESSING
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-xl text-[11px] font-extrabold uppercase bg-[rgba(245,158,11,0.14)] text-[#F59E0B] border border-[rgba(245,158,11,0.4)] shadow-[inset_1.5px_1.5px_3px_rgba(245,158,11,0.25)]">
                              <AlertCircle className="h-3.5 w-3.5 mr-1 inline" /> PENDING
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={handleDownloadPdf}
                          className="px-3 py-1.5 rounded-xl bg-[#D8CFC2] text-[#EA580C] font-extrabold shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),2px_2px_5px_rgba(135,120,108,0.5)] inline-flex items-center gap-1.5 cursor-pointer text-[12px] transition-all"
                        >
                          <Download className="h-3.5 w-3.5" /> PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. PDF Preview Modal */}
      {previewModalOpen && previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#E2DACC] border-0 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-[-10px_-10px_24px_rgba(255,255,255,0.9),10px_10px_24px_rgba(0,0,0,0.4)] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[rgba(135,120,108,0.3)] bg-[#D8CFC2]">
              <h3 className="font-extrabold text-[17px] text-[#1F1610] flex items-center gap-2">
                <Eye className="h-5 w-5 text-[#EA580C]" />
                Live PDF Payout Statement Preview
              </h3>
              <div className="flex items-center gap-3">
                <Button onClick={handleDownloadPdf} className="bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white font-extrabold text-[13px] px-4 py-2 rounded-xl border-none cursor-pointer">
                  <Download className="h-4 w-4 mr-1.5" /> Download
                </Button>
                <button
                  onClick={() => setPreviewModalOpen(false)}
                  className="p-2 text-[#4A3E34] hover:text-[#1F1610] rounded-xl cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-3 bg-[#1F1610] min-h-[500px]">
              <iframe
                src={previewPdfUrl}
                className="w-full h-full min-h-[500px] rounded-2xl border-0"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. Raise Item Dispute Modal */}
      {disputeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#E2DACC] border-0 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-[-10px_-10px_24px_rgba(255,255,255,0.9),10px_10px_24px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between border-b border-[rgba(135,120,108,0.3)] pb-3">
              <h3 className="font-extrabold text-[17px] text-[#F59E0B] flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Raise Deliverable Dispute
              </h3>
              <button
                onClick={() => setDisputeModalItem(null)}
                className="p-1 text-[#4A3E34] hover:text-[#1F1610] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-1 bg-[#D8CFC2] p-3.5 rounded-2xl shadow-[inset_2px_2px_4px_rgba(135,120,108,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
              <p className="text-[12px] font-extrabold text-[#F59E0B]">Target Item:</p>
              <p className="text-[14px] font-extrabold text-[#1F1610]">
                {disputeModalItem.title}
              </p>
            </div>

            <form onSubmit={handleSubmitDispute} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-extrabold text-[#4A3E34] uppercase tracking-wider block">
                  Dispute Reason / Notes
                </label>
                <textarea
                  required
                  rows={4}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Describe rate discrepancy, missing revision pay, or issue..."
                  className="w-full text-[13px] border-0 rounded-2xl p-3 bg-[#D8CFC2] text-[#1F1610] font-extrabold shadow-[inset_3px_3px_6px_rgba(135,120,108,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] focus:outline-none placeholder-[#4A3E34]"
                />
              </div>

              {disputeSuccessMsg && (
                <div className="p-3 bg-[rgba(16,185,129,0.14)] border border-[rgba(16,185,129,0.4)] rounded-2xl text-[13px] font-extrabold text-[#10B981]">
                  {disputeSuccessMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDisputeModalItem(null)}
                  className="px-4 py-2.5 rounded-2xl bg-[#D8CFC2] text-[#1F1610] font-extrabold text-[13px] shadow-[-3px_-3px_6px_rgba(255,255,255,0.8),3px_3px_6px_rgba(135,120,108,0.5)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disputeSubmitting}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white font-extrabold text-[13px] shadow-[-3px_-3px_8px_rgba(255,255,255,0.7),3px_3px_10px_rgba(234,88,12,0.35)] cursor-pointer border-none"
                >
                  {disputeSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Dispute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Render Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
