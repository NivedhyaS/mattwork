'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CreditCard,
  Plus,
  Search,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  AlertTriangle,
  Download
} from 'lucide-react';
import Button from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import Modal from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import Label from '@/components/ui/label';
import Select from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/authStore';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900',
  FAILED: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900',
  REFUNDED: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700',
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

const createPaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  method: z.enum(['BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'PAYPAL', 'STRIPE', 'CASH', 'OTHER']).default('BANK_TRANSFER'),
  transactionId: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  paidAt: z.string().optional().or(z.literal('')),
});

type PaymentFormValues = z.infer<typeof createPaymentSchema>;

export default function PaymentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  const { isAuthenticated } = useAuthStore();

  // Queries
  const { data: paymentsData, isLoading, error, refetch } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const res = await api.get('/payments?limit=100');
      return res.data;
    },
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 30_000,
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await api.get('/invoices?limit=100');
      return res.data;
    },
    enabled: isAuthenticated,
  });

  const invoices = invoicesData?.data || [];

  // Mutations
  const createPaymentMutation = useMutation({
    mutationFn: async (values: any) => {
      await api.post('/payments', values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setIsRecordModalOpen(false);
      reset();
    },
  });

  const generatePdfMutation = useMutation({
    mutationFn: async ({ id, number }: { id: string; number: string }) => {
      const response = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice_${number}.pdf`);
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

  // Form Setup
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createPaymentSchema),
    defaultValues: {
      invoiceId: '',
      amount: 0,
      method: 'BANK_TRANSFER' as any,
      transactionId: '',
      reference: '',
      notes: '',
      paidAt: '',
    },
  });

  const onSubmit = (values: any) => {
    const payload = {
      ...values,
      paidAt: values.paidAt ? new Date(values.paidAt) : undefined,
    };
    createPaymentMutation.mutate(payload);
  };

  const payments = (paymentsData?.data || []).filter((payment: any) =>
    !search ||
    payment.invoice?.number?.toLowerCase().includes(search.toLowerCase()) ||
    payment.reference?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[36px] font-bold tracking-tight text-slate-900 dark:text-white">
            Payments
          </h1>
          <p className="text-[15px] text-slate-500 dark:text-slate-400 mt-1">
            Track all incoming and outgoing payments
          </p>
        </div>
        <Button size="sm" onClick={() => setIsRecordModalOpen(true)} className="self-start sm:self-auto cursor-pointer">
          <Plus className="h-4 w-4 mr-2" />
          Record Payment
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
        />
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
              <p className="text-sm text-slate-500 font-medium">Loading payments...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20 flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-rose-500" />
            </div>
            <div>
              <p className="font-bold text-[16px] text-rose-600 dark:text-rose-400">Failed to load payments</p>
              <p className="text-[14px] text-slate-400 mt-1">
                {(error as any)?.response?.data?.message || (error as any)?.message || 'Could not reach the server.'}
              </p>
            </div>
            <button onClick={() => refetch()} className="flex items-center gap-2 text-[14px] font-semibold border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer">
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-24 flex flex-col items-center">
            <div className="h-16 w-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
              <CreditCard className="h-8 w-8 text-slate-300 dark:text-slate-700" />
            </div>
            <p className="font-bold text-[15px] text-slate-700 dark:text-slate-300">No payments found</p>
            <p className="text-[14px] text-slate-400 mt-1">Record a payment to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-900 text-[12px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-5">Invoice #</th>
                  <th className="py-4 px-5">Amount</th>
                  <th className="py-4 px-5">Method</th>
                  <th className="py-4 px-5">Status</th>
                  <th className="py-4 px-5">Date</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                {payments.map((payment: any) => (
                  <tr 
                    key={payment.id} 
                    onClick={() => router.push(`/admin/payments/${payment.id}`)}
                    className="hover:bg-indigo-500/5 dark:hover:bg-indigo-500/10 hover:shadow-[inset_4px_0_0_0_#4f46e5] cursor-pointer transition-all border-b border-slate-100 dark:border-slate-900 group"
                  >
                    <td className="py-4 px-5 font-semibold text-slate-900 dark:text-white">
                      {payment.invoice?.number || 'N/A'}
                    </td>
                    <td className="py-4 px-5">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {formatCurrency(Number(payment.amount), payment.invoice?.client?.currency || 'USD')}
                      </p>
                    </td>
                    <td className="py-4 px-5 text-slate-600 dark:text-slate-300 font-medium">
                      {METHOD_LABELS[payment.method] || payment.method}
                    </td>
                    <td className="py-4 px-5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS[payment.status] || STATUS_COLORS.PENDING}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-500 font-medium">
                      {new Date(payment.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-4 px-5 text-right">
                      {payment.invoice && (
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              generatePdfMutation.mutate({ id: payment.invoice.id, number: payment.invoice.number });
                            }}
                            disabled={generatePdfMutation.isPending}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg cursor-pointer transition-colors"
                            title="Download Invoice PDF"
                          >
                            {generatePdfMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      <Modal
        isOpen={isRecordModalOpen}
        onClose={() => {
          setIsRecordModalOpen(false);
          reset();
        }}
        title="Record Payment"
        description="Log a manual payment against an invoice."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="invoiceId">Select Invoice</Label>
            <Select id="invoiceId" error={errors.invoiceId?.message} {...register('invoiceId')}>
              <option value="">Select an invoice...</option>
              {invoices.map((inv: any) => (
                <option key={inv.id} value={inv.id}>
                  {inv.number} - {inv.client?.user?.name} ({formatCurrency(Number(inv.total))})
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input id="amount" type="number" step="0.01" error={errors.amount?.message} {...register('amount')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="method">Method</Label>
              <Select id="method" error={errors.method?.message} {...register('method')}>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="STRIPE">Stripe / Card</option>
                <option value="PAYPAL">PayPal</option>
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="DEBIT_CARD">Debit Card</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="transactionId">Transaction ID (Optional)</Label>
              <Input id="transactionId" type="text" placeholder="" {...register('transactionId')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paidAt">Payment Date (Optional)</Label>
              <Input id="paidAt" type="date" {...register('paidAt')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input id="notes" type="text" placeholder="" {...register('notes')} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
            <Button type="button" variant="ghost" onClick={() => setIsRecordModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createPaymentMutation.isPending}>Save Payment</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
