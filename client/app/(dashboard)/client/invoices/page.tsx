'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { 
  FileText, 
  Download, 
  Loader2, 
  AlertCircle, 
  Calendar,
  ExternalLink,
  DollarSign
} from 'lucide-react';
import { formatClientCurrency } from '@/lib/utils';

interface Project {
  id: string;
  title: string;
}

export default function ClientInvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    api.get('/invoices?limit=100')
      .then((res) => {
        const mappedInvoices = (res.data?.data || []).map((inv: any) => {
          const projectTitles: string[] = [];
          if (inv.project?.title) {
            projectTitles.push(inv.project.title);
          } else if (Array.isArray(inv.items)) {
            inv.items.forEach((it: any) => {
              if (it.description && !projectTitles.includes(it.description)) {
                projectTitles.push(it.description);
              }
            });
          }
          const projectLabel =
            projectTitles.slice(0, 2).join(', ') +
            (projectTitles.length > 2 ? ` +${projectTitles.length - 2} more` : '');

          return {
            ...inv,
            projectTitle: projectLabel || 'No Projects',
          };
        });

        setInvoices(mappedInvoices.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      })
      .catch((err) => {
        console.error('Failed to fetch invoices:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDownloadInvoice = async (invoiceId: string, invoiceNumber: string) => {
    setDownloadingId(invoiceId);
    try {
      // Step 1: Ensure PDF is generated/cached
      await api.post(`/invoices/${invoiceId}/generate-pdf`);
      
      // Step 2: Download PDF blob
      const response = await api.get(`/invoices/${invoiceId}/pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Invoice download failed:', err);
      alert('Failed to download invoice PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-[36px] font-extrabold text-[#1F1610] flex items-center gap-3">
          <FileText className="h-8 w-8 text-[#EA580C]" />
          Invoice Statements & Receipts
        </h1>
        <p className="text-[15px] text-[#4A3E34] mt-2 font-extrabold">
          Review your project statements, invoice logs, and download official receipts.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 bg-[#D8CFC2] rounded-3xl shadow-[inset_3px_3px_6px_rgba(135,120,108,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]">
          <Loader2 className="h-6 w-6 animate-spin text-[#EA580C]" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16 px-6 bg-[#D8CFC2] rounded-3xl shadow-[inset_3px_3px_6px_rgba(135,120,108,0.4),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] max-w-xl mx-auto my-6 flex flex-col items-center">
          <div className="h-16 w-16 rounded-full bg-[#D8CFC2] shadow-[inset_3px_3px_6px_rgba(135,120,108,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-[#EA580C]" />
          </div>
          <h3 className="text-[18px] font-extrabold text-[#1F1610] mb-1">No invoices found</h3>
          <p className="text-[14px] text-[#4A3E34] font-extrabold">Invoices will appear here once generated for your projects.</p>
        </div>
      ) : (
        <div className="bg-[#D8CFC2] rounded-3xl shadow-[inset_3px_3px_6px_rgba(135,120,108,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] overflow-hidden p-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[14px]">
              <thead>
                <tr className="bg-[#D8CFC2] border-b border-[rgba(135,120,108,0.3)] text-xs font-extrabold uppercase tracking-wider text-[#4A3E34]">
                  <th className="py-3.5 px-5">Invoice #</th>
                  <th className="py-3.5 px-5">Associated Video</th>
                  <th className="py-3.5 px-5">Amount</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5">Due Date</th>
                  <th className="py-3.5 px-5 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(135,120,108,0.25)]">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[rgba(255,255,255,0.35)] transition-all duration-150 group">
                    <td className="py-3.5 px-5 font-extrabold text-[15px] text-[#1F1610]">{inv.number}</td>
                    <td className="py-3.5 px-5 font-bold text-[14px] text-[#1F1610]">{inv.projectTitle}</td>
                    <td className="py-3.5 px-5 font-extrabold text-[15px] text-[#1F1610]">{formatClientCurrency(inv.total)}</td>
                    <td className="py-3.5 px-5">
                      <span className={`px-3 py-1 rounded-xl text-[11px] font-extrabold uppercase border ${
                        inv.status === 'PAID' 
                          ? 'bg-[rgba(16,185,129,0.14)] text-[#10B981] border-[rgba(16,185,129,0.4)] shadow-[inset_1.5px_1.5px_3px_rgba(16,185,129,0.25)]' 
                          : 'bg-[rgba(245,158,11,0.14)] text-[#F59E0B] border-[rgba(245,158,11,0.4)] shadow-[inset_1.5px_1.5px_3px_rgba(245,158,11,0.25)]'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-[14px] text-[#4A3E34] font-bold">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => handleDownloadInvoice(inv.id, inv.number)}
                        disabled={downloadingId === inv.id}
                        className="px-3 py-1.5 rounded-xl bg-[#D8CFC2] text-[#EA580C] hover:bg-[#E2DACC] font-extrabold shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),2px_2px_5px_rgba(135,120,108,0.5)] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-[12px] transition-all"
                      >
                        {downloadingId === inv.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            PDF <Download className="h-3.5 w-3.5" />
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
