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
  PENDING: 'bg-[#D8CFC2] text-[#EA580C] shadow-[inset_2px_2px_4px_rgba(135,120,108,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] font-extrabold px-3 py-1 rounded-xl',
  COMPLETED: 'bg-[#D8CFC2] text-[#10B981] shadow-[inset_2px_2px_4px_rgba(135,120,108,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] font-extrabold px-3 py-1 rounded-xl',
  FAILED: 'bg-[#D8CFC2] text-[#EF4444] shadow-[inset_2px_2px_4px_rgba(135,120,108,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] font-extrabold px-3 py-1 rounded-xl',
  REFUNDED: 'bg-[#D8CFC2] text-[#4A3E34] shadow-[inset_2px_2px_4px_rgba(135,120,108,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] font-extrabold px-3 py-1 rounded-xl',
};

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  STRIPE: 'Stripe / Card',
  PAYPAL: 'PayPal',
  CASH: 'Cash',
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
          <h1 className="text-[36px] font-extrabold tracking-tight text-[#1F1610]">
            Payments
          </h1>
          <p className="text-[15px] text-[#4A3E34] mt-1 font-extrabold">
            Track all incoming and outgoing payments
          </p>
        </div>
        <Button size="sm" onClick={() => setIsRecordModalOpen(true)} className="self-start sm:self-auto cursor-pointer rounded-2xl font-extrabold">
          <Plus className="h-4 w-4 mr-2" />
          Record Payment
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4A3E34]" />
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-2xl border-0 bg-[#D8CFC2] text-[#1F1610] font-semibold shadow-[inset_4px_4px_8px_rgba(135,120,108,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] focus:outline-none focus:shadow-[inset_5px_5px_10px_rgba(135,120,108,0.7),inset_-5px_-5px_10px_rgba(255,255,255,0.9)] transition-all text-[15px]"
        />
      </div>

      {/* Data Table */}
      <div className="bg-[#D8CFC2] rounded-3xl border-0 shadow-[inset_3px_3px_6px_rgba(135,120,108,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] overflow-hidden p-2 flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#EA580C]" />
              <p className="text-sm text-[#4A3E34] font-extrabold">Loading payments...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20 flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-[#D8CFC2] shadow-[inset_3px_3px_6px_rgba(239,68,68,0.3)] flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-[#EF4444]" />
            </div>
            <div>
              <p className="font-extrabold text-[16px] text-[#EF4444]">Failed to load payments</p>
              <p className="text-[14px] text-[#4A3E34] mt-1">
                {(error as any)?.response?.data?.message || (error as any)?.message || 'Could not reach the server.'}
              </p>
            </div>
            <button onClick={() => refetch()} className="flex items-center gap-2 text-[14px] font-extrabold border-0 px-4 py-2 rounded-2xl bg-[#D8CFC2] text-[#1F1610] shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(135,120,108,0.6)] cursor-pointer">
              <RefreshCw className="h-4 w-4 text-[#EA580C]" />
              Retry
            </button>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16 px-6 bg-[#D8CFC2] rounded-3xl shadow-[inset_3px_3px_6px_rgba(135,120,108,0.4),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] max-w-xl mx-auto my-6 flex flex-col items-center">
            <div className="h-16 w-16 rounded-full bg-[#D8CFC2] shadow-[inset_3px_3px_6px_rgba(135,120,108,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] flex items-center justify-center mb-4">
              <CreditCard className="h-8 w-8 text-[#EA580C]" />
            </div>
            <h3 className="text-[18px] font-extrabold text-[#1F1610] mb-1">No payments found</h3>
            <p className="text-[14px] text-[#4A3E34] mb-6 font-extrabold">Record a payment to get started</p>
            <Button
              onClick={() => setIsRecordModalOpen(true)}
              className="bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white font-extrabold text-[14px] px-6 py-2.5 rounded-2xl shadow-[-3px_-3px_8px_rgba(255,255,255,0.7),3px_3px_10px_rgba(234,88,12,0.35)] hover:shadow-[-5px_-5px_12px_rgba(255,255,255,0.8),5px_5px_14px_rgba(234,88,12,0.45)] transition-all cursor-pointer border-none"
            >
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-[#D8CFC2] border-b border-[rgba(135,120,108,0.3)] text-xs font-extrabold uppercase tracking-wider text-[#4A3E34]">
                  <th className="py-3.5 px-5">Invoice #</th>
                  <th className="py-3.5 px-5">Amount</th>
                  <th className="py-3.5 px-5">Method</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5">Date</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(135,120,108,0.25)]">
                {payments.map((payment: any) => (
                  <tr 
                    key={payment.id} 
                    onClick={() => router.push(`/admin/payments/${payment.id}`)}
                    className="hover:bg-[rgba(255,255,255,0.35)] transition-all duration-150 group cursor-pointer"
                  >
                    <td className="py-3.5 px-5 font-extrabold text-[14px] text-[#1F1610] group-hover:text-[#EA580C] transition-colors">
                      {payment.invoice?.number || 'N/A'}
                    </td>
                    <td className="py-3.5 px-5">
                      <p className="font-extrabold text-[14px] text-[#1F1610]">
                        {formatCurrency(Number(payment.amount), payment.invoice?.client?.currency || 'USD')}
                      </p>
                    </td>
                    <td className="py-3.5 px-5 text-[#4A3E34] font-bold text-[13px]">
                      {METHOD_LABELS[payment.method] || payment.method}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={STATUS_COLORS[payment.status] || STATUS_COLORS.PENDING}>
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
