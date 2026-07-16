'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { 
  ArrowLeft, 
  Download, 
  Loader2, 
  AlertTriangle, 
  CreditCard, 
  Calendar, 
  User, 
  FileText, 
  Clock, 
  RefreshCw,
  Hash,
  BookOpen
} from 'lucide-react';
import Button from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400',
  FAILED: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-400',
  REFUNDED: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400',
};

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  STRIPE: 'Stripe / Card',
  PAYPAL: 'PayPal',
  CASH: 'Cash',
  UPI: 'UPI',
  CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card',
  OTHER: 'Other',
};

export default function PaymentDetailsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const { data: paymentData, isLoading, error, refetch } = useQuery({
    queryKey: ['payment', id],
    queryFn: async () => {
      const res = await api.get(`/payments/${id}`);
      return res.data?.data;
    },
    enabled: !!id,
  });

  const downloadPdfMutation = useMutation({
    mutationFn: async () => {
      if (!paymentData?.invoice?.id) return;
      const response = await api.get(`/invoices/${paymentData.invoice.id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice_${paymentData.invoice.number}.pdf`);
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
        <p className="text-sm text-slate-500 font-medium">Loading payment details...</p>
      </div>
    );
  }

  if (error || !paymentData) {
    return (
      <div className="text-center py-20 flex flex-col items-center gap-4 max-w-md mx-auto">
        <div className="h-14 w-14 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-rose-500" />
        </div>
        <div>
          <p className="font-bold text-[18px] text-rose-600 dark:text-rose-400">Failed to load payment</p>
          <p className="text-sm text-slate-400 mt-1.5">
            {(error as any)?.response?.data?.message || (error as any)?.message || 'The requested payment could not be found.'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push('/admin/payments')} className="cursor-pointer">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Payments
          </Button>
          <Button onClick={() => refetch()} className="cursor-pointer">
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const currency = paymentData.invoice?.client?.currency || 'USD';
  const total = Number(paymentData.amount || 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6">
      {/* Top back bar and actions */}
      <div className="flex items-center justify-between gap-4 py-2">
        <button
          onClick={() => router.push('/admin/payments')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Payments
        </button>

        {paymentData.invoice && (
          <Button 
            onClick={() => downloadPdfMutation.mutate()} 
            disabled={downloadPdfMutation.isPending}
            className="cursor-pointer shadow-sm"
          >
            {downloadPdfMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download Invoice PDF
          </Button>
        )}
      </div>

      {/* Main Details Card */}
      <Card className="shadow-lg border border-slate-100 dark:border-slate-900 rounded-2xl overflow-hidden bg-white dark:bg-slate-950">
        <CardContent className="p-6 sm:p-10 space-y-10">
          
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 dark:border-slate-800 pb-8 gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                  <CreditCard className="h-6 w-6 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-[24px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Payment Reference: {paymentData.reference || 'N/A'}
                  </h2>
                  <p className="text-xs font-semibold text-slate-455 uppercase tracking-widest mt-0.5">
                    TRANSACTION SUMMARY
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:items-end gap-2">
              <span className={`px-4 py-1.5 rounded-full text-[13px] font-extrabold border uppercase tracking-wider ${STATUS_COLORS[paymentData.status] || STATUS_COLORS.PENDING}`}>
                {paymentData.status}
              </span>
              <p className="text-[13px] text-slate-450 mt-1 font-medium">
                Recorded {new Date(paymentData.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-slate-50/50 dark:bg-slate-900/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-900">
              <p className="text-[11px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">Payment Amount</p>
              <p className="text-[24px] font-black text-slate-900 dark:text-white mt-1.5">
                {formatCurrency(total, currency)}
              </p>
            </div>
            <div className="bg-slate-50/50 dark:bg-slate-900/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-900">
              <p className="text-[11px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">Payment Method</p>
              <p className="text-[20px] font-black text-indigo-600 dark:text-indigo-400 mt-2">
                {METHOD_LABELS[paymentData.method] || paymentData.method}
              </p>
            </div>
            <div className="bg-slate-50/50 dark:bg-slate-900/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-900">
              <p className="text-[11px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider">Payment Date</p>
              <p className="text-[20px] font-black text-slate-900 dark:text-white mt-2">
                {paymentData.paidAt ? new Date(paymentData.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
              </p>
            </div>
          </div>

          {/* Details split grid */}
          <div className="grid md:grid-cols-2 gap-10 border-t border-slate-100 dark:border-slate-800 pt-10">
            {/* Invoice relation */}
            <div className="space-y-4">
              <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Associated Invoice</h4>
              {paymentData.invoice ? (
                <div className="bg-slate-50/50 dark:bg-slate-900/20 p-6 rounded-2xl border border-slate-100 dark:border-slate-900 space-y-4">
                  <div>
                    <span className="text-[11px] uppercase font-bold text-slate-450 tracking-wider">Invoice #</span>
                    <button
                      onClick={() => router.push(`/admin/invoices/${paymentData.invoice.id}`)}
                      className="block text-indigo-650 dark:text-indigo-400 hover:underline font-bold text-base mt-0.5 text-left cursor-pointer"
                    >
                      {paymentData.invoice.number}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Invoice Total</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {formatCurrency(Number(paymentData.invoice.total || 0), currency)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-455 tracking-wider">Client Name</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {paymentData.invoice.client?.user?.name || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center text-slate-400">
                  No invoice linked to this payment.
                </div>
              )}
            </div>

            {/* Transaction specifics */}
            <div className="space-y-4">
              <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Transaction Specifics</h4>
              <div className="space-y-3.5 text-[14.5px]">
                <div className="flex items-center gap-3">
                  <Hash className="h-4.5 w-4.5 text-indigo-500" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Transaction ID</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-300">{paymentData.transactionId || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/50">
                  <Clock className="h-4.5 w-4.5 text-indigo-500" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">System Logged Date</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      {new Date(paymentData.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {paymentData.notes && (
                  <div className="flex items-start gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/50">
                    <BookOpen className="h-4.5 w-4.5 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-455 tracking-wider">Payment Notes</span>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{paymentData.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
