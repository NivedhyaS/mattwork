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
        <h1 className="text-[36px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="h-7 w-7 text-accent" />
          Invoice Statements & Receipts
        </h1>
        <p className="text-[15px] text-slate-500 mt-2">
          Review your project statements, invoice logs, and download official receipts.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 flat-card bg-card border border-border">
          <Loader2 className="h-6 w-6 animate-spin text-slate-350" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16 flat-card bg-card border border-border text-slate-450">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          <p className="font-semibold text-[15px]">No invoices found</p>
          <p className="text-[13px] text-slate-400 mt-0.5">Invoices will appear here once generated for your projects.</p>
        </div>
      ) : (
        <div className="flat-card bg-card border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[14px]">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-border text-[12px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-5">Invoice #</th>
                  <th className="py-4 px-5">Associated Video</th>
                  <th className="py-4 px-5">Amount</th>
                  <th className="py-4 px-5">Status</th>
                  <th className="py-4 px-5">Due Date</th>
                  <th className="py-4 px-5 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                    <td className="py-4 px-5 font-semibold text-[15px] text-slate-900 dark:text-slate-100">{inv.number}</td>
                    <td className="py-4 px-5 font-medium text-[14px] text-slate-650 dark:text-slate-300">{inv.projectTitle}</td>
                    <td className="py-4 px-5 font-bold text-[15px] text-slate-950 dark:text-white">{formatClientCurrency(inv.total)}</td>
                    <td className="py-4 px-5">
                      <span className={`px-2.5 py-1 rounded border text-[11px] font-semibold ${
                        inv.status === 'PAID' 
                          ? 'bg-status-green/10 text-status-green border-status-green/20' 
                          : 'bg-status-amber/10 text-status-amber border-status-amber/20'
                      }`}>
                        {inv.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-[14px] text-slate-500">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="py-4 px-5 text-right">
                      <button
                        onClick={() => handleDownloadInvoice(inv.id, inv.number)}
                        disabled={downloadingId === inv.id}
                        className="text-accent hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
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
