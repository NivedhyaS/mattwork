'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { 
  FileSpreadsheet, 
  Plus, 
  Search, 
  Loader2, 
  Download, 
  MoreHorizontal,
  Trash2,
  RefreshCw,
  AlertTriangle,
  PackageOpen,
} from 'lucide-react';
import Button from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { getCurrencySymbol } from '@/lib/currency';
import Drawer from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import Label from '@/components/ui/label';
import Select from '@/components/ui/select';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/authStore';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:border-slate-800',
  SENT: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900',
  OVERDUE: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700',
};

const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price must be 0 or more'),
});

const createInvoiceSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  projectIds: z.array(z.string()),
  taxRate: z.number().min(0).max(100),
  discount: z.number().min(0),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
});

type InvoiceFormValues = z.infer<typeof createInvoiceSchema>;

interface UploadedProject {
  id: string;
  title: string;
  clientPrice: number | null;
}

export default function InvoicesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const { isAuthenticated } = useAuthStore();

  const { data: invoicesData, isLoading, error, refetch } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await api.get('/invoices?limit=100');
      return res.data;
    },
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 30_000,
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await api.get('/clients?limit=100');
      return res.data;
    },
    enabled: isAuthenticated,
  });

  const clients = clientsData?.data || [];

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

  const createInvoiceMutation = useMutation({
    mutationFn: async (values: any) => {
      await api.post('/invoices', values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setIsCreateDrawerOpen(false);
      reset();
    },
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      clientId: '',
      projectIds: [],
      taxRate: 0,
      discount: 0,
      dueDate: '',
      notes: '',
      terms: '',
      items: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedClientId = watch('clientId');

  useEffect(() => {
    if (!watchedClientId) {
      replace([]);
      setValue('projectIds', []);
      return;
    }

    setLoadingProjects(true);

    api
      .get('/projects', {
        params: {
          clientId: watchedClientId,
          status: 'UPLOADED',
          excludeInvoiced: true,
          limit: 200,
        },
      })
      .then((res) => {
        const uploaded: UploadedProject[] = (res.data?.data || []).map((p: any) => ({
          id: p.id,
          title: p.title,
          clientPrice: p.clientPrice != null ? Number(p.clientPrice) : null,
        }));

        if (uploaded.length === 0) {
          replace([]);
          setValue('projectIds', []);
        } else {
          replace(
            uploaded.map((p) => ({
              description: p.title,
              quantity: 1,
              unitPrice: p.clientPrice ?? 0,
            }))
          );
          setValue('projectIds', uploaded.map((p) => p.id));
        }
      })
      .catch(() => {
        replace([]);
        setValue('projectIds', []);
      })
      .finally(() => setLoadingProjects(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedClientId]);

  const watchedItems = watch('items') || [];
  const watchedTaxRate = Number(watch('taxRate')) || 0;
  const watchedDiscount = Number(watch('discount')) || 0;

  const selectedClient = clients.find((c: any) => c.id === watchedClientId);
  const activeCurrency = selectedClient?.currency || 'USD';
  const curSymbol = getCurrencySymbol(activeCurrency);

  const subtotal = watchedItems.reduce((acc, item) => {
    if (!item) return acc;
    return acc + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  }, 0);

  const taxAmount = subtotal * (watchedTaxRate / 100);
  const total = subtotal + taxAmount - watchedDiscount;

  const onSubmit = (values: InvoiceFormValues) => {
    const processedItems = values.items.map((item) => ({
      ...item,
      total: Number(item.quantity) * Number(item.unitPrice),
    }));

    const payload = {
      ...values,
      items: processedItems,
      dueDate: values.dueDate ? new Date(values.dueDate) : undefined,
    };

    createInvoiceMutation.mutate(payload);
  };

  const invoices = (invoicesData?.data || []).filter(
    (inv: any) =>
      !search ||
      inv.number.toLowerCase().includes(search.toLowerCase()) ||
      inv.client?.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      inv.project?.title?.toLowerCase().includes(search.toLowerCase())
  );

  const clientSelected = !!watchedClientId;
  const hasItems = fields.length > 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[36px] font-bold tracking-tight text-slate-900 dark:text-white">
            Invoices
          </h1>
          <p className="text-[15px] text-slate-500 dark:text-slate-400 mt-1">
            Manage client invoices and track payments
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreateDrawerOpen(true)} className="self-start sm:self-auto cursor-pointer">
          <Plus className="h-4 w-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by invoice number, client, or project..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
        />
      </div>

      <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
              <p className="text-sm text-slate-500 font-medium">Loading invoices...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20 flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-rose-500" />
            </div>
            <div>
              <p className="font-bold text-[16px] text-rose-600 dark:text-rose-400">Failed to load invoices</p>
              <p className="text-[14px] text-slate-400 mt-1">
                {(error as any)?.response?.data?.message || (error as any)?.message || 'Could not reach the server.'}
              </p>
            </div>
            <button onClick={() => refetch()} className="flex items-center gap-2 text-[14px] font-semibold border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer">
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-24 flex flex-col items-center">
            <div className="h-16 w-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
              <FileSpreadsheet className="h-8 w-8 text-slate-300 dark:text-slate-700" />
            </div>
            <p className="font-bold text-[15px] text-slate-700 dark:text-slate-300">No invoices found</p>
            <p className="text-[14px] text-slate-400 mt-1">Create an invoice to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-900 text-[12px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-5">Invoice</th>
                  <th className="py-4 px-5">Client / Projects</th>
                  <th className="py-4 px-5">Amount</th>
                  <th className="py-4 px-5">Status</th>
                  <th className="py-4 px-5">Issued</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                {invoices.map((inv: any) => {
                  // Show project title from FK or fall back to item descriptions
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

                  return (
                    <tr 
                      key={inv.id} 
                      onClick={() => router.push(`/admin/invoices/${inv.id}`)}
                      className="hover:bg-indigo-500/5 dark:hover:bg-indigo-500/10 hover:shadow-[inset_4px_0_0_0_#4f46e5] cursor-pointer transition-all border-b border-slate-100 dark:border-slate-900 group"
                    >
                      <td className="py-4 px-5 font-semibold text-slate-900 dark:text-white">{inv.number}</td>
                      <td className="py-4 px-5">
                        <p className="font-semibold text-[15px] text-slate-800 dark:text-slate-200">
                          {inv.client?.user?.name || 'Unknown Client'}
                        </p>
                        <p className="text-[13px] text-slate-400 truncate max-w-[220px]">
                          {projectLabel || 'No Projects'}
                        </p>
                      </td>
                      <td className="py-4 px-5">
                        <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(Number(inv.total), inv.client?.currency || 'USD')}</p>
                      </td>
                      <td className="py-4 px-5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS[inv.status] || STATUS_COLORS.DRAFT}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-slate-500 font-medium">
                        {new Date(inv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              generatePdfMutation.mutate({ id: inv.id, number: inv.number });
                            }}
                            disabled={generatePdfMutation.isPending}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg cursor-pointer transition-colors"
                            title="Download PDF"
                          >
                            {generatePdfMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Invoice Drawer ─────────────────────────────────────────────── */}
      <Drawer
        isOpen={isCreateDrawerOpen}
        onClose={() => {
          setIsCreateDrawerOpen(false);
          reset();
        }}
        title="Create Invoice"
        description="Select a client to auto-load their completed (Uploaded) projects as line items."
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          <div className="space-y-4">

            {/* Client selector */}
            <div className="space-y-2">
              <Label htmlFor="clientId">Client</Label>
              <Select id="clientId" error={errors.clientId?.message} {...register('clientId')}>
                <option value="">Select a client…</option>
                {clients.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.company ? `${c.company} (${c.user.name})` : c.user.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Due date / Tax / Discount */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input id="dueDate" type="date" error={errors.dueDate?.message} {...register('dueDate')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input id="taxRate" type="number" step="0.1" error={errors.taxRate?.message} {...register('taxRate', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount">Discount ({curSymbol})</Label>
                <Input id="discount" type="number" step="0.01" error={errors.discount?.message} {...register('discount', { valueAsNumber: true })} />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-bold">
                  Line Items
                  {clientSelected && !loadingProjects && (
                    <span className="ml-2 text-[11px] font-normal text-slate-400">
                      (auto-populated from Uploaded projects)
                    </span>
                  )}
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
                  className="h-8 text-[11px] cursor-pointer"
                  disabled={!clientSelected}
                >
                  Add Item
                </Button>
              </div>

              {errors.items && (
                <p className="text-xs text-rose-500 font-medium">{errors.items.message}</p>
              )}

              {/* Before client is chosen */}
              {!clientSelected && (
                <div className="py-6 text-center text-[14px] text-slate-400">
                  Select a client above to auto-load their completed projects.
                </div>
              )}

              {/* Loading */}
              {clientSelected && loadingProjects && (
                <div className="flex items-center gap-2 py-6 justify-center text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-[14px]">Loading completed projects…</span>
                </div>
              )}

              {/* Empty state */}
              {clientSelected && !loadingProjects && !hasItems && (
                <div className="flex flex-col items-center gap-2 py-8 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <PackageOpen className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                  <p className="font-semibold text-[14px] text-slate-600 dark:text-slate-400">
                    No completed projects to invoice
                  </p>
                  <p className="text-[13px] text-slate-400 max-w-xs">
                    This client has no Uploaded projects that haven&apos;t been invoiced yet.
                    Use &ldquo;Add Item&rdquo; to create a manual line item.
                  </p>
                </div>
              )}

              {/* Auto-populated + manual items */}
              {!loadingProjects && hasItems && (
                <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                  {fields.map((field, index) => {
                    const qty = Number(watchedItems[index]?.quantity) || 0;
                    const rate = Number(watchedItems[index]?.unitPrice) || 0;
                    const lineTotal = qty * rate;

                    return (
                      <div key={field.id} className="flex gap-3 items-start bg-slate-50/50 dark:bg-slate-900/30 p-3 rounded-lg border border-slate-100 dark:border-slate-850">
                        <div className="flex-1 space-y-1">
                          <Label className="text-[10px] uppercase text-slate-400">Description</Label>
                          <Input
                            placeholder="Project title or service"
                            error={errors.items?.[index]?.description?.message}
                            {...register(`items.${index}.description` as const)}
                          />
                        </div>
                        <div className="w-20 space-y-1">
                          <Label className="text-[10px] uppercase text-slate-400">Qty</Label>
                          <Input
                            type="number"
                            error={errors.items?.[index]?.quantity?.message}
                            {...register(`items.${index}.quantity` as const, { valueAsNumber: true })}
                          />
                        </div>
                        <div className="w-28 space-y-1">
                          <Label className="text-[10px] uppercase text-slate-400">Rate ({curSymbol})</Label>
                          <Input
                            type="number"
                            step="0.01"
                            error={errors.items?.[index]?.unitPrice?.message}
                            {...register(`items.${index}.unitPrice` as const, { valueAsNumber: true })}
                          />
                        </div>
                        <div className="w-24 space-y-1">
                          <Label className="text-[10px] uppercase text-slate-400">Total</Label>
                          <div className="h-10 flex items-center px-3 border border-slate-200 dark:border-slate-850 bg-slate-100 dark:bg-slate-900 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300">
                            {formatCurrency(lineTotal, activeCurrency)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="mt-6 p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notes / Terms */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  {...register('notes')}
                  placeholder="Notes shown on invoice..."
                  className="w-full h-20 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terms">Terms</Label>
                <textarea
                  id="terms"
                  {...register('terms')}
                  placeholder="Payment terms..."
                  className="w-full h-20 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Totals */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border border-slate-150 dark:border-slate-850 rounded-xl space-y-2 text-sm font-semibold">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal, activeCurrency)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tax ({watchedTaxRate}%)</span>
                <span>{formatCurrency(taxAmount, activeCurrency)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Discount</span>
                <span>-{formatCurrency(watchedDiscount, activeCurrency)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 text-base font-black text-slate-900 dark:text-white">
                <span>Grand Total</span>
                <span>{formatCurrency(total, activeCurrency)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsCreateDrawerOpen(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createInvoiceMutation.isPending}
              disabled={createInvoiceMutation.isPending}
            >
              Create Invoice
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
