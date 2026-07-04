'use client';

import { useState } from 'react';
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
  AlertTriangle
} from 'lucide-react';
import Button from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
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
  quantity: z.coerce.number().positive('Quantity must be positive'),
  unitPrice: z.coerce.number().positive('Unit price must be positive'),
});

const createInvoiceSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  projectId: z.string().min(1, 'Project is required'),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  discount: z.coerce.number().min(0).default(0),
  dueDate: z.string().optional().or(z.literal('')),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
});

type InvoiceFormValues = z.infer<typeof createInvoiceSchema>;

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);

  const { isAuthenticated } = useAuthStore();

  // Queries
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

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects?limit=100');
      return res.data;
    },
    enabled: isAuthenticated,
  });

  const clients = clientsData?.data || [];
  const projects = projectsData?.data || [];

  // Mutations
  const generatePdfMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    },
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

  // Form Setup
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      clientId: '',
      projectId: '',
      taxRate: 0,
      discount: 0,
      dueDate: '',
      notes: '',
      terms: '',
      items: [{ description: '', quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // Dynamic values watch for real-time calculations
  const watchedItems = watch('items') || [];
  const watchedTaxRate = Number(watch('taxRate')) || 0;
  const watchedDiscount = Number(watch('discount')) || 0;

  const subtotal = watchedItems.reduce((acc, item) => {
    if (!item) return acc;
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return acc + qty * price;
  }, 0);

  const taxAmount = subtotal * (watchedTaxRate / 100);
  const total = subtotal + taxAmount - watchedDiscount;

  const watchedClientId = watch('clientId');
  // Filter projects by selected client (if client matches)
  const filteredProjects = projects.filter((proj: any) => {
    if (!watchedClientId) return true;
    return proj.clientId === watchedClientId;
  });

  const onSubmit = (values: any) => {
    // Process items to calculate total for each
    const processedItems = values.items.map((item: any) => ({
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

  const invoices = (invoicesData?.data || []).filter((inv: any) => 
    !search || 
    inv.number.toLowerCase().includes(search.toLowerCase()) ||
    inv.client?.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
    inv.project?.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
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

      {/* Search */}
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

      {/* Data Table */}
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
                  <th className="py-4 px-5">Client / Project</th>
                  <th className="py-4 px-5">Amount</th>
                  <th className="py-4 px-5">Status</th>
                  <th className="py-4 px-5">Issued</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/30 transition-colors group">
                    <td className="py-4 px-5 font-semibold text-slate-900 dark:text-white">
                      {inv.number}
                    </td>
                    <td className="py-4 px-5">
                      <p className="font-semibold text-[15px] text-slate-800 dark:text-slate-200">
                        {inv.client?.user?.name || 'Unknown Client'}
                      </p>
                      <p className="text-[13px] text-slate-400 truncate max-w-[200px]">
                        {inv.project?.title || 'No Project'}
                      </p>
                    </td>
                    <td className="py-4 px-5">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {formatCurrency(Number(inv.total))}
                      </p>
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
                          onClick={() => generatePdfMutation.mutate(inv.id)}
                          disabled={generatePdfMutation.isPending}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg cursor-pointer transition-colors"
                          title="Download PDF"
                        >
                          {generatePdfMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Invoice Drawer */}
      <Drawer
        isOpen={isCreateDrawerOpen}
        onClose={() => {
          setIsCreateDrawerOpen(false);
          reset();
        }}
        title="Create Invoice"
        description="Draft a new invoice for a client project."
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Client</Label>
                <Select id="clientId" error={errors.clientId?.message} {...register('clientId')}>
                  <option value="">Select a client...</option>
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.company ? `${c.company} (${c.user.name})` : c.user.name}
                    </option>
                  ))}
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="projectId">Project</Label>
                <Select id="projectId" error={errors.projectId?.message} {...register('projectId')}>
                  <option value="">Select a project...</option>
                  {filteredProjects.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input id="dueDate" type="date" error={errors.dueDate?.message} {...register('dueDate')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input id="taxRate" type="number" step="0.1" error={errors.taxRate?.message} {...register('taxRate')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount">Discount ($)</Label>
                <Input id="discount" type="number" step="0.01" error={errors.discount?.message} {...register('discount')} />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-bold">Line Items</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
                  className="h-8 text-[11px] cursor-pointer"
                >
                  Add Item
                </Button>
              </div>
              
              {errors.items && <p className="text-xs text-rose-500 font-medium">{errors.items.message}</p>}

              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {fields.map((field, index) => {
                  const itemQuantity = Number(watchedItems[index]?.quantity) || 0;
                  const itemUnitPrice = Number(watchedItems[index]?.unitPrice) || 0;
                  const itemTotal = itemQuantity * itemUnitPrice;

                  return (
                    <div key={field.id} className="flex gap-3 items-start bg-slate-50/50 dark:bg-slate-900/30 p-3 rounded-lg border border-slate-100 dark:border-slate-850">
                      <div className="flex-1 space-y-1">
                        <Label className="text-[10px] uppercase text-slate-400">Description</Label>
                        <Input 
                          placeholder="e.g. Editing services" 
                          error={errors.items?.[index]?.description?.message}
                          {...register(`items.${index}.description` as const)} 
                        />
                      </div>
                      
                      <div className="w-20 space-y-1">
                        <Label className="text-[10px] uppercase text-slate-400">Qty</Label>
                        <Input 
                          type="number" 
                          error={errors.items?.[index]?.quantity?.message}
                          {...register(`items.${index}.quantity` as const)} 
                        />
                      </div>

                      <div className="w-28 space-y-1">
                        <Label className="text-[10px] uppercase text-slate-400">Rate</Label>
                        <Input 
                          type="number" 
                          step="0.01" 
                          error={errors.items?.[index]?.unitPrice?.message}
                          {...register(`items.${index}.unitPrice` as const)} 
                        />
                      </div>

                      <div className="w-24 space-y-1">
                        <Label className="text-[10px] uppercase text-slate-400">Total</Label>
                        <div className="h-10 flex items-center px-3 border border-slate-200 dark:border-slate-850 bg-slate-100 dark:bg-slate-900 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300">
                          {formatCurrency(itemTotal)}
                        </div>
                      </div>

                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="mt-6 p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Terms and Notes */}
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

            {/* Calculations Summary */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border border-slate-150 dark:border-slate-850 rounded-xl space-y-2 text-sm font-semibold">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tax ({watchedTaxRate}%)</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Discount</span>
                <span>-{formatCurrency(watchedDiscount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 text-base font-black text-slate-900 dark:text-white">
                <span>Grand Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsCreateDrawerOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createInvoiceMutation.isPending}>Create Invoice</Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
