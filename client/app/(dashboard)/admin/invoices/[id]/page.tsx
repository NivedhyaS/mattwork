'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { 
  ArrowLeft, 
  Download, 
  Loader2, 
  AlertTriangle, 
  FileText, 
  Calendar, 
  Building,
  CreditCard,
  RefreshCw,
  Mail,
  Phone,
  MapPin,
  Clock
} from 'lucide-react';
import Button from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300',
  SENT: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900 dark:text-indigo-400',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400',
  OVERDUE: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-400',
  CANCELLED: 'bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-850 dark:border-slate-800 dark:text-slate-400',
};

export default function InvoiceDetailsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const { data: invoiceData, isLoading, error, refetch } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const res = await api.get(`/invoices/${id}`);
      return res.data?.data;
    },
    enabled: !!id,
  });

  const downloadPdfMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice_${invoiceData?.number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
    onError: (err: any) => {
      console.error('Invoice PDF download failed:', err);
      alert('Failed to download invoice PDF. Please try again.');
    }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-slate-350" />
        <p className="text-sm text-slate-500 font-medium">Loading invoice details...</p>
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div className="text-center py-20 flex flex-col items-center gap-4 max-w-md mx-auto">
        <div className="h-14 w-14 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-rose-500" />
        </div>
        <div>
          <p className="font-bold text-[18px] text-rose-600 dark:text-rose-400">Failed to load invoice</p>
          <p className="text-sm text-slate-400 mt-1.5">
            {(error as any)?.response?.data?.message || (error as any)?.message || 'The requested invoice could not be found.'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push('/admin/invoices')} className="cursor-pointer">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Invoices
          </Button>
          <Button onClick={() => refetch()} className="cursor-pointer">
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const currency = invoiceData.client?.currency || 'USD';
  const subtotal = Number(invoiceData.subtotal || 0);
  const taxRate = Number(invoiceData.taxRate || 0);
  const taxAmount = Number(invoiceData.taxAmount || 0);
  const discount = Number(invoiceData.discount || 0);
  const total = Number(invoiceData.total || 0);
  const amountPaid = Number(invoiceData.amountPaid || 0);
  const outstanding = Math.max(0, total - amountPaid);

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6">
      {/* Top action header bar */}
      <div className="flex items-center justify-between gap-4 py-2">
        <button
          onClick={() => router.push('/admin/invoices')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Invoices
        </button>

        <Button 
          onClick={() => downloadPdfMutation.mutate()} 
          disabled={downloadPdfMutation.isPending}
          className="cursor-pointer shadow-sm shadow-indigo-500/10 hover:shadow-indigo-500/25"
        >
          {downloadPdfMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Download PDF
        </Button>
      </div>

      {/* Main Premium Invoice Details Card */}
      <Card className="shadow-lg border border-slate-100 dark:border-slate-900 rounded-2xl overflow-hidden bg-white dark:bg-slate-950">
        <CardContent className="p-6 sm:p-10 space-y-10">
          
          {/* Section 1: Header - Invoice metadata, ID and badge */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 dark:border-slate-800 pb-8 gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl">
                  <FileText className="h-6 w-6 text-indigo-500" />
                </div>
                <div>
                  <h2 className="text-[26px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Invoice {invoiceData.number}
                  </h2>
                  <p className="text-xs font-semibold text-slate-450 uppercase tracking-widest mt-0.5">
                    POST-PRODUCTION INVOICE
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:items-end gap-2">
              <span className={`px-4 py-1.5 rounded-full text-[13px] font-extrabold border uppercase tracking-wider ${STATUS_COLORS[invoiceData.status] || STATUS_COLORS.DRAFT}`}>
                {invoiceData.status}
              </span>
              <p className="text-[13px] text-slate-450 mt-1 font-medium">
                Issued {new Date(invoiceData.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Section 2: Invoice Totals Summary Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-slate-50/50 dark:bg-slate-900/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-900">
              <p className="text-[11px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">Total Amount</p>
              <p className="text-[24px] font-black text-slate-900 dark:text-white mt-1.5">
                {formatCurrency(total, currency)}
              </p>
            </div>
            <div className="bg-emerald-500/[0.02] dark:bg-emerald-500/[0.02] p-5 rounded-2xl border border-emerald-500/10 dark:border-emerald-500/10">
              <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">Amount Paid</p>
              <p className="text-[24px] font-black text-emerald-600 dark:text-emerald-450 mt-1.5">
                {formatCurrency(amountPaid, currency)}
              </p>
            </div>
            <div className={`p-5 rounded-2xl border ${
              outstanding > 0 
                ? 'bg-rose-500/[0.02] border-rose-500/15' 
                : 'bg-slate-50/50 dark:bg-slate-900/20 border-slate-100 dark:border-slate-900'
            }`}>
              <p className={`text-[11px] font-bold uppercase tracking-wider ${
                outstanding > 0 ? 'text-rose-500' : 'text-slate-450 dark:text-slate-500'
              }`}>Balance Due</p>
              <p className={`text-[24px] font-black mt-1.5 ${
                outstanding > 0 ? 'text-rose-600 dark:text-rose-450' : 'text-slate-900 dark:text-white'
              }`}>
                {formatCurrency(outstanding, currency)}
              </p>
            </div>
          </div>

          {/* Section 3: Billing Addresses info & Details Grid */}
          <div className="grid md:grid-cols-2 gap-10 text-[15px] border-t border-b border-slate-100 dark:border-slate-800 py-10">
            {/* Sender and Recipient addresses details */}
            <div className="grid sm:grid-cols-2 gap-8">
              {/* Sender Details */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Sender</h4>
                <div className="space-y-1">
                  <p className="font-extrabold text-slate-800 dark:text-slate-200">Mattwork Post-Production</p>
                  <p className="text-slate-400 text-[14px]">12 Film Studio Enclave</p>
                  <p className="text-slate-400 text-[14px]">Mumbai, MH, India</p>
                  <p className="text-indigo-600 dark:text-indigo-400 text-[14px] font-medium mt-1">billing@mattwork.com</p>
                </div>
              </div>

              {/* Client Billing Details */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Bill To</h4>
                <div className="space-y-1.5">
                  <p className="font-extrabold text-slate-800 dark:text-slate-200">
                    {invoiceData.client?.user?.name || 'Unknown Client'}
                  </p>
                  {invoiceData.client?.company && (
                    <p className="text-slate-500 dark:text-slate-350 text-[14px] font-semibold flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-slate-400" />
                      {invoiceData.client.company}
                    </p>
                  )}
                  {invoiceData.client?.address && (
                    <p className="text-slate-400 text-[14px] flex items-start gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>
                        {invoiceData.client.address}
                        {(invoiceData.client?.city || invoiceData.client?.country) && (
                          <span className="block">
                            {[invoiceData.client.city, invoiceData.client.country].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </span>
                    </p>
                  )}
                  <p className="text-slate-400 text-[14px] flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    {invoiceData.client?.user?.email}
                  </p>
                  {invoiceData.client?.user?.phone && (
                    <p className="text-slate-400 text-[14px] flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      {invoiceData.client.user.phone}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Dates, Project description and metadata */}
            <div className="bg-slate-50/50 dark:bg-slate-900/20 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-4">
              <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Invoice Terms & Metadata</h4>
              
              <div className="grid grid-cols-2 gap-4 text-[14px]">
                <div className="flex items-start gap-2.5">
                  <Calendar className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Due Date</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-350 mt-0.5">
                      {invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Upon Receipt'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Clock className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Status Time</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-350 mt-0.5">
                      {invoiceData.paidAt ? `Paid ${new Date(invoiceData.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Awaiting Payment'}
                    </p>
                  </div>
                </div>

                {invoiceData.project?.title && (
                  <div className="flex items-start gap-2.5 col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800/50">
                    <FileText className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Associated Project</p>
                      <p className="font-bold text-slate-850 dark:text-slate-200 mt-0.5">
                        {invoiceData.project.title}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2.5 col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800/50">
                  <CreditCard className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-455 tracking-wider">Preferred Payment Method</p>
                    <p className="font-semibold text-slate-750 dark:text-slate-300 mt-0.5">
                      Bank Wire / Corporate Credit Cards
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Line Items Table */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Line Items</h4>
            <div className="border border-slate-100 dark:border-slate-850 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-[14.5px]">
                <thead>
                  <tr className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-850 text-[11px] font-bold uppercase tracking-wider text-slate-450">
                    <th className="py-4 px-6">Description</th>
                    <th className="py-4 px-6 text-center w-24">Quantity</th>
                    <th className="py-4 px-6 text-right w-36">Unit Price</th>
                    <th className="py-4 px-6 text-right w-36">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                  {Array.isArray(invoiceData.items) ? (
                    invoiceData.items.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10 text-slate-700 dark:text-slate-300 transition-colors">
                        <td className="py-5 px-6 font-semibold text-slate-800 dark:text-slate-200">{item.description}</td>
                        <td className="py-5 px-6 text-center font-medium text-slate-600 dark:text-slate-400">{item.quantity}</td>
                        <td className="py-5 px-6 text-right font-medium">{formatCurrency(Number(item.unitPrice), currency)}</td>
                        <td className="py-5 px-6 text-right font-bold text-slate-900 dark:text-white">
                          {formatCurrency(Number(item.quantity) * Number(item.unitPrice), currency)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-450 italic">
                        No items list available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5: Calculations Totals Box & Notes Callouts */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-10 pt-4">
            
            {/* Notes and Terms widgets */}
            <div className="w-full md:flex-1 space-y-4">
              {invoiceData.notes && (
                <div className="bg-slate-50/50 dark:bg-slate-900/10 p-5 rounded-2xl border border-slate-100 dark:border-slate-900">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500">Invoice Notes</h4>
                  <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed whitespace-pre-wrap">{invoiceData.notes}</p>
                </div>
              )}
              {invoiceData.terms && (
                <div className="bg-slate-50/30 dark:bg-slate-900/5 p-5 rounded-2xl border border-slate-100/70 dark:border-slate-900/70">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500">Payment Terms</h4>
                  <p className="text-[13px] text-slate-450 dark:text-slate-450 mt-2 leading-relaxed whitespace-pre-wrap">{invoiceData.terms}</p>
                </div>
              )}
            </div>

            {/* Calculations right panel */}
            <div className="w-full md:w-80 space-y-4 text-[14.5px] bg-slate-50/50 dark:bg-slate-900/10 p-6 rounded-2xl border border-slate-100 dark:border-slate-900 shrink-0">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(subtotal, currency)}</span>
              </div>

              {taxRate > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Tax ({taxRate}%)</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(taxAmount, currency)}</span>
                </div>
              )}

              {discount > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Discount</span>
                  <span className="font-semibold text-rose-500">-{formatCurrency(discount, currency)}</span>
                </div>
              )}

              <div className="flex justify-between text-[16px] font-extrabold border-t border-slate-200 dark:border-slate-800 pt-3.5 text-slate-900 dark:text-white">
                <span>Total</span>
                <span>{formatCurrency(total, currency)}</span>
              </div>

              <div className="flex justify-between text-slate-500">
                <span>Amount Paid</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(amountPaid, currency)}</span>
              </div>

              {outstanding > 0 ? (
                <div className="flex justify-between text-[15.5px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 dark:bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/10 mt-1">
                  <span>Balance Due</span>
                  <span>{formatCurrency(outstanding, currency)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-[15.5px] font-extrabold text-emerald-600 dark:text-emerald-450 bg-emerald-500/5 dark:bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/10 mt-1">
                  <span>Invoice Settled</span>
                  <span>{formatCurrency(0, currency)}</span>
                </div>
              )}
            </div>

          </div>

        </CardContent>
      </Card>
    </div>
  );
}
